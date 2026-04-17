(function () {
  const namespace = (globalThis.TabOutTopicSummary = globalThis.TabOutTopicSummary || {});

  function buildTopicSummaryViewModel(input) {
    const articles = input.articles || [];
    const topics = input.topics || [];
    const selectedArticleId = input.selectedArticleId || null;

    if (!articles.length) {
      return {
        kind: 'empty',
        title: 'Topic overview',
        lead: 'Nothing saved yet.',
        body: 'Save an article from Now and topic guidance will appear here.',
      };
    }

    const selectedArticle =
      articles.find((article) => article.id === selectedArticleId) ||
      articles.find((article) => article.main_topic_id) ||
      articles[0];

    if (!selectedArticle.main_topic_id) {
      return {
        kind: 'fallback',
        title: 'Topic overview',
        lead: 'Content is saved, but topic guidance is waiting on analysis or AI configuration.',
        body: 'The left queue still tracks the item so you can retry or continue once analysis is available.',
      };
    }

    const topic = topics.find((item) => item.id === selectedArticle.main_topic_id) || null;
    const topicArticles = articles.filter((article) => article.main_topic_id === selectedArticle.main_topic_id);

    return {
      kind: 'topic',
      title: topic?.title || selectedArticle.main_topic_label || 'Topic',
      lead: topic?.one_line_digest || selectedArticle.summary_short || 'A lightweight topic view derived from analyzed articles.',
      body: selectedArticle.why_recommended || 'Use this panel to decide what to read next, not to dump full article detail.',
      representativeArticles: topicArticles.slice(0, 3).map((article) => ({
        id: article.id,
        title: article.title,
      })),
      suggestedAction: selectedArticle.recommended_action || 'Review the freshest article in this topic.',
      relatedTopics: topic?.related_topics || [],
    };
  }

  namespace.buildTopicSummaryViewModel = buildTopicSummaryViewModel;
})();
