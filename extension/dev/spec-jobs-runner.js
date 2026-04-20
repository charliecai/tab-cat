test('computeJobTransition rolls analyzing back to captured checkpoint', () => {
  const result = computeJobTransition({
    type: 'rollback_stuck_job',
    processingState: 'analyzing',
  });

  assertDeepEqual(result, {
    processingState: 'captured',
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

test('kick stores queue metadata and marks the article ready after analysis succeeds', async () => {
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
    labels: [],
    priority_bucket: null,
    short_reason: null,
    reading_time_estimate: null,
  };

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
        labels: ['agent', 'pricing'],
        priorityBucket: 'read_now',
        shortReason: 'Useful for the current queue because pricing changed.',
        readingTimeEstimate: 6,
      };
    },
  };

  await globalThis.TabOutJobsRunner.kick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertDeepEqual(article.labels, ['agent', 'pricing']);
  assertEqual(article.priority_bucket, 'read_now');
  assertEqual(article.short_reason, 'Useful for the current queue because pricing changed.');
  assertEqual(article.reading_time_estimate, 6);
  assertEqual(article.processing_state, 'ready');
  assertEqual(storedJob.processing_state, 'ready');
});

test('kick prefers analysis_source_text over markdown_content for lightweight analysis', async () => {
  let storedJob = {
    id: 'job-light-1',
    article_id: 'article-light-1',
    processing_state: 'captured',
    attempt_count: 0,
    updated_at: new Date(0).toISOString(),
  };
  const article = {
    id: 'article-light-1',
    lifecycle_state: 'active',
    processing_state: 'captured',
    markdown_content: '# Legacy full text',
    analysis_source_text: 'Lightweight analysis text',
    labels: [],
    priority_bucket: null,
    short_reason: null,
    reading_time_estimate: null,
  };
  let analyzedInput = null;

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
      return article;
    },
    async updateArticle(_articleId, patch) {
      Object.assign(article, patch);
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
    async analyzeArticle(input) {
      analyzedInput = input;
      return {
        labels: ['agent'],
        priorityBucket: 'read_now',
        shortReason: 'Useful right now.',
        readingTimeEstimate: 4,
      };
    },
  };

  await globalThis.TabOutJobsRunner.kick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEqual(analyzedInput, 'Lightweight analysis text');
  assertEqual(article.processing_state, 'ready');
});

test('kick marks captured articles as waiting_for_ai when AI settings are not configured', async () => {
  let storedJob = {
    id: 'job-waiting-ai-1',
    article_id: 'article-waiting-ai-1',
    processing_state: 'captured',
    attempt_count: 0,
    updated_at: new Date(0).toISOString(),
  };
  const article = {
    id: 'article-waiting-ai-1',
    lifecycle_state: 'active',
    processing_state: 'captured',
    markdown_content: '# Draft',
    analysis_source_text: 'Saved analysis source text',
    labels: [],
    priority_bucket: null,
    short_reason: null,
    reading_time_estimate: null,
    last_error_code: null,
    last_error_message: null,
  };

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
      return article;
    },
    async updateArticle(_articleId, patch) {
      Object.assign(article, patch);
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
      return { ...storedJob };
    },
    async deleteJob() {},
  };

  globalThis.TabOutSettingsRepo = {
    async getAiSettings() {
      return {
        base_url: '',
        api_key: '',
        model_id: '',
      };
    },
  };

  globalThis.TabOutAiClient = {
    validateAiSettings() {
      return {
        isValid: false,
        errors: ['Missing Base URL', 'Missing API Key', 'Missing Model ID'],
      };
    },
  };

  globalThis.TabOutArticleAnalysis = {
    async analyzeArticle() {
      throw new Error('analyzeArticle should not run when AI settings are missing');
    },
  };

  await globalThis.TabOutJobsRunner.kick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEqual(article.processing_state, 'waiting_for_ai');
  assertEqual(storedJob.processing_state, 'waiting_for_ai');
  assertEqual(storedJob.next_retry_at || null, null);
  assertEqual(article.last_error_code, null);
});

