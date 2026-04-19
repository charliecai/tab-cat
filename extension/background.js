importScripts(
  'lib/schema.js',
  'lib/db.js',
  'lib/settings-repo.js',
  'lib/i18n.js',
  'lib/articles-repo.js',
  'lib/topics-repo.js',
  'lib/jobs-repo.js',
  'lib/ai-client.js',
  'lib/article-analysis.js',
  'lib/topic-engine.js',
  'lib/capture.js',
  'lib/jobs-runner.js'
);

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.filter((tab) => {
      const url = tab.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://')
      );
    }).length;

    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    if (!count) return;

    let color = '#3d7a4a';
    if (count > 20) {
      color = '#b35a5a';
    } else if (count > 10) {
      color = '#b8892e';
    }
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    chrome.action.setBadgeText({ text: '' });
  }
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
  updateBadge();
  initializeWorker();
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
  initializeWorker();
});

chrome.tabs.onCreated.addListener(() => {
  updateBadge();
});

chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});

chrome.tabs.onUpdated.addListener(() => {
  updateBadge();
});

updateBadge();
initializeWorker();
