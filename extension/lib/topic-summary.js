(function () {
  const namespace = (globalThis.TabOutTopicSummary = globalThis.TabOutTopicSummary || {});

  function t(key, params) {
    return globalThis.TabOutI18n ? globalThis.TabOutI18n.t(key, params) : key;
  }

  function buildTopicSummaryViewModel(input) {
    const articles = input.articles || [];
    const topics = input.topics || [];
    const selectedArticleId = input.selectedArticleId || null;

    if (!articles.length) {
      return {
        kind: 'empty',
        title: t('section.topicOverview'),
        lead: t('topic.emptyLead'),
        body: t('topic.emptyBody'),
      };
    }

    const selectedArticle =
      articles.find((article) => article.id === selectedArticleId) ||
      articles.find((article) => article.main_topic_id) ||
      articles[0];

    if (!selectedArticle.main_topic_id) {
      return {
        kind: 'fallback',
        title: t('section.topicOverview'),
        lead: t('topic.fallbackLead'),
        body: t('topic.fallbackBody'),
      };
    }

    const topic = topics.find((item) => item.id === selectedArticle.main_topic_id) || null;
    const topicArticles = articles.filter((article) => article.main_topic_id === selectedArticle.main_topic_id);

    return {
      kind: 'topic',
      title: topic?.title || selectedArticle.main_topic_label || t('topic.defaultTitle'),
      lead: topic?.one_line_digest || selectedArticle.summary_short || t('topic.defaultLead'),
      body: selectedArticle.why_recommended || t('topic.defaultBody'),
      representativeArticles: topicArticles.slice(0, 3).map((article) => ({
        id: article.id,
        title: article.title,
      })),
      suggestedAction: selectedArticle.recommended_action || t('topic.defaultAction'),
      relatedTopics: topic?.related_topics || [],
    };
  }

  namespace.buildTopicSummaryViewModel = buildTopicSummaryViewModel;
})();