test('kick closes the source tab after capture succeeds for background tabs', async () => {
  let storedJob = {
    id: 'job-close-bg',
    article_id: 'article-close-bg',
    processing_state: 'queued',
    attempt_count: 0,
    updated_at: new Date(0).toISOString(),
  };
  const article = {
    id: 'article-close-bg',
    lifecycle_state: 'active',
    processing_state: 'queued',
    source_ref: '99',
    close_source_tab_after_capture: true,
    markdown_content: null,
    labels: [],
    priority_bucket: null,
    short_reason: null,
    reading_time_estimate: null,
  };
  let removedTabId = null;

  globalThis.chrome = {
    runtime: {
      sendMessage: async () => ({}),
    },
    tabs: {
      async get(tabId) {
        return { id: tabId, active: false };
      },
      async remove(tabId) {
        removedTabId = tabId;
      },
    },
  };

  globalThis.TabOutArticlesRepo = {
    async getArticleById() {
      return article;
    },
    async updateArticleProcessingState(_articleId, processingState) {
      article.processing_state = processingState;
      return article;
    },
    async updateArticle(_articleId, patch) {
      Object.assign(article, patch);
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
      return { ...storedJob };
    },
    async deleteJob() {},
  };

  globalThis.TabOutCapture = {
    async captureArticle() {
      return {
        markdown: '# Captured',
        excerpt: 'Excerpt',
        word_count: 120,
        language: 'en',
        author: 'Author',
        lead_image_url: null,
      };
    },
  };

  globalThis.TabOutSettingsRepo = {
    async getAiSettings() {
      return {
        base_url: '',
        api_key: '',
        model_id: '',
      };
    },
  };

  globalThis.TabOutAiClient = {
    validateAiSettings() {
      return { isValid: false, errors: ['missing settings'] };
    },
  };

  await globalThis.TabOutJobsRunner.kick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEqual(removedTabId, 99);
  assertEqual(article.close_source_tab_after_capture, false);
});

test('kick keeps the source tab open when capture succeeds on an active tab', async () => {
  let storedJob = {
    id: 'job-close-active',
    article_id: 'article-close-active',
    processing_state: 'queued',
    attempt_count: 0,
    updated_at: new Date(0).toISOString(),
  };
  const article = {
    id: 'article-close-active',
    lifecycle_state: 'active',
    processing_state: 'queued',
    source_ref: '77',
    close_source_tab_after_capture: true,
    markdown_content: null,
    labels: [],
    priority_bucket: null,
    short_reason: null,
    reading_time_estimate: null,
  };
  let removedTabId = null;

  globalThis.chrome = {
    runtime: {
      sendMessage: async () => ({}),
    },
    tabs: {
      async get(tabId) {
        return { id: tabId, active: true };
      },
      async remove(tabId) {
        removedTabId = tabId;
      },
    },
  };

  globalThis.TabOutArticlesRepo = {
    async getArticleById() {
      return article;
    },
    async updateArticleProcessingState(_articleId, processingState) {
      article.processing_state = processingState;
      return article;
    },
    async updateArticle(_articleId, patch) {
      Object.assign(article, patch);
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
      return { ...storedJob };
    },
    async deleteJob() {},
  };

  globalThis.TabOutCapture = {
    async captureArticle() {
      return {
        markdown: '# Captured',
        excerpt: 'Excerpt',
        word_count: 120,
        language: 'en',
        author: 'Author',
        lead_image_url: null,
      };
    },
  };

  globalThis.TabOutSettingsRepo = {
    async getAiSettings() {
      return {
        base_url: '',
        api_key: '',
        model_id: '',
      };
    },
  };

  globalThis.TabOutAiClient = {
    validateAiSettings() {
      return { isValid: false, errors: ['missing settings'] };
    },
  };

  await globalThis.TabOutJobsRunner.kick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEqual(removedTabId, null);
  assertEqual(article.close_source_tab_after_capture, false);
});
