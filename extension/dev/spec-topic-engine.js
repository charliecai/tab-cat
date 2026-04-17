test('matchTopic prefers a clear existing topic match', () => {
  const result = matchTopic(
    {
      mainTopicLabel: 'AI coding workflow',
      readingQuestion: 'How are coding agents changing engineering workflow?',
    },
    [
      {
        id: 'topic-1',
        title: 'AI coding workflow',
        readingQuestion: 'How are coding agents changing engineering workflow?',
      },
      {
        id: 'topic-2',
        title: 'Model evaluation',
        readingQuestion: 'How should teams benchmark coding agents?',
      },
    ]
  );

  assertEqual(result.matchType, 'existing');
  assertEqual(result.topicId, 'topic-1');
});
