(function () {
  const namespace = (globalThis.TabOutBackupService = globalThis.TabOutBackupService || {});

  const APP_NAME = 'tab-out';
  const FORMAT_VERSION = 1;

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function assertBackup(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function normalizeSnapshot(snapshot) {
    assertBackup(isPlainObject(snapshot), 'Backup file must be a JSON object.');
    assertBackup(snapshot.app === APP_NAME, `Backup file is not for ${APP_NAME}.`);
    assertBackup(
      snapshot.format_version === FORMAT_VERSION,
      `Backup format version ${snapshot.format_version} is not supported.`
    );

    const data = snapshot.data;
    assertBackup(isPlainObject(data), 'Backup file is missing the data payload.');

    const storage = data.storage;
    const indexeddb = data.indexeddb;
    assertBackup(isPlainObject(storage), 'Backup file is missing storage data.');
    assertBackup(isPlainObject(indexeddb), 'Backup file is missing IndexedDB data.');

    assertBackup(
      isPlainObject(storage.tabout_ai_settings),
      'Backup file is missing AI settings.'
    );
    assertBackup(
      isPlainObject(storage.tabout_ai_status),
      'Backup file is missing AI status.'
    );
    assertBackup(
      Array.isArray(storage.deferred),
      'Backup file is missing deferred items.'
    );
    assertBackup(Array.isArray(indexeddb.articles), 'Backup file is missing articles.');
    assertBackup(Array.isArray(indexeddb.topics), 'Backup file is missing topics.');
    assertBackup(
      Array.isArray(indexeddb.pinned_entries),
      'Backup file is missing pinned entries.'
    );
    assertBackup(Array.isArray(indexeddb.jobs), 'Backup file is missing jobs.');

    return {
      format_version: FORMAT_VERSION,
      exported_at:
        typeof snapshot.exported_at === 'string' && snapshot.exported_at
          ? snapshot.exported_at
          : new Date().toISOString(),
      app: APP_NAME,
      data: {
        storage: {
          tabout_ai_settings: storage.tabout_ai_settings,
          tabout_ai_status: storage.tabout_ai_status,
          deferred: storage.deferred,
        },
        indexeddb: {
          articles: indexeddb.articles,
          topics: indexeddb.topics,
          pinned_entries: indexeddb.pinned_entries,
          jobs: indexeddb.jobs,
        },
      },
    };
  }

  async function exportSnapshot() {
    assertBackup(globalThis.TabOutSettingsRepo, 'Settings repository is not available.');
    assertBackup(globalThis.TabOutArticlesRepo, 'Articles repository is not available.');
    assertBackup(globalThis.TabOutTopicsRepo, 'Topics repository is not available.');
    assertBackup(globalThis.TabOutPinnedRepo, 'Pinned repository is not available.');
    assertBackup(globalThis.TabOutJobsRepo, 'Jobs repository is not available.');

    const [storage, articles, topics, pinnedEntries, jobs] = await Promise.all([
      globalThis.TabOutSettingsRepo.exportManagedStorage(),
      globalThis.TabOutArticlesRepo.listArticles(),
      globalThis.TabOutTopicsRepo.listTopics(),
      globalThis.TabOutPinnedRepo.listPinnedEntries(),
      globalThis.TabOutJobsRepo.listJobs(),
    ]);

    return {
      format_version: FORMAT_VERSION,
      exported_at: new Date().toISOString(),
      app: APP_NAME,
      data: {
        storage,
        indexeddb: {
          articles,
          topics,
          pinned_entries: pinnedEntries,
          jobs,
        },
      },
    };
  }

  async function restoreSnapshot(snapshot) {
    assertBackup(globalThis.TabOutSettingsRepo, 'Settings repository is not available.');
    assertBackup(globalThis.TabOutDb, 'Database helpers are not available.');
    const normalized = normalizeSnapshot(snapshot);

    await globalThis.TabOutSettingsRepo.replaceManagedStorage(normalized.data.storage);

    try {
      await globalThis.TabOutDb.replaceStores(normalized.data.indexeddb);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Restore incomplete: ${message}`);
    }

    return normalized;
  }

  function buildBackupFilename(exportedAt) {
    const source =
      typeof exportedAt === 'string' && exportedAt ? new Date(exportedAt) : new Date();
    const safeTimestamp = source
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z')
      .replace(/:/g, '-');
    return `tab-out-backup-${safeTimestamp}.json`;
  }

  namespace.APP_NAME = APP_NAME;
  namespace.FORMAT_VERSION = FORMAT_VERSION;
  namespace.validateSnapshot = normalizeSnapshot;
  namespace.exportSnapshot = exportSnapshot;
  namespace.restoreSnapshot = restoreSnapshot;
  namespace.buildBackupFilename = buildBackupFilename;
})();
