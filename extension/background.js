importScripts(
  'lib/schema.js',
  'lib/db.js',
  'lib/settings-repo.js',
  'lib/i18n.js',
  'lib/articles-repo.js',
  'lib/action-controller.js',
  'lib/topics-repo.js',
  'lib/jobs-repo.js',
  'lib/ai-client.js',
  'lib/article-analysis.js',
  'lib/topic-engine.js',
  'lib/capture.js',
  'lib/jobs-runner.js'
);

async function updateBadge() {
  await globalThis.TabOutActionController.updateCurrentTabInboxBadge(chrome, globalThis.TabOutArticlesRepo);
}

async function refreshCurrentTabReadingActions() {
  await updateBadge();
  await globalThis.TabOutActionController.showCurrentTabReadingActions(
    chrome,
    globalThis.TabOutArticlesRepo,
    globalThis.TabOutJobsRepo,
    globalThis.TabOutSettingsRepo
  );
}

async function initializeWorker() {
  try {
    await globalThis.TabOutDb.openTabOutDb();
    await globalThis.TabOutJobsRunner.rollbackStuckJobs();
    await globalThis.TabOutJobsRunner.kick();
  } catch (error) {
    console.warn('[tab-out] background init failed:', error);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return undefined;

  if (message.type === 'tabout:jobs:kick') {
    initializeWorker()
      .then(async () => {
        await globalThis.TabOutJobsRunner.kick();
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'tabout:badge:refresh') {
    updateBadge()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'tabout:reading-page-action') {
    (async () => {
      if (message.action === 'mark-read-close') {
        const result = await globalThis.TabOutActionController.markCurrentTabArticleReadAndClose(
          chrome,
          globalThis.TabOutArticlesRepo
        );
        sendResponse({ ok: true, ...result });
        return;
      }

      if (message.action === 'delete-close') {
        const result = await globalThis.TabOutActionController.deleteCurrentTabArticleAndClose(
          chrome,
          globalThis.TabOutArticlesRepo,
          globalThis.TabOutJobsRepo
        );
        sendResponse({ ok: true, ...result });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown Reading page action' });
    })().catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'tabout:ai:test-connection') {
    (async () => {
      try {
        const settings = await globalThis.TabOutSettingsRepo.getAiSettings();
        const validation = globalThis.TabOutAiClient.validateAiSettings(settings);
        if (!validation.isValid) {
          await globalThis.TabOutSettingsRepo.saveAiStatus({
            state: 'failed',
            host: validation.host,
            last_error: validation.errors.join(', '),
          });
          sendResponse({ ok: false, error: validation.errors.join(', ') });
          return;
        }

        await globalThis.TabOutAiClient.testConnection(settings);
        await globalThis.TabOutSettingsRepo.saveAiStatus({
          state: 'ready',
          host: validation.host,
          last_error: null,
        });
        sendResponse({ ok: true, host: validation.host });
      } catch (error) {
        await globalThis.TabOutSettingsRepo.saveAiStatus({
          state: 'failed',
          host: null,
          last_error: error.message,
        });
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  return undefined;
});

chrome.runtime.onInstalled.addListener(() => {
  refreshCurrentTabReadingActions();
  initializeWorker();
});

chrome.runtime.onStartup.addListener(() => {
  refreshCurrentTabReadingActions();
  initializeWorker();
});

chrome.tabs.onCreated.addListener(() => {
  refreshCurrentTabReadingActions();
});

chrome.tabs.onActivated.addListener(() => {
  refreshCurrentTabReadingActions();
});

chrome.tabs.onRemoved.addListener(() => {
  refreshCurrentTabReadingActions();
});

chrome.tabs.onUpdated.addListener(() => {
  refreshCurrentTabReadingActions();
});

chrome.action.onClicked.addListener(() => {
  globalThis.TabOutActionController
    .saveCurrentTabToReadingInbox(
      chrome,
      globalThis.TabOutArticlesRepo,
      globalThis.TabOutJobsRepo,
      globalThis.TabOutSettingsRepo
    )
    .then(async () => {
      await globalThis.TabOutJobsRunner.kick();
      await refreshCurrentTabReadingActions();
    })
    .catch((error) => {
      console.warn('[tab-out] failed to save current tab to Reading inbox:', error);
      refreshCurrentTabReadingActions();
    });
});

if (chrome.windows && chrome.windows.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener(() => {
    refreshCurrentTabReadingActions();
  });
}

refreshCurrentTabReadingActions();
initializeWorker();
