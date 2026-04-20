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
});
