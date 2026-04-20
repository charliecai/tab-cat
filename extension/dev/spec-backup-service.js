test('backup service exports a full snapshot including AI settings and indexeddb stores', async () => {
  const originalSettingsRepo = globalThis.TabOutSettingsRepo;
  const originalArticlesRepo = globalThis.TabOutArticlesRepo;
  const originalTopicsRepo = globalThis.TabOutTopicsRepo;
  const originalPinnedRepo = globalThis.TabOutPinnedRepo;
  const originalJobsRepo = globalThis.TabOutJobsRepo;

  globalThis.TabOutSettingsRepo = {
    async exportManagedStorage() {
      return {
        tabout_ai_settings: {
          base_url: 'https://api.example.com/v1',
          api_key: 'secret-key',
          model_id: 'gpt-4.1-mini',
          language_preference: 'zh-CN',
        },
        tabout_ai_status: {
          state: 'ready',
          host: 'api.example.com',
          last_error: null,
          last_tested_at: '2026-04-19T10:00:00.000Z',
        },
        deferred: [{ id: 'deferred-1', title: 'Saved tab' }],
      };
    },
  };
  globalThis.TabOutArticlesRepo = { async listArticles() { return [{ id: 'article-1', title: 'Article' }]; } };
  globalThis.TabOutTopicsRepo = { async listTopics() { return [{ id: 'topic-1', title: 'Topic' }]; } };
  globalThis.TabOutPinnedRepo = { async listPinnedEntries() { return [{ id: 'pin-1', title: 'Pinned' }]; } };
  globalThis.TabOutJobsRepo = { async listJobs() { return [{ id: 'job-1', article_id: 'article-1' }]; } };

  try {
    const snapshot = await globalThis.TabOutBackupService.exportSnapshot();

    assertEqual(snapshot.format_version, 1);
    assertEqual(snapshot.app, 'tab-out');
    assertEqual(snapshot.data.storage.tabout_ai_settings.api_key, 'secret-key');
    assertDeepEqual(snapshot.data.storage.deferred, [{ id: 'deferred-1', title: 'Saved tab' }]);
    assertDeepEqual(snapshot.data.indexeddb.articles, [{ id: 'article-1', title: 'Article' }]);
    assertDeepEqual(snapshot.data.indexeddb.topics, [{ id: 'topic-1', title: 'Topic' }]);
    assertDeepEqual(snapshot.data.indexeddb.pinned_entries, [{ id: 'pin-1', title: 'Pinned' }]);
    assertDeepEqual(snapshot.data.indexeddb.jobs, [{ id: 'job-1', article_id: 'article-1' }]);
  } finally {
    globalThis.TabOutSettingsRepo = originalSettingsRepo;
    globalThis.TabOutArticlesRepo = originalArticlesRepo;
    globalThis.TabOutTopicsRepo = originalTopicsRepo;
    globalThis.TabOutPinnedRepo = originalPinnedRepo;
    globalThis.TabOutJobsRepo = originalJobsRepo;
  }
});

test('backup service rejects malformed import payloads before mutating data', async () => {
  let mutated = false;
  const originalSettingsRepo = globalThis.TabOutSettingsRepo;
  const originalDb = globalThis.TabOutDb;

  globalThis.TabOutSettingsRepo = {
    async replaceManagedStorage() {
      mutated = true;
    },
  };
  globalThis.TabOutDb = {
    ...originalDb,
    async replaceStores() {
      mutated = true;
    },
  };

  try {
    let error = null;
    try {
      await globalThis.TabOutBackupService.restoreSnapshot({
        format_version: 1,
        app: 'wrong-app',
        data: {},
      });
    } catch (currentError) {
      error = currentError;
    }

    assertEqual(Boolean(error), true);
    assertEqual(error.message.includes('tab-out'), true);
    assertEqual(mutated, false);
  } finally {
    globalThis.TabOutSettingsRepo = originalSettingsRepo;
    globalThis.TabOutDb = originalDb;
  }
});

test('backup service replace-all restore clears and rewrites managed storage and indexeddb stores', async () => {
  const calls = [];
  const originalSettingsRepo = globalThis.TabOutSettingsRepo;
  const originalDb = globalThis.TabOutDb;

  globalThis.TabOutSettingsRepo = {
    async replaceManagedStorage(payload) {
      calls.push({ type: 'storage', payload });
    },
  };
  globalThis.TabOutDb = {
    ...originalDb,
    async replaceStores(payload) {
      calls.push({ type: 'indexeddb', payload });
    },
  };

  const snapshot = {
    format_version: 1,
    exported_at: '2026-04-19T10:30:00.000Z',
    app: 'tab-out',
    data: {
      storage: {
        tabout_ai_settings: {
          base_url: 'https://api.example.com/v1',
          api_key: 'secret-key',
          model_id: 'gpt-4.1-mini',
          language_preference: 'en',
        },
        tabout_ai_status: {
          state: 'saved',
          host: 'api.example.com',
          last_error: null,
          last_tested_at: '2026-04-19T10:00:00.000Z',
        },
        deferred: [{ id: 'deferred-1' }],
      },
      indexeddb: {
        articles: [{ id: 'article-1' }],
        topics: [{ id: 'topic-1' }],
        pinned_entries: [{ id: 'pin-1' }],
        jobs: [{ id: 'job-1' }],
      },
    },
  };

  try {
    await globalThis.TabOutBackupService.restoreSnapshot(snapshot);

    assertDeepEqual(calls, [
      {
        type: 'storage',
        payload: snapshot.data.storage,
      },
      {
        type: 'indexeddb',
        payload: snapshot.data.indexeddb,
      },
    ]);
  } finally {
    globalThis.TabOutSettingsRepo = originalSettingsRepo;
    globalThis.TabOutDb = originalDb;
  }
});
