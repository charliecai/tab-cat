test('action controller saves the current tab to Reading inbox without closing it', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const removedTabs = [];
  const badgeTextCalls = [];
  const iconCalls = [];
  const fakeChrome = {
    action: {
      async setBadgeText(details) {
        badgeTextCalls.push(details);
      },
      async setIcon(details) {
        iconCalls.push(details);
      },
    },
    tabs: {
      async query(query) {
        assertDeepEqual(query, { active: true, currentWindow: true });
        return [{ id: 42, url: 'https://example.com/read#intro', title: 'Example Read' }];
      },
      async create() {
        throw new Error('Action click should not open a new tab');
      },
      async remove(tabId) {
        removedTabs.push(tabId);
      },
    },
  };
  const createdArticles = [];
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl(url) {
      assertEqual(url, 'https://example.com/read#intro');
      return null;
    },
    async createQueuedArticle(input) {
      createdArticles.push(input);
      return { id: 'article-1', lifecycle_state: 'active', ...input };
    },
  };
  const enqueuedJobs = [];
  const fakeJobsRepo = {
    async enqueueJob(input) {
      enqueuedJobs.push(input);
      return { id: 'job-1', ...input };
    },
  };

  const result = await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo);

  assertDeepEqual(createdArticles, [
    {
      source_type: 'tab',
      source_ref: '42',
      url: 'https://example.com/read#intro',
      title: 'Example Read',
      site_name: 'example.com',
      close_source_tab_after_capture: false,
      capture_source: 'action-button',
    },
  ]);
  assertDeepEqual(enqueuedJobs, [{ article_id: 'article-1', processing_state: 'queued' }]);
  assertDeepEqual(removedTabs, []);
  assertDeepEqual(badgeTextCalls, [{ text: '' }]);
  assertDeepEqual(iconCalls, [
    {
      path: {
        16: 'icons/icon16-saved.png',
        48: 'icons/icon48-saved.png',
      },
    },
  ]);
  assertEqual(result.article.id, 'article-1');
  assertEqual(result.deduped, false);
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
