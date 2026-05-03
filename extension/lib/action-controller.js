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
})();
