(function () {
  const namespace = (globalThis.TabOutTopicEngine = globalThis.TabOutTopicEngine || {});

  function normalize(value) {
    return (value || '').trim().toLowerCase();
  }

  function scoreTopicFit(analysis, topic) {
    let score = 0;
    if (normalize(analysis.mainTopicLabel) && normalize(analysis.mainTopicLabel) === normalize(topic.title)) {
      score += 3;
    }
    if (
      normalize(analysis.readingQuestion) &&
      normalize(analysis.readingQuestion) === normalize(topic.readingQuestion || topic.reading_question)
    ) {
      score += 2;
    }
    if (
      normalize(analysis.mainTopicLabel) &&
      normalize(topic.title).includes(normalize(analysis.mainTopicLabel))
    ) {
      score += 1;
    }
    return score;
  }

  function matchTopic(analysis, candidateTopics) {
    const topics = candidateTopics || [];
    let winner = null;
    let winnerScore = -1;

    topics.forEach((topic) => {
      const score = scoreTopicFit(analysis, topic);
      if (score > winnerScore) {
        winner = topic;
        winnerScore = score;
      }
    });

    if (winner && winnerScore >= 3) {
      return {
        matchType: 'existing',
        topicId: winner.id,
        score: winnerScore,
      };
    }

    return {
      matchType: 'new',
      topicId: null,
      score: winnerScore,
    };
  }

  function seedTopicFromArticle(articleAnalysis) {
    return {
      title: articleAnalysis.mainTopicLabel || 'Untitled topic',
      one_line_digest: articleAnalysis.summaryShort || null,
      reading_question: articleAnalysis.readingQuestion || null,
      article_count: 1,
      related_topics: [],
      representative_article_ids: [],
    };
  }

  namespace.matchTopic = matchTopic;
  namespace.seedTopicFromArticle = seedTopicFromArticle;
  namespace.scoreTopicFit = scoreTopicFit;
  globalThis.matchTopic = matchTopic;
})();
