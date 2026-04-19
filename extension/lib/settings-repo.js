(function () {
  const namespace = (globalThis.TabOutSettingsRepo = globalThis.TabOutSettingsRepo || {});
  const SETTINGS_KEY = 'tabout_ai_settings';
  const STATUS_KEY = 'tabout_ai_status';

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

  namespace.getAiSettings = getAiSettings;
  namespace.saveAiSettings = saveAiSettings;
  namespace.getAiStatus = getAiStatus;
  namespace.saveAiStatus = saveAiStatus;
})();
