(function () {
  const namespace = (globalThis.TabOutSettingsRepo = globalThis.TabOutSettingsRepo || {});
  const SETTINGS_KEY = 'tabout_ai_settings';
  const STATUS_KEY = 'tabout_ai_status';
  const DEFERRED_KEY = 'deferred';
  const MANAGED_STORAGE_KEYS = [SETTINGS_KEY, STATUS_KEY, DEFERRED_KEY];

  async function getAiSettings() {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = stored[SETTINGS_KEY] || {
      base_url: '',
      api_key: '',
      model_id: '',
      language_preference: 'auto',
    };
    return {
      base_url: settings.base_url || '',
      api_key: settings.api_key || '',
      model_id: settings.model_id || '',
      language_preference: settings.language_preference || 'auto',
    };
  }

  async function saveAiSettings(settings) {
    const next = {
      base_url: settings.base_url || '',
      api_key: settings.api_key || '',
      model_id: settings.model_id || '',
      language_preference: settings.language_preference || 'auto',
      updated_at: new Date().toISOString(),
    };
    await chrome.storage.local.set({
      [SETTINGS_KEY]: next,
    });
    return next;
  }

  async function getAiStatus() {
    const stored = await chrome.storage.local.get(STATUS_KEY);
    return stored[STATUS_KEY] || {
      state: 'not_configured',
      last_error: null,
      last_tested_at: null,
      host: null,
    };
  }

  async function saveAiStatus(status) {
    const next = {
      state: status.state || 'not_configured',
      last_error: status.last_error || null,
      last_tested_at: status.last_tested_at || new Date().toISOString(),
      host: status.host || null,
    };
    await chrome.storage.local.set({
      [STATUS_KEY]: next,
    });
    return next;
  }

  async function exportManagedStorage() {
    const stored = await chrome.storage.local.get(MANAGED_STORAGE_KEYS);
    return {
      [SETTINGS_KEY]: stored[SETTINGS_KEY] || {
        base_url: '',
        api_key: '',
        model_id: '',
        language_preference: 'auto',
      },
      [STATUS_KEY]: stored[STATUS_KEY] || {
        state: 'not_configured',
        last_error: null,
        last_tested_at: null,
        host: null,
      },
      [DEFERRED_KEY]: Array.isArray(stored[DEFERRED_KEY]) ? stored[DEFERRED_KEY] : [],
    };
  }

  async function replaceManagedStorage(payload) {
    const next = {
      [SETTINGS_KEY]: payload && payload[SETTINGS_KEY] ? payload[SETTINGS_KEY] : {
        base_url: '',
        api_key: '',
        model_id: '',
        language_preference: 'auto',
      },
      [STATUS_KEY]: payload && payload[STATUS_KEY] ? payload[STATUS_KEY] : {
        state: 'not_configured',
        last_error: null,
        last_tested_at: null,
        host: null,
      },
      [DEFERRED_KEY]: payload && Array.isArray(payload[DEFERRED_KEY]) ? payload[DEFERRED_KEY] : [],
    };

    await chrome.storage.local.remove(MANAGED_STORAGE_KEYS);
    await chrome.storage.local.set(next);
    return next;
  }

  namespace.getAiSettings = getAiSettings;
  namespace.saveAiSettings = saveAiSettings;
  namespace.getAiStatus = getAiStatus;
  namespace.saveAiStatus = saveAiStatus;
  namespace.MANAGED_STORAGE_KEYS = MANAGED_STORAGE_KEYS;
  namespace.exportManagedStorage = exportManagedStorage;
  namespace.replaceManagedStorage = replaceManagedStorage;
})();
