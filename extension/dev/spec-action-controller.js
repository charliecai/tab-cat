test('action controller saves the current tab to Reading inbox without closing it', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const removedTabs = [];
  const badgeTextCalls = [];
  const iconCalls = [];
  const toastCalls = [];
  const fakeChrome = {
    action: {
      async setBadgeText(details) {
        badgeTextCalls.push(details);
      },
      async setIcon(details) {
        iconCalls.push(details);
      },
    },
    scripting: {
      async executeScript(details) {
        toastCalls.push({
          target: details.target,
          args: details.args,
        });
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
  assertDeepEqual(toastCalls, [
    {
      target: { tabId: 42 },
      args: [
        {
          tone: 'success',
          title: 'Saved to Reading inbox',
          message: 'This page is ready for later.',
        },
      ],
    },
  ]);
  assertEqual(result.article.id, 'article-1');
  assertEqual(result.deduped, false);
});


test('action controller shows an already-saved page toast without creating a duplicate', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const toastCalls = [];
  const fakeChrome = {
    action: {
      async setBadgeText() {},
      async setIcon() {},
    },
    scripting: {
      async executeScript(details) {
        toastCalls.push({
          target: details.target,
          args: details.args,
        });
      },
    },
    tabs: {
      async query() {
        return [{ id: 55, url: 'https://example.com/existing', title: 'Existing Read' }];
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return { id: 'article-existing', lifecycle_state: 'active', source_ref: '12' };
    },
    async updateArticle(id, updates) {
      return { id, lifecycle_state: 'active', ...updates };
    },
    async createQueuedArticle() {
      throw new Error('Existing links should not create duplicates');
    },
  };
  const fakeJobsRepo = {
    async enqueueJob() {
      throw new Error('Existing ready links should not enqueue new jobs');
    },
  };

  const result = await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo);

  assertEqual(result.deduped, true);
  assertDeepEqual(toastCalls, [
    {
      target: { tabId: 55 },
      args: [
        {
          tone: 'success',
          title: 'Already in Reading inbox',
          message: 'This page is still saved for later.',
        },
      ],
    },
  ]);
});

test('action controller shows a failure toast when the current page cannot be saved', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const toastCalls = [];
  const iconCalls = [];
  const fakeChrome = {
    action: {
      async setBadgeText() {},
      async setIcon(details) {
        iconCalls.push(details);
      },
    },
    scripting: {
      async executeScript(details) {
        toastCalls.push({
          target: details.target,
          args: details.args,
        });
      },
    },
    tabs: {
      async query() {
        return [{ id: 77, url: 'chrome://extensions', title: 'Extensions' }];
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      throw new Error('Unsupported pages should not touch the inbox');
    },
  };
  const fakeJobsRepo = {
    async enqueueJob() {
      throw new Error('Unsupported pages should not enqueue jobs');
    },
  };

  try {
    await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo);
    throw new Error('Expected unsupported save to fail');
  } catch (error) {
    assertEqual(error.message, 'Current page cannot be saved to Reading inbox');
  }

  assertDeepEqual(iconCalls, [
    {
      path: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
      },
    },
  ]);
  assertDeepEqual(toastCalls, [
    {
      target: { tabId: 77 },
      args: [
        {
          tone: 'error',
          title: 'Could not save this page',
          message: 'Reading inbox works on regular web pages.',
        },
      ],
    },
  ]);
});



test('action controller shows a failure toast when saving a regular page fails', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const toastCalls = [];
  const fakeChrome = {
    action: {
      async setBadgeText() {},
      async setIcon() {},
    },
    scripting: {
      async executeScript(details) {
        toastCalls.push({
          target: details.target,
          args: details.args,
        });
      },
    },
    tabs: {
      async query() {
        return [{ id: 88, url: 'https://example.com/failing-save', title: 'Failing Save' }];
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return null;
    },
    async createQueuedArticle() {
      throw new Error('IndexedDB unavailable');
    },
  };
  const fakeJobsRepo = {
    async enqueueJob() {
      throw new Error('Save should fail before queueing');
    },
  };

  try {
    await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo);
    throw new Error('Expected save failure to be rethrown');
  } catch (error) {
    assertEqual(error.message, 'IndexedDB unavailable');
  }

  assertDeepEqual(toastCalls, [
    {
      target: { tabId: 88 },
      args: [
        {
          tone: 'error',
          title: 'Could not save this page',
          message: 'Please try again in a moment.',
        },
      ],
    },
  ]);
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
