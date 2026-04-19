test('validateAiSettings requires base url key and model', () => {
  const result = globalThis.TabOutAiClient.validateAiSettings({
    base_url: '',
    api_key: '',
    model_id: '',
  });

  assertEqual(result.isValid, false);
  assertEqual(result.errors.length, 3);
});

test('buildChatCompletionsRequest builds a compatible request payload', () => {
  const request = globalThis.TabOutAiClient.buildChatCompletionsRequest(
    {
      base_url: 'https://api.example.com/v1',
      api_key: 'secret',
      model_id: 'model-x',
    },
    {
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 12,
    }
  );

  assertEqual(request.url, 'https://api.example.com/v1/chat/completions');
  const body = JSON.parse(request.options.body);
  assertEqual(body.model, 'model-x');
  assertEqual(body.messages[0].content, 'Hello');
  assertEqual(body.max_tokens, 12);
});
