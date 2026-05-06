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
  const fakeSettingsRepo = {
    async getAiSettings() {
      return { language_preference: 'en' };
    },
  };

  const result = await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo, fakeSettingsRepo);

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
          text: 'Saved to Reading inbox',
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
  const fakeSettingsRepo = {
    async getAiSettings() {
      return { language_preference: 'en' };
    },
  };

  const result = await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo, fakeSettingsRepo);

  assertEqual(result.deduped, true);
  assertDeepEqual(toastCalls, [
    {
      target: { tabId: 55 },
      args: [
        {
          tone: 'success',
          text: 'Already saved',
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
  const fakeSettingsRepo = {
    async getAiSettings() {
      return { language_preference: 'en' };
    },
  };

  try {
    await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo, fakeSettingsRepo);
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
          text: 'Failed to save tab',
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
  const fakeSettingsRepo = {
    async getAiSettings() {
      return { language_preference: 'en' };
    },
  };

  try {
    await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo, fakeSettingsRepo);
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
          text: 'Failed to save tab',
        },
      ],
    },
  ]);
});




test('action controller renders action toast as one explanatory line', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  document.getElementById('tab-out-action-toast')?.remove();
  const fakeChrome = {
    scripting: {
      async executeScript(details) {
        details.func(...details.args);
      },
    },
  };

  await controller.showActionToast(fakeChrome, 101, {
    tone: 'success',
    text: 'Saved to Reading inbox',
  });

  const toast = document.getElementById('tab-out-action-toast');
  if (!toast) throw new Error('Expected action toast to render');
  assertEqual(toast.textContent.trim(), '✓Saved to Reading inbox');
  assertEqual(toast.style.fontSize, '12px');
  assertEqual(toast.style.fontWeight, '400');
  assertEqual(toast.querySelectorAll('div').length, 2);
  toast.remove();
});


