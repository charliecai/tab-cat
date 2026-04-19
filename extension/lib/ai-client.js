/**
 * SECURITY INVARIANT:
 * This module is background-only. Never import it from a content script because
 * it reads provider credentials and issues network requests with the API key.
 */
(function () {
  const namespace = (globalThis.TabOutAiClient = globalThis.TabOutAiClient || {});

  function normalizeBaseUrl(baseUrl) {
    return (baseUrl || '').trim().replace(/\/+$/, '');
  }

  function validateAiSettings(settings) {
    const normalizedBaseUrl = normalizeBaseUrl(settings && settings.base_url);
    const errors = [];

    if (!normalizedBaseUrl) errors.push('Missing Base URL');
    if (!settings || !settings.api_key) errors.push('Missing API Key');
    if (!settings || !settings.model_id) errors.push('Missing Model ID');

    let host = null;
    if (normalizedBaseUrl) {
      try {
        const parsed = new URL(normalizedBaseUrl);
        host = parsed.host;
        if (parsed.protocol !== 'https:') {
          errors.push('Base URL must use https://');
        }
      } catch {
        errors.push('Base URL must be a valid URL');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      host,
      normalizedSettings: {
        base_url: normalizedBaseUrl,
        api_key: settings && settings.api_key ? settings.api_key : '',
        model_id: settings && settings.model_id ? settings.model_id : '',
      },
    };
  }

  function buildChatCompletionsRequest(settings, input) {
    const validation = validateAiSettings(settings);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    return {
      url: `${validation.normalizedSettings.base_url}/chat/completions`,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validation.normalizedSettings.api_key}`,
        },
        body: JSON.stringify({
          model: validation.normalizedSettings.model_id,
          messages: input.messages,
          temperature: typeof input.temperature === 'number' ? input.temperature : 0.2,
          max_tokens: typeof input.max_tokens === 'number' ? input.max_tokens : 800,
          response_format: input.response_format || { type: 'json_object' },
        }),
      },
    };
  }

  async function sendChatCompletion(settings, input) {
    const request = buildChatCompletionsRequest(settings, input);
    const response = await fetch(request.url, request.options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload.error && payload.error.message ? payload.error.message : `Provider error (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function extractFirstText(payload) {
    return payload &&
      payload.choices &&
      payload.choices[0] &&
      payload.choices[0].message &&
      payload.choices[0].message.content
      ? payload.choices[0].message.content
      : '';
  }

  async function testConnection(settings) {
    const payload = await sendChatCompletion(settings, {
      messages: [{ role: 'user', content: 'Respond with {"ok":true} and nothing else.' }],
      max_tokens: 20,
      temperature: 0,
    });
    return {
      ok: true,
      payload,
      text: extractFirstText(payload),
    };
  }

  namespace.normalizeBaseUrl = normalizeBaseUrl;
  namespace.validateAiSettings = validateAiSettings;
  namespace.buildChatCompletionsRequest = buildChatCompletionsRequest;
  namespace.sendChatCompletion = sendChatCompletion;
  namespace.extractFirstText = extractFirstText;
  namespace.testConnection = testConnection;
})();
