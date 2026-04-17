test('analyzeArticleResponse normalizes summary fields', () => {
  const result = analyzeArticleResponse({
    summary_short: 'Short summary',
    main_topic_label: 'AI workflow',
    recommended_action: 'read_now',
  });

  assertDeepEqual(result, {
    summaryShort: 'Short summary',
    mainTopicLabel: 'AI workflow',
    recommendedAction: 'read_now',
    whyRecommended: null,
    subAngles: [],
    keywords: [],
    readingQuestion: null,
    contentType: null,
    noveltyScore: null,
    duplicateCandidates: [],
  });
});
