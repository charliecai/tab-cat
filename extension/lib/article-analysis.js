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
      summaryShort: payload.summary_short || payload.summaryShort || null,
      mainTopicLabel: payload.main_topic_label || payload.mainTopicLabel || null,
      recommendedAction: payload.recommended_action || payload.recommendedAction || null,
      whyRecommended: payload.why_recommended || payload.whyRecommended || null,
      subAngles: payload.sub_angles || payload.subAngles || [],
      keywords: payload.keywords || [],
      readingQuestion: payload.reading_question || payload.readingQuestion || null,
      contentType: payload.content_type || payload.contentType || null,
      noveltyScore: payload.novelty_score || payload.noveltyScore || null,
      duplicateCandidates: payload.duplicate_candidates || payload.duplicateCandidates || [],
    };
  }

  function buildAnalysisPrompt(markdown, metadata) {
    return [
      'You are analyzing one saved article for a browser reading inbox.',
      'Return strict JSON with snake_case keys:',
      'summary_short, main_topic_label, recommended_action, why_recommended, sub_angles, keywords, reading_question, content_type, novelty_score, duplicate_candidates.',
      `Title: ${metadata.title || ''}`,
      `URL: ${metadata.url || ''}`,
      '',
      markdown.slice(0, 12000),
    ].join('\n');
  }

  async function analyzeArticle(markdown, metadata, settings) {
    const payload = await globalThis.TabOutAiClient.sendChatCompletion(settings, {
      messages: [
        {
          role: 'user',
          content: buildAnalysisPrompt(markdown, metadata),
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
  namespace.analyzeArticle = analyzeArticle;
  globalThis.analyzeArticleResponse = analyzeArticleResponse;
})();
