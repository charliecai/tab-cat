test('analyzeArticleResponse normalizes queue metadata fields', () => {
  const result = analyzeArticleResponse({
    labels: ['agent', 'pricing'],
    priority_bucket: 'read_now',
    short_reason: 'Useful for the current queue because pricing changed.',
    reading_time_estimate: 8,
  });

  assertDeepEqual(result, {
    labels: ['agent', 'pricing'],
    priorityBucket: 'read_now',
    shortReason: 'Useful for the current queue because pricing changed.',
    readingTimeEstimate: 8,
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
              labels: ['代理', '定价'],
              priority_bucket: 'read_now',
              short_reason: '现在值得读，因为定价更新了。',
              reading_time_estimate: 6,
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
  if (!capturedPrompt.includes('labels, priority_bucket, short_reason, reading_time_estimate')) {
    throw new Error('Prompt should request queue metadata keys');
  }
});