test('action controller localizes action toast text from the saved language preference', async () => {
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
        return [{ id: 91, url: 'https://example.com/zh-save', title: '中文保存' }];
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return null;
    },
    async createQueuedArticle(input) {
      return { id: 'article-zh', lifecycle_state: 'active', ...input };
    },
  };
  const fakeJobsRepo = {
    async enqueueJob(input) {
      return { id: 'job-zh', ...input };
    },
  };
  const fakeSettingsRepo = {
    async getAiSettings() {
      return { language_preference: 'zh-CN' };
    },
  };

  await controller.saveCurrentTabToReadingInbox(fakeChrome, fakeArticlesRepo, fakeJobsRepo, fakeSettingsRepo);

  assertDeepEqual(toastCalls, [
    {
      target: { tabId: 91 },
      args: [
        {
          tone: 'success',
          text: '已保存到阅读收件箱',
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


test('action controller injects reading page actions for an unread saved article', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const scriptCalls = [];
  const fakeChrome = {
    tabs: {
      async query(query) {
        assertDeepEqual(query, { active: true, currentWindow: true });
        return [{ id: 101, url: 'https://example.com/read#section', title: 'Article page' }];
      },
    },
    scripting: {
      async executeScript(details) {
        scriptCalls.push(details);
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl(url) {
      assertEqual(url, 'https://example.com/read#section');
      return {
        id: 'article-quick-1',
        title: 'Article page',
        url: 'https://example.com/read',
        lifecycle_state: 'active',
      };
    },
  };

  const result = await controller.showCurrentTabReadingActions(fakeChrome, fakeArticlesRepo, null, null);

  assertEqual(result.injected, true);
  assertEqual(scriptCalls.length, 1);
  assertDeepEqual(scriptCalls[0].target, { tabId: 101 });
  assertEqual(scriptCalls[0].args[0].article.id, 'article-quick-1');
  assertEqual(scriptCalls[0].args[0].article.title, 'Article page');

  document.getElementById('tab-out-reading-page-actions')?.remove();
  scriptCalls[0].func(...scriptCalls[0].args);
  const card = document.getElementById('tab-out-reading-page-actions');
  if (!card) throw new Error('Expected reading page actions to render');
  const renderedText = card.textContent;
  assertEqual(renderedText.includes('Tab Cat'), true);
  assertEqual(renderedText.includes('In Reading inbox'), false);
  assertEqual(renderedText.includes('Article page'), false);
  assertEqual(renderedText.includes('Mark read & close'), false);
  assertEqual(renderedText.includes('Delete & close'), false);
  assertEqual(renderedText.includes('标记已读并关闭'), false);
  assertEqual(renderedText.includes('删除并关闭'), false);
  assertEqual(renderedText.includes('Mark read') || renderedText.includes('标记已读'), true);
  assertEqual(renderedText.includes('Delete') || renderedText.includes('删除'), true);
  assertEqual(card.style.width, '80px');
  assertEqual(card.querySelector('[role="status"]'), null);
  assertEqual(card.querySelectorAll('button')[0].style.border, '0px');
  card.remove();
});


test('action controller removes reading page actions when current article is already read', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const scriptCalls = [];
  const fakeChrome = {
    tabs: {
      async query() {
        return [{ id: 102, url: 'https://example.com/read' }];
      },
    },
    scripting: {
      async executeScript(details) {
        scriptCalls.push(details);
      },
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return { id: 'article-read-1', lifecycle_state: 'read' };
    },
  };

  const result = await controller.showCurrentTabReadingActions(fakeChrome, fakeArticlesRepo, null, null);

  assertEqual(result.injected, false);
  assertEqual(result.reason, 'not_unread');
  assertEqual(scriptCalls.length, 1);
  assertDeepEqual(scriptCalls[0].target, { tabId: 102 });
  assertEqual(scriptCalls[0].args.length, 0);
});


test('action controller marks the current page article read and closes the tab', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const marked = [];
  const removedTabs = [];
  const fakeChrome = {
    tabs: {
      async query() {
        return [{ id: 103, url: 'https://example.com/read' }];
      },
      async remove(tabId) {
        removedTabs.push(tabId);
      },
    },
    action: {
      async setBadgeText() {},
      async setIcon() {},
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return { id: 'article-active-1', lifecycle_state: 'active' };
    },
    async markArticleRead(articleId) {
      marked.push(articleId);
      return { id: articleId, lifecycle_state: 'read' };
    },
  };

  const result = await controller.markCurrentTabArticleReadAndClose(fakeChrome, fakeArticlesRepo);

  assertDeepEqual(marked, ['article-active-1']);
  assertDeepEqual(removedTabs, [103]);
  assertEqual(result.articleId, 'article-active-1');
});


test('action controller deletes the current page article job and closes the tab', async () => {
  const controller = globalThis.TabOutActionController;
  if (!controller) throw new Error('TabOutActionController missing');

  const deletedArticles = [];
  const deletedJobs = [];
  const removedTabs = [];
  const fakeChrome = {
    tabs: {
      async query() {
        return [{ id: 104, url: 'https://example.com/read' }];
      },
      async remove(tabId) {
        removedTabs.push(tabId);
      },
    },
    action: {
      async setBadgeText() {},
      async setIcon() {},
    },
  };
  const fakeArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return { id: 'article-delete-1', lifecycle_state: 'active' };
    },
    async deleteArticlePermanently(articleId) {
      deletedArticles.push(articleId);
    },
  };
  const fakeJobsRepo = {
    async getJobByArticleId(articleId) {
      assertEqual(articleId, 'article-delete-1');
      return { id: 'job-delete-1', article_id: articleId };
    },
    async deleteJob(jobId) {
      deletedJobs.push(jobId);
    },
  };

  const result = await controller.deleteCurrentTabArticleAndClose(fakeChrome, fakeArticlesRepo, fakeJobsRepo);

  assertDeepEqual(deletedJobs, ['job-delete-1']);
  assertDeepEqual(deletedArticles, ['article-delete-1']);
  assertDeepEqual(removedTabs, [104]);
  assertEqual(result.articleId, 'article-delete-1');
});
