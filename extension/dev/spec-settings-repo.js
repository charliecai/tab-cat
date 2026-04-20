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

test('settings repo exports and replaces managed storage keys', async () => {
  const store = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (Array.isArray(keys)) {
            return keys.reduce((acc, key) => {
              acc[key] = store[key];
              return acc;
            }, {});
          }
          return { [keys]: store[keys] };
        },
        async set(payload) {
          Object.assign(store, payload);
        },
        async remove(keys) {
          for (const key of keys) {
            delete store[key];
          }
        },
      },
    },
  };

  const empty = await globalThis.TabOutSettingsRepo.exportManagedStorage();
  assertDeepEqual(empty, {
    tabout_ai_settings: {
      base_url: '',
      api_key: '',
      model_id: '',
      language_preference: 'auto',
    },
    tabout_ai_status: {
      state: 'not_configured',
      last_error: null,
      last_tested_at: null,
      host: null,
    },
    deferred: [],
  });

  const restored = await globalThis.TabOutSettingsRepo.replaceManagedStorage({
    tabout_ai_settings: {
      base_url: 'https://api.example.com/v1',
      api_key: 'secret',
      model_id: 'gpt-4.1-mini',
      language_preference: 'zh-CN',
    },
    tabout_ai_status: {
      state: 'ready',
      last_error: null,
      last_tested_at: '2026-04-19T00:00:00.000Z',
      host: 'api.example.com',
    },
    deferred: [{ id: 'saved_1', title: 'Saved tab' }],
  });

  assertEqual(restored.tabout_ai_settings.api_key, 'secret');
  assertEqual(restored.tabout_ai_status.state, 'ready');
  assertDeepEqual(restored.deferred, [{ id: 'saved_1', title: 'Saved tab' }]);

  const exported = await globalThis.TabOutSettingsRepo.exportManagedStorage();
  assertEqual(exported.tabout_ai_settings.model_id, 'gpt-4.1-mini');
  assertEqual(exported.tabout_ai_status.host, 'api.example.com');
  assertDeepEqual(exported.deferred, [{ id: 'saved_1', title: 'Saved tab' }]);
});
