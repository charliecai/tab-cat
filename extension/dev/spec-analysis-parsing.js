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

test('analyzeArticle requests output in the configured UI language while keeping snake_case keys', async () => {
  let capturedPrompt = '';
  const originalSend = globalThis.TabOutAiClient.sendChatCompletion;

  globalThis.TabOutAiClient.sendChatCompletion = async (_settings, input) => {
    capturedPrompt = input.messages[0].content;
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary_short: '简短总结',
              main_topic_label: '主题',
              recommended_action: '继续阅读',
              why_recommended: '原因',
              sub_angles: [],
              keywords: [],
              reading_question: '问题',
              content_type: 'article',
              novelty_score: 0.5,
              duplicate_candidates: [],
            }),
          },
        },
      ],
    };
  };

  try {
    await globalThis.TabOutArticleAnalysis.analyzeArticle(
      '# Heading',
      { title: 'Example', url: 'https://example.com/post' },
      { language_preference: 'zh-CN' }
    );
  } finally {
    globalThis.TabOutAiClient.sendChatCompletion = originalSend;
  }

  if (!capturedPrompt.includes('snake_case')) {
    throw new Error('Prompt should explicitly require snake_case keys');
  }
  if (!capturedPrompt.includes('Simplified Chinese')) {
    throw new Error('Prompt should require Simplified Chinese output when zh-CN is selected');
  }
});
