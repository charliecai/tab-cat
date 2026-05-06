(function () {
  const namespace = (globalThis.TabOutActionController = globalThis.TabOutActionController || {});
  const HOME_PATH = 'index.html';
  const DEFAULT_ICON_PATH = {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
  };
  const SAVED_ICON_PATH = {
    16: 'icons/icon16-saved.png',
    48: 'icons/icon48-saved.png',
  };
  const INTERNAL_URL_PREFIXES = [
    'about:',
    'brave://',
    'chrome://',
    'chrome-extension://',
    'edge://',
  ];

  function getTabCatHomeUrl(chromeApi) {
    return chromeApi.runtime.getURL(HOME_PATH);
  }

  async function openTabCatHome(chromeApi) {
    await chromeApi.tabs.create({ url: getTabCatHomeUrl(chromeApi) });
  }

  function canCheckInboxForUrl(url) {
    if (!url) return false;
    return !INTERNAL_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
  }

  function isInboxArticle(article) {
    return Boolean(article && article.lifecycle_state !== 'deleted');
  }

  function getSiteNameFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  async function getCurrentTab(chromeApi) {
    const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs.length ? tabs[0] : null;
  }

  async function showSavedIcon(chromeApi) {
    await chromeApi.action.setBadgeText({ text: '' });
    await chromeApi.action.setIcon({ path: SAVED_ICON_PATH });
  }

  async function showDefaultIcon(chromeApi) {
    await chromeApi.action.setBadgeText({ text: '' });
    await chromeApi.action.setIcon({ path: DEFAULT_ICON_PATH });
  }

  async function getActionToastText(settingsRepo, key) {
    const i18n = globalThis.TabOutI18n;
    if (!i18n || typeof i18n.t !== 'function') return key;

    if (settingsRepo && typeof settingsRepo.getAiSettings === 'function') {
      try {
        const settings = await settingsRepo.getAiSettings();
        if (typeof i18n.setLanguagePreference === 'function') {
          i18n.setLanguagePreference(
            (settings && settings.language_preference) || 'auto',
            (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
          );
        }
      } catch {
        // Fall back to the i18n module's current language state.
      }
    }

    return i18n.t(key);
  }

  function renderActionToast(options) {
    const rootId = 'tab-out-action-toast';
    const existing = document.getElementById(rootId);
    if (existing) existing.remove();

    const tone = options && options.tone === 'error' ? 'error' : 'success';
    const palette =
      tone === 'error'
        ? {
            accent: '#b35a5a',
            tint: 'rgba(179, 90, 90, 0.1)',
            border: 'rgba(179, 90, 90, 0.22)',
            glyph: '!',
          }
        : {
            accent: '#3d7a4a',
            tint: 'rgba(61, 122, 74, 0.1)',
            border: 'rgba(61, 122, 74, 0.22)',
            glyph: '✓',
          };

    const toast = document.createElement('div');
    toast.id = rootId;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = [
      'position:fixed',
      'top:24px',
      'right:24px',
      'z-index:2147483647',
      'display:flex',
      'gap:8px',
      'align-items:center',
      'max-width:min(360px, calc(100vw - 32px))',
      'padding:10px 12px',
      'border-radius:12px',
      `border:1px solid ${palette.border}`,
      'background:rgba(250, 249, 245, 0.98)',
      'color:#1a1613',
      'box-shadow:0 10px 28px rgba(26, 22, 19, 0.1), 0 0 0 1px rgba(240, 238, 230, 0.84)',
      'font-family:DM Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'font-size:12px',
      'font-weight:400',
      'line-height:1.35',
      'opacity:0',
      'transform:translateY(-8px)',
      'transition:opacity 180ms ease, transform 180ms ease',
      'pointer-events:none',
    ].join(';');

    const icon = document.createElement('div');
    icon.textContent = palette.glyph;
    icon.style.cssText = [
      'width:20px',
      'height:20px',
      'border-radius:999px',
      `background:${palette.tint}`,
      `color:${palette.accent}`,
      `border:1px solid ${palette.border}`,
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:12px',
      'font-weight:600',
      'line-height:1',
      'flex:0 0 auto',
    ].join(';');

    const copy = document.createElement('div');
    copy.textContent = options.text || '';
    copy.style.cssText = 'min-width:0;color:#5e5d59;';
    toast.append(icon, copy);
    document.documentElement.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      window.setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  async function showActionToast(chromeApi, tabId, options) {
    if (!tabId || !chromeApi.scripting || !chromeApi.scripting.executeScript) return;
    try {
      await chromeApi.scripting.executeScript({
        target: { tabId },
        func: renderActionToast,
        args: [options],
      });
    } catch {
      // Some browser-owned pages disallow injection; saving should still complete.
    }
  }

  function removeReadingPageActions() {
    document.getElementById('tab-out-reading-page-actions')?.remove();
  }

  function renderReadingPageActions(payload) {
    const rootId = 'tab-out-reading-page-actions';
    const existing = document.getElementById(rootId);
    if (existing) existing.remove();

    const article = (payload && payload.article) || {};
    const copy = (payload && payload.copy) || {};
    const card = document.createElement('aside');
    card.id = rootId;
    card.setAttribute('role', 'complementary');
    card.setAttribute('aria-label', copy.eyebrow || 'Tab Cat');
    card.style.cssText = [
      'position:fixed',
      'right:24px',
      'bottom:24px',
      'z-index:2147483647',
      'display:grid',
      'gap:8px',
      'width:min(188px, calc(100vw - 24px))',
      'padding:10px',
      'border-radius:12px',
      'border:1px solid rgba(232, 226, 218, 0.92)',
      'background:rgba(250, 249, 245, 0.98)',
      'color:#141413',
      'box-shadow:0 10px 28px rgba(20, 20, 19, 0.14), 0 0 0 1px rgba(240, 238, 230, 0.84)',
      'font-family:"DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'line-height:1.35',
      'opacity:0',
      'transform:translateY(10px)',
      'transition:opacity 180ms ease, transform 180ms ease',
    ].join(';');

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';

    const text = document.createElement('div');
    text.style.cssText = 'min-width:0;';
    const eyebrow = document.createElement('div');
    eyebrow.textContent = copy.eyebrow || 'Tab Cat';
    eyebrow.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#c96442;white-space:nowrap;';
    text.append(eyebrow);

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = '×';
    dismiss.setAttribute('aria-label', copy.dismiss || 'Dismiss');
    dismiss.style.cssText = [
      'border:0',
      'background:transparent',
      'color:#5e5d59',
      'border-radius:0',
      'width:20px',
      'height:20px',
      'font-size:17px',
      'line-height:1',
      'cursor:pointer',
    ].join(';');
    dismiss.addEventListener('click', () => card.remove());
    top.append(text, dismiss);

    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      card.dataset.preview = 'true';
    }

    const actions = document.createElement('div');
    actions.style.cssText = 'display:grid;gap:6px;';

    function buildButton(label, action, variant) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.tabOutReadingAction = action;
      button.style.cssText = [
        'border-radius:999px',
        'padding:7px 10px',
        'font-size:12px',
        'font-weight:700',
        'font-family:inherit',
        'cursor:pointer',
        'transition:transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
        variant === 'primary'
          ? 'border:1px solid #141413;background:#141413;color:#faf9f5'
          : 'border:1px solid rgba(179, 90, 90, 0.3);background:rgba(179, 90, 90, 0.08);color:#b53333',
      ].join(';');
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-1px)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
      });
      button.addEventListener('click', async () => {
        if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') return;
        status.textContent = copy.working || 'Updating...';
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'tabout:reading-page-action',
            action,
          });
          if (!response || !response.ok) {
            throw new Error(response && response.error ? response.error : 'Action failed');
          }
        } catch (error) {
          status.textContent = error && error.message ? error.message : (copy.failed || 'Action failed');
        }
      });
      return button;
    }

    actions.append(
      buildButton(copy.markRead || 'Mark read', 'mark-read-close', 'primary'),
      buildButton(copy.delete || 'Delete', 'delete-close', 'danger')
    );

    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    status.style.cssText = 'min-height:16px;font-size:11px;color:#87867f;';

    card.append(top, actions, status);
    document.documentElement.appendChild(card);
    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
  }

  function isUnreadInboxArticle(article) {
    return Boolean(isInboxArticle(article) && article.lifecycle_state === 'active');
  }

  async function getCurrentTabInboxArticle(chromeApi, articlesRepo) {
    const tab = await getCurrentTab(chromeApi);
    const url = tab && tab.url ? tab.url : '';
    if (!tab || !tab.id || !canCheckInboxForUrl(url) || !articlesRepo) {
      return { tab, article: null, reason: 'unsupported_url' };
    }

    const article = await articlesRepo.findArticleByCanonicalUrl(url);
    if (!article) return { tab, article: null, reason: 'missing' };
    if (!isUnreadInboxArticle(article)) return { tab, article, reason: 'not_unread' };
    return { tab, article, reason: 'matched' };
  }

  async function getReadingPageActionCopy(settingsRepo) {
    return {
      eyebrow: 'Tab Cat',
      dismiss: await getActionToastText(settingsRepo, 'readingPageActions.dismiss'),
      markRead: await getActionToastText(settingsRepo, 'readingPageActions.markRead'),
      delete: await getActionToastText(settingsRepo, 'readingPageActions.delete'),
      working: await getActionToastText(settingsRepo, 'readingPageActions.working'),
      failed: await getActionToastText(settingsRepo, 'readingPageActions.failed'),
    };
  }

  async function showCurrentTabReadingActions(chromeApi, articlesRepo, _jobsRepo, settingsRepo) {
    const { tab, article, reason } = await getCurrentTabInboxArticle(chromeApi, articlesRepo);
    if (!tab || !tab.id || !chromeApi.scripting || !chromeApi.scripting.executeScript) {
      return { injected: false, reason };
    }

    if (!isUnreadInboxArticle(article)) {
      try {
        await chromeApi.scripting.executeScript({
          target: { tabId: tab.id },
          func: removeReadingPageActions,
          args: [],
        });
      } catch {
        // Restricted pages can reject script injection.
      }
      return { injected: false, reason };
    }

    const payload = {
      article: {
        id: article.id,
        title: article.title || article.url || '',
        url: article.url || tab.url || '',
      },
      copy: await getReadingPageActionCopy(settingsRepo),
    };

    try {
      await chromeApi.scripting.executeScript({
        target: { tabId: tab.id },
        func: renderReadingPageActions,
        args: [payload],
      });
      return { injected: true, articleId: article.id };
    } catch {
      return { injected: false, reason: 'injection_failed' };
    }
  }

  async function markCurrentTabArticleReadAndClose(chromeApi, articlesRepo) {
    const { tab, article, reason } = await getCurrentTabInboxArticle(chromeApi, articlesRepo);
    if (!tab || !tab.id || !article) throw new Error(reason || 'Current page is not in Reading inbox');

    await articlesRepo.markArticleRead(article.id);
    await updateCurrentTabInboxBadge(chromeApi, articlesRepo);
    await chromeApi.tabs.remove(tab.id);
    return { articleId: article.id };
  }

  async function deleteCurrentTabArticleAndClose(chromeApi, articlesRepo, jobsRepo) {
    const { tab, article, reason } = await getCurrentTabInboxArticle(chromeApi, articlesRepo);
    if (!tab || !tab.id || !article) throw new Error(reason || 'Current page is not in Reading inbox');

    if (jobsRepo && typeof jobsRepo.getJobByArticleId === 'function') {
      const relatedJob = await jobsRepo.getJobByArticleId(article.id);
      if (relatedJob && typeof jobsRepo.deleteJob === 'function') {
        await jobsRepo.deleteJob(relatedJob.id);
      }
    }

    await articlesRepo.deleteArticlePermanently(article.id);
    await updateCurrentTabInboxBadge(chromeApi, articlesRepo);
    await chromeApi.tabs.remove(tab.id);
    return { articleId: article.id };
  }

  async function updateCurrentTabInboxBadge(chromeApi, articlesRepo) {
    try {
      const tab = await getCurrentTab(chromeApi);
      const url = tab && tab.url ? tab.url : '';
      if (!canCheckInboxForUrl(url)) {
        await showDefaultIcon(chromeApi);
        return;
      }

      const article = await articlesRepo.findArticleByCanonicalUrl(url);
      if (isInboxArticle(article)) {
        await showSavedIcon(chromeApi);
        return;
      }

      await showDefaultIcon(chromeApi);
    } catch {
      await showDefaultIcon(chromeApi);
    }
  }

  async function saveCurrentTabToReadingInbox(chromeApi, articlesRepo, jobsRepo, settingsRepo) {
    const tab = await getCurrentTab(chromeApi);
    const url = tab && tab.url ? tab.url : '';
    if (!canCheckInboxForUrl(url)) {
      await showDefaultIcon(chromeApi);
      await showActionToast(chromeApi, tab && tab.id, {
        tone: 'error',
        text: await getActionToastText(settingsRepo, 'toast.failedToSaveTab'),
      });
      throw new Error('Current page cannot be saved to Reading inbox');
    }

    try {
      const sourceRef = tab.id ? String(tab.id) : null;
      const existing = await articlesRepo.findArticleByCanonicalUrl(url);
      if (isInboxArticle(existing)) {
        const refreshed = await articlesRepo.updateArticle(existing.id, {
          lifecycle_state: 'active',
          last_saved_at: new Date().toISOString(),
          source_ref: sourceRef || existing.source_ref || null,
          close_source_tab_after_capture: false,
        });
        await showSavedIcon(chromeApi);
        await showActionToast(chromeApi, tab.id, {
          tone: 'success',
          text: await getActionToastText(settingsRepo, 'toast.alreadySaved'),
        });
        return {
          article: refreshed,
          deduped: true,
          requeued: false,
        };
      }

      const article = await articlesRepo.createQueuedArticle({
        source_type: 'tab',
        source_ref: sourceRef,
        url,
        title: tab.title || url,
        site_name: getSiteNameFromUrl(url),
        close_source_tab_after_capture: false,
        capture_source: 'action-button',
      });

      await jobsRepo.enqueueJob({
        article_id: article.id,
        processing_state: 'queued',
      });
      await showSavedIcon(chromeApi);
      await showActionToast(chromeApi, tab.id, {
        tone: 'success',
        text: await getActionToastText(settingsRepo, 'toast.savedToReadingInbox'),
      });

      return {
        article,
        deduped: false,
        requeued: true,
      };
    } catch (error) {
      await showActionToast(chromeApi, tab.id, {
        tone: 'error',
        text: await getActionToastText(settingsRepo, 'toast.failedToSaveTab'),
      });
      throw error;
    }
  }

  namespace.getTabCatHomeUrl = getTabCatHomeUrl;
  namespace.openTabCatHome = openTabCatHome;
  namespace.canCheckInboxForUrl = canCheckInboxForUrl;
  namespace.isInboxArticle = isInboxArticle;
  namespace.getActionToastText = getActionToastText;
  namespace.showActionToast = showActionToast;
  namespace.saveCurrentTabToReadingInbox = saveCurrentTabToReadingInbox;
  namespace.updateCurrentTabInboxBadge = updateCurrentTabInboxBadge;
  namespace.showCurrentTabReadingActions = showCurrentTabReadingActions;
  namespace.markCurrentTabArticleReadAndClose = markCurrentTabArticleReadAndClose;
  namespace.deleteCurrentTabArticleAndClose = deleteCurrentTabArticleAndClose;
})();
