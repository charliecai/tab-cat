test('action controller opens the Tab Cat homepage in a new tab', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const createdTabs = [];
  const fakeChrome = {
    runtime: {
      getURL(path) {
        return `chrome-extension://tabcat/${path}`;
      },
    },
    tabs: {
      async create(tab) {
        createdTabs.push(tab);
      },
    },
  };

  await controller.openTabCatHome(fakeChrome);

  assertDeepEqual(createdTabs, [{ url: 'chrome-extension://tabcat/index.html' }]);
});

test('action controller shows a saved-state icon for the current saved link', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const badgeTextCalls = [];
  const iconCalls = [];
  const fakeChrome = {
    action: {
      async setBadgeText(details) {
        badgeTextCalls.push(details);
      },
      async setBadgeBackgroundColor() {
        throw new Error('Badge background should not be used for saved-state icons');
      },
      async setIcon(details) {
        iconCalls.push(details);
      },
    },
    tabs: {
      async query(query) {
        assertDeepEqual(query, { active: true, currentWindow: true });
        return [{ id: 12, url: 'https://example.com/read#section' }];
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl(url) {
      assertEqual(url, 'https://example.com/read#section');
      return { id: 'article-1', lifecycle_state: 'read' };
    },
  };

  await controller.updateCurrentTabInboxBadge(fakeChrome, fakeArticlesRepo);

  assertDeepEqual(badgeTextCalls, [{ text: '' }]);
  assertDeepEqual(iconCalls, [
    {
      path: {
        16: 'icons/icon16-saved.png',
        48: 'icons/icon48-saved.png',
      },
    },
  ]);
});

test('action controller restores the default icon when the current link is not in the inbox', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const badgeTextCalls = [];
  const iconCalls = [];
  const fakeChrome = {
    action: {
      async setBadgeText(details) {
        badgeTextCalls.push(details);
      },
      async setBadgeBackgroundColor() {
        throw new Error('Badge color should not be set when the link is absent');
      },
      async setIcon(details) {
        iconCalls.push(details);
      },
    },
    tabs: {
      async query() {
        return [{ id: 14, url: 'https://example.com/new' }];
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return null;
    },
  };

  await controller.updateCurrentTabInboxBadge(fakeChrome, fakeArticlesRepo);

  assertDeepEqual(badgeTextCalls, [{ text: '' }]);
  assertDeepEqual(iconCalls, [
    {
      path: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
      },
    },
  ]);
});
