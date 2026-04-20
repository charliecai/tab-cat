test('articles repo createArticleRecord persists delayed-close flag as boolean', () => {
  const record = globalThis.TabOutArticlesRepo.createArticleRecord({
    url: 'https://example.com/post',
    title: 'Example',
    close_source_tab_after_capture: true,
  });

  assertEqual(record.close_source_tab_after_capture, true);
  assertEqual(record.processing_state, 'queued');
  assertEqual(record.lifecycle_state, 'active');
});

test('articles repo createArticleRecord defaults delayed-close flag to false', () => {
  const record = globalThis.TabOutArticlesRepo.createArticleRecord({
    url: 'https://example.com/post',
    title: 'Example',
  });

  assertEqual(record.close_source_tab_after_capture, false);
});

test('articles repo createArticleRecord defaults queue metadata fields for filter-first inbox rendering', () => {
  const record = globalThis.TabOutArticlesRepo.createArticleRecord({
    url: 'https://example.com/post',
    title: 'Example',
  });

  assertDeepEqual(record.labels, []);
  assertEqual(record.priority_bucket, null);
  assertEqual(record.short_reason, null);
  assertEqual(record.analysis_source_text, null);
  assertEqual(record.capture_source, null);
});

test('articles repo listArticles removes legacy archived rows on first read', async () => {
  const active = globalThis.TabOutArticlesRepo.createArticleRecord({
    url: 'https://example.com/active',
    title: 'Active article',
  });
  const archived = {
    ...globalThis.TabOutArticlesRepo.createArticleRecord({
      url: 'https://example.com/archive',
      title: 'Archived article',
    }),
    id: 'archived-1',
    lifecycle_state: 'archived',
  };

  try {
    await globalThis.TabOutDb.replaceStores({
      articles: [active, archived],
      topics: [],
      pinned_entries: [],
      jobs: [],
    });

    const rows = await globalThis.TabOutArticlesRepo.listArticles();
    const persistedRows = await globalThis.TabOutDb.runTransaction(
      globalThis.TabOutSchema.STORES.articles,
      'readonly',
      async (stores) => {
        return globalThis.TabOutDb.requestToPromise(
          stores[globalThis.TabOutSchema.STORES.articles].getAll()
        );
      }
    );

    assertDeepEqual(rows.map((row) => row.id), [active.id]);
    assertDeepEqual(persistedRows.map((row) => row.id), [active.id]);
  } finally {
    await globalThis.TabOutDb.replaceStores({
      articles: [],
      topics: [],
      pinned_entries: [],
      jobs: [],
    });
  }
});
