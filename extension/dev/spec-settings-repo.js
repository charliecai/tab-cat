test('settings repo defaults language_preference to auto and round-trips saved values', async () => {
  const store = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: store[key] };
        },
        async set(payload) {
          Object.assign(store, payload);
        },
      },
    },
  };

  const empty = await globalThis.TabOutSettingsRepo.getAiSettings();
  assertDeepEqual(empty, {
    base_url: '',
    api_key: '',
    model_id: '',
    language_preference: 'auto',
  });

  await globalThis.TabOutSettingsRepo.saveAiSettings({
    base_url: 'https://api.example.com/v1',
    api_key: 'secret',
    model_id: 'gpt-4.1-mini',
    language_preference: 'zh-CN',
  });

  const saved = await globalThis.TabOutSettingsRepo.getAiSettings();
  assertEqual(saved.base_url, 'https://api.example.com/v1');
  assertEqual(saved.api_key, 'secret');
  assertEqual(saved.model_id, 'gpt-4.1-mini');
  assertEqual(saved.language_preference, 'zh-CN');
});
