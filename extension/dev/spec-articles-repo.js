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
