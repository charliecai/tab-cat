(function () {
  const namespace = (globalThis.TabOutSchema = globalThis.TabOutSchema || {});

  const DB_NAME = 'tab-out';
  const DB_VERSION = 2;

  const STORES = {
    articles: 'articles',
    topics: 'topics',
    pinnedEntries: 'pinned_entries',
    jobs: 'jobs',
  };

  function createStore(db, name, options) {
    if (db.objectStoreNames.contains(name)) {
      return db.transaction.objectStore(name);
    }

    return db.createObjectStore(name, options);
  }

  function createStores(db) {
    const articles = createStore(db, STORES.articles, { keyPath: 'id' });
    if (!articles.indexNames.contains('by_saved_at')) {
      articles.createIndex('by_saved_at', 'saved_at');
    }
    if (!articles.indexNames.contains('by_last_saved_at')) {
      articles.createIndex('by_last_saved_at', 'last_saved_at');
    }
    if (!articles.indexNames.contains('by_lifecycle_state')) {
      articles.createIndex('by_lifecycle_state', 'lifecycle_state');
    }
    if (!articles.indexNames.contains('by_processing_state')) {
      articles.createIndex('by_processing_state', 'processing_state');
    }
    if (!articles.indexNames.contains('by_canonical_url')) {
      articles.createIndex('by_canonical_url', 'canonical_url');
    }
    if (!articles.indexNames.contains('by_normalized_url')) {
      articles.createIndex('by_normalized_url', 'normalized_url');
    }
    const topics = createStore(db, STORES.topics, { keyPath: 'id' });
    if (!topics.indexNames.contains('by_title')) {
      topics.createIndex('by_title', 'title');
    }
    if (!topics.indexNames.contains('by_last_updated')) {
      topics.createIndex('by_last_updated', 'last_updated');
    }

    const pinnedEntries = createStore(db, STORES.pinnedEntries, { keyPath: 'id' });
    if (!pinnedEntries.indexNames.contains('by_order')) {
      pinnedEntries.createIndex('by_order', 'order');
    }

    const jobs = createStore(db, STORES.jobs, { keyPath: 'id' });
    if (!jobs.indexNames.contains('by_article_id')) {
      jobs.createIndex('by_article_id', 'article_id', { unique: true });
    }
    if (!jobs.indexNames.contains('by_processing_state')) {
      jobs.createIndex('by_processing_state', 'processing_state');
    }
    if (!jobs.indexNames.contains('by_updated_at')) {
      jobs.createIndex('by_updated_at', 'updated_at');
    }
  }

  function migrateSchema(db, oldVersion, newVersion) {
    if (oldVersion === 0 && newVersion >= 1) {
      createStores(db);
      return;
    }

    createStores(db);
  }

  namespace.DB_NAME = DB_NAME;
  namespace.DB_VERSION = DB_VERSION;
  namespace.STORES = STORES;
  namespace.createStores = createStores;
  namespace.migrateSchema = migrateSchema;
})();
