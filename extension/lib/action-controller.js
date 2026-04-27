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

  namespace.getTabCatHomeUrl = getTabCatHomeUrl;
  namespace.openTabCatHome = openTabCatHome;
  namespace.canCheckInboxForUrl = canCheckInboxForUrl;
  namespace.isInboxArticle = isInboxArticle;
  namespace.updateCurrentTabInboxBadge = updateCurrentTabInboxBadge;
})();
