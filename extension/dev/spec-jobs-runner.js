test('computeJobTransition rolls assigning back to analyzed checkpoint', () => {
  const result = computeJobTransition({
    type: 'rollback_stuck_job',
    processingState: 'assigning',
  });

  assertDeepEqual(result, {
    processingState: 'analyzed',
    retryable: true,
  });
});

test('computeJobTransition marks capture success as captured', () => {
  const result = computeJobTransition({
    type: 'capture_succeeded',
    markdown: '# Hello',
  });

  assertDeepEqual(result, {
    processingState: 'captured',
    retryable: false,
    markdown: '# Hello',
  });
});

test('kick classifies assignment errors as assignment_failed after analysis succeeds', async () => {
  let storedJob = {
    id: 'job-1',
    article_id: 'article-1',
    processing_state: 'captured',
    attempt_count: 0,
    updated_at: new Date(0).toISOString(),
  };

  const article = {
    id: 'article-1',
    lifecycle_state: 'active',
    processing_state: 'captured',
    markdown_content: '# Draft',
    summary_short: null,
    main_topic_label: null,
    recommended_action: null,
    why_recommended: null,
    sub_angles: [],
    keywords: [],
    reading_question: null,
    content_type: null,
    novelty_score: null,
    duplicate_candidates: [],
  };

  let finalFailureState = null;

  globalThis.chrome = {
    runtime: {
      sendMessage: async () => ({}),
    },
  };

  globalThis.TabOutArticlesRepo = {
    async getArticleById() {
      return article;
    },
    async updateArticleProcessingState(_articleId, processingState) {
      article.processing_state = processingState;
    },
    async updateArticle(_articleId, patch) {
      Object.assign(article, patch);
      if (patch.processing_state && patch.processing_state.endsWith('_failed')) {
        finalFailureState = patch.processing_state;
      }
      return article;
    },
  };

  globalThis.TabOutJobsRepo = {
    async listJobs() {
      return [{ ...storedJob }];
    },
    async getJobByArticleId() {
      return { ...storedJob };
    },
    async updateJob(_jobId, patch) {
      storedJob = {
        ...storedJob,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      if (patch.processing_state && patch.processing_state.endsWith('_failed')) {
        finalFailureState = patch.processing_state;
      }
      return { ...storedJob };
    },
    async deleteJob() {},
  };

  globalThis.TabOutSettingsRepo = {
    async getAiSettings() {
      return {
        base_url: 'https://api.example.com/v1',
        api_key: 'secret',
        model_id: 'model-x',
      };
    },
  };

  globalThis.TabOutAiClient = {
    validateAiSettings() {
      return { isValid: true, errors: [] };
    },
  };

  globalThis.TabOutArticleAnalysis = {
    async analyzeArticle() {
      return {
        summaryShort: 'Summary',
        recommendedAction: 'Read this',
        whyRecommended: 'Fresh context',
        subAngles: [],
        keywords: [],
        readingQuestion: null,
        contentType: 'article',
        noveltyScore: 0.7,
        duplicateCandidates: [],
      };
    },
  };

  globalThis.TabOutTopicsRepo = {
    async listTopics() {
      return [];
    },
    async upsertTopic() {
      throw Object.assign(new Error('assignment exploded'), { code: 'assignment_crash' });
    },
  };

  globalThis.TabOutTopicEngine = {
    matchTopic() {
      return {
        matchType: 'new',
        topicId: null,
      };
    },
    seedTopicFromArticle() {
      return { id: 'topic-1', title: 'Topic' };
    },
  };

  await globalThis.TabOutJobsRunner.kick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEqual(finalFailureState, 'assignment_failed');
  assertEqual(article.processing_state, 'assignment_failed');
  assertEqual(storedJob.processing_state, 'assignment_failed');
});
