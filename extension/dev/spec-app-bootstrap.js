(function () {
  const noop = () => {};

  globalThis.chrome = globalThis.chrome || {};
  globalThis.chrome.runtime = {
    id: 'tabout-spec',
    getURL(path) {
      return path;
    },
    getPackageDirectoryEntry(callback) {
      callback(null);
    },
    onMessage: {
      addListener: noop,
    },
    sendMessage: async () => ({ ok: true }),
  };
  globalThis.chrome.tabs = {
    query: async () => [],
    update: async () => ({}),
    remove: async () => {},
    create: async () => ({}),
  };
  globalThis.chrome.windows = {
    getCurrent: async () => ({ id: 1 }),
    update: async () => ({}),
  };
  globalThis.chrome.storage = {
    local: {
      async get() {
        return {};
      },
      async set() {},
      async remove() {},
      async clear() {},
    },
  };

  const settingsRepo = (globalThis.TabOutSettingsRepo = globalThis.TabOutSettingsRepo || {});
  settingsRepo.getAiSettings =
    typeof settingsRepo.getAiSettings === 'function'
      ? settingsRepo.getAiSettings
      : async () => ({
      base_url: '',
      api_key: '',
      model_id: '',
      language_preference: 'zh-CN',
    });
  settingsRepo.getAiStatus =
    typeof settingsRepo.getAiStatus === 'function'
      ? settingsRepo.getAiStatus
      : async () => ({
      state: 'not_configured',
      host: '',
      last_error: null,
    });
  settingsRepo.saveAiSettings =
    typeof settingsRepo.saveAiSettings === 'function'
      ? settingsRepo.saveAiSettings
      : async () => {};
  settingsRepo.saveAiStatus =
    typeof settingsRepo.saveAiStatus === 'function'
      ? settingsRepo.saveAiStatus
      : async () => {};
  settingsRepo.exportManagedStorage =
    typeof settingsRepo.exportManagedStorage === 'function'
      ? settingsRepo.exportManagedStorage
      : async () => ({});
  settingsRepo.importManagedStorage =
    typeof settingsRepo.importManagedStorage === 'function'
      ? settingsRepo.importManagedStorage
      : async () => {};

  const articlesRepo = (globalThis.TabOutArticlesRepo = globalThis.TabOutArticlesRepo || {});
  articlesRepo.listArticles =
    typeof articlesRepo.listArticles === 'function' ? articlesRepo.listArticles : async () => [];
  articlesRepo.countActiveInboxItems =
    typeof articlesRepo.countActiveInboxItems === 'function'
      ? articlesRepo.countActiveInboxItems
      : async () => 0;
  articlesRepo.listArticlesByLifecycleState =
    typeof articlesRepo.listArticlesByLifecycleState === 'function'
      ? articlesRepo.listArticlesByLifecycleState
      : async () => [];
  articlesRepo.listRecentArticles =
    typeof articlesRepo.listRecentArticles === 'function'
      ? articlesRepo.listRecentArticles
      : async () => [];
  articlesRepo.markArticleRead =
    typeof articlesRepo.markArticleRead === 'function'
      ? articlesRepo.markArticleRead
      : async () => {};
  articlesRepo.getArticleById =
    typeof articlesRepo.getArticleById === 'function'
      ? articlesRepo.getArticleById
      : async () => null;
  articlesRepo.deleteArticlePermanently =
    typeof articlesRepo.deleteArticlePermanently === 'function'
      ? articlesRepo.deleteArticlePermanently
      : async () => {};
  articlesRepo.updateArticleProcessingState =
    typeof articlesRepo.updateArticleProcessingState === 'function'
      ? articlesRepo.updateArticleProcessingState
      : async () => {};

  const topicsRepo = (globalThis.TabOutTopicsRepo = globalThis.TabOutTopicsRepo || {});
  topicsRepo.listTopics =
    typeof topicsRepo.listTopics === 'function' ? topicsRepo.listTopics : async () => [];
  topicsRepo.deleteTopic =
    typeof topicsRepo.deleteTopic === 'function' ? topicsRepo.deleteTopic : async () => {};

  const jobsRepo = (globalThis.TabOutJobsRepo = globalThis.TabOutJobsRepo || {});
  jobsRepo.listJobs =
    typeof jobsRepo.listJobs === 'function' ? jobsRepo.listJobs : async () => [];
  jobsRepo.getJobByArticleId =
    typeof jobsRepo.getJobByArticleId === 'function'
      ? jobsRepo.getJobByArticleId
      : async () => null;
  jobsRepo.enqueueJob =
    typeof jobsRepo.enqueueJob === 'function' ? jobsRepo.enqueueJob : async () => {};
  jobsRepo.deleteJob =
    typeof jobsRepo.deleteJob === 'function' ? jobsRepo.deleteJob : async () => {};

  const backupService = (globalThis.TabOutBackupService =
    globalThis.TabOutBackupService || {});
  backupService.exportSnapshot =
    typeof backupService.exportSnapshot === 'function'
      ? backupService.exportSnapshot
      : async () => ({});
  backupService.importSnapshot =
    typeof backupService.importSnapshot === 'function'
      ? backupService.importSnapshot
      : async () => {};

  globalThis.TabOutTopicSummary = globalThis.TabOutTopicSummary || {
    buildTopicSummaryViewModel() {
      return {};
    },
  };

  globalThis.TabOutDigestRenderer = globalThis.TabOutDigestRenderer || {
    renderTopicSummaryPanel() {
      return '';
    },
  };
})();
