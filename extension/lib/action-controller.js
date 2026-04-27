(function () {
  const namespace = (globalThis.TabOutActionController = globalThis.TabOutActionController || {});
  const HOME_PATH = 'index.html';
  const SAVED_BADGE_TEXT = '✓';
  const SAVED_BADGE_COLOR = '#3d7a4a';
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

  async function setSavedBadge(chromeApi) {
    await chromeApi.action.setBadgeText({ text: SAVED_BADGE_TEXT });
    await chromeApi.action.setBadgeBackgroundColor({ color: SAVED_BADGE_COLOR });
  }

  async function clearBadge(chromeApi) {
    await chromeApi.action.setBadgeText({ text: '' });
  }

  async function updateCurrentTabInboxBadge(chromeApi, articlesRepo) {
    try {
      const tab = await getCurrentTab(chromeApi);
      const url = tab && tab.url ? tab.url : '';
      if (!canCheckInboxForUrl(url)) {
        await clearBadge(chromeApi);
        return;
      }

      const article = await articlesRepo.findArticleByCanonicalUrl(url);
      if (isInboxArticle(article)) {
        await setSavedBadge(chromeApi);
        return;
      }

      await clearBadge(chromeApi);
    } catch {
      await clearBadge(chromeApi);
    }
  }

  namespace.getTabCatHomeUrl = getTabCatHomeUrl;
  namespace.openTabCatHome = openTabCatHome;
  namespace.canCheckInboxForUrl = canCheckInboxForUrl;
  namespace.isInboxArticle = isInboxArticle;
  namespace.updateCurrentTabInboxBadge = updateCurrentTabInboxBadge;
})();
