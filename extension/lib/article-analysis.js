(function () {
  const namespace = (globalThis.TabOutArticleAnalysis = globalThis.TabOutArticleAnalysis || {});

  function safeParseJson(input) {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  function analyzeArticleResponse(payload) {
    return {
      labels: Array.isArray(payload.labels) ? payload.labels : [],
      priorityBucket: payload.priority_bucket || payload.priorityBucket || null,
      shortReason: payload.short_reason || payload.shortReason || null,
      readingTimeEstimate:
        payload.reading_time_estimate || payload.readingTimeEstimate || null,
    };
  }

  function buildAnalysisPrompt(sourceText, metadata, settings) {
    const effectiveLanguage =
      globalThis.TabOutI18n &&
      typeof globalThis.TabOutI18n.resolveEffectiveLanguage === 'function'
        ? globalThis.TabOutI18n.resolveEffectiveLanguage(
            settings && settings.language_preference,
            (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
          )
        : 'en';
    const outputLanguage =
      effectiveLanguage === 'zh-CN' ? 'Simplified Chinese' : 'English';

    return [
      'You are analyzing one saved article for a browser reading inbox.',
      'Return strict JSON with snake_case keys:',
      'labels, priority_bucket, short_reason, reading_time_estimate.',
      'Keep every JSON key in English snake_case exactly as specified.',
      `All natural-language string values must be written in ${outputLanguage}.`,
      `Title: ${metadata.title || ''}`,
      `URL: ${metadata.url || ''}`,
      '',
      String(sourceText || '').slice(0, 4000),
    ].join('\n');
  }

  async function analyzeArticle(sourceText, metadata, settings) {
    const payload = await globalThis.TabOutAiClient.sendChatCompletion(settings, {
      messages: [
        {
          role: 'user',
          content: buildAnalysisPrompt(sourceText, metadata, settings),
        },
      ],
      max_tokens: 700,
      temperature: 0.1,
    });
    const text = globalThis.TabOutAiClient.extractFirstText(payload);
    const parsed = safeParseJson(text);
    if (!parsed) {
      const error = new Error('Analysis response was not valid JSON');
      error.code = 'invalid_analysis_payload';
      throw error;
    }
    return analyzeArticleResponse(parsed);
  }

  namespace.safeParseJson = safeParseJson;
  namespace.analyzeArticleResponse = analyzeArticleResponse;
  namespace.buildAnalysisPrompt = buildAnalysisPrompt;
  namespace.analyzeArticle = analyzeArticle;
  globalThis.analyzeArticleResponse = analyzeArticleResponse;
})();
