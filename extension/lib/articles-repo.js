(function () {
  const namespace = (globalThis.TabOutArticlesRepo = globalThis.TabOutArticlesRepo || {});
  const { STORES } = globalThis.TabOutSchema;
  const { requestToPromise, runTransaction, generateId } = globalThis.TabOutDb;

  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return url || '';
    }
  }

  function createArticleRecord(input) {
    const now = new Date().toISOString();
    const normalizedUrl = normalizeUrl(input.url);
    return {
      id: generateId('article'),
      source_type: input.source_type || 'tab',
      source_ref: input.source_ref || null,
      url: input.url,
      canonical_url: input.canonical_url || normalizedUrl,
      normalized_url: normalizedUrl,
      title: input.title || input.url,
      site_name: input.site_name || '',
      author: input.author || null,
      published_at: input.published_at || null,
      saved_at: input.saved_at || now,
      last_saved_at: input.last_saved_at || now,
      markdown_content: input.markdown_content || null,
      analysis_source_text: input.analysis_source_text || null,
      excerpt: input.excerpt || null,
      lead_image_url: input.lead_image_url || null,
      word_count: input.word_count || null,
      language: input.language || null,
      capture_source: input.capture_source || null,
      labels: input.labels || [],
      priority_bucket: input.priority_bucket || null,
      short_reason: input.short_reason || null,
      summary_short: input.summary_short || null,
      main_topic_id: input.main_topic_id || null,
      main_topic_label: input.main_topic_label || null,
      sub_angles: input.sub_angles || [],
      keywords: input.keywords || [],
      reading_time_estimate: input.reading_time_estimate || null,
      content_type: input.content_type || null,
      novelty_score: input.novelty_score || null,
      actionability_score: input.actionability_score || null,
      duplicate_candidates: input.duplicate_candidates || [],
      recommended_action: input.recommended_action || null,
      why_recommended: input.why_recommended || null,
      best_reason_to_read: input.best_reason_to_read || null,
      best_reason_to_skip: input.best_reason_to_skip || null,
      lifecycle_state: input.lifecycle_state || 'active',
      processing_state: input.processing_state || 'queued',
      close_source_tab_after_capture: Boolean(input.close_source_tab_after_capture),
      last_analyzed_at: input.last_analyzed_at || null,
      last_opened_at: input.last_opened_at || null,
      last_error_code: input.last_error_code || null,
      last_error_message: input.last_error_message || null,
      created_at: now,
      updated_at: now,
    };
  }

  async function getArticleById(id) {
    return runTransaction(STORES.articles, 'readonly', async (stores) => {
      return requestToPromise(stores[STORES.articles].get(id));
    });
  }

  async function listArticles() {
    return runTransaction(STORES.articles, 'readonly', async (stores) => {
      return requestToPromise(stores[STORES.articles].getAll());
    });
  }

  async function listActiveArticles(options = {}) {
    return listArticlesByLifecycleState('active', options);
  }

  async function listArticlesByLifecycleState(lifecycleState, options = {}) {
    const sort = options.sort || 'saved_at_desc';
    const rows = await runTransaction(STORES.articles, 'readonly', async (stores) => {
      const index = stores[STORES.articles].index('by_lifecycle_state');
      return requestToPromise(index.getAll(lifecycleState));
    });

    return rows.sort((left, right) => {
      if (sort === 'saved_at_desc') {
        return new Date(right.saved_at).getTime() - new Date(left.saved_at).getTime();
      }
      if (sort === 'last_saved_at_desc') {
        return new Date(right.last_saved_at || right.saved_at).getTime() - new Date(left.last_saved_at || left.saved_at).getTime();
      }
      return 0;
    });
  }

  async function countActiveInboxItems() {
    const active = await listActiveArticles();
    return active.length;
  }

  async function findArticleByCanonicalUrl(url) {
    const normalizedUrl = normalizeUrl(url);
    return runTransaction(STORES.articles, 'readonly', async (stores) => {
      const canonicalIndex = stores[STORES.articles].index('by_canonical_url');
      const exact = await requestToPromise(canonicalIndex.get(normalizedUrl));
      if (exact) return exact;
      const normalizedIndex = stores[STORES.articles].index('by_normalized_url');
      return requestToPromise(normalizedIndex.get(normalizedUrl));
    });
  }

  async function createQueuedArticle(input) {
    const record = createArticleRecord({
      ...input,
      lifecycle_state: 'active',
      processing_state: 'queued',
    });

    await runTransaction(STORES.articles, 'readwrite', async (stores) => {
      stores[STORES.articles].put(record);
    });

    return record;
  }

  async function upsertArticle(article) {
    const next = {
      ...article,
      updated_at: new Date().toISOString(),
    };

    await runTransaction(STORES.articles, 'readwrite', async (stores) => {
      stores[STORES.articles].put(next);
    });

    return next;
  }

  async function updateArticle(id, updates) {
    return runTransaction(STORES.articles, 'readwrite', async (stores) => {
      const store = stores[STORES.articles];
      const article = await requestToPromise(store.get(id));
      if (!article) return null;
      const next = {
        ...article,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      store.put(next);
      return next;
    });
  }

  async function updateArticleLifecycleState(id, lifecycleState) {
    return updateArticle(id, { lifecycle_state: lifecycleState });
  }

  async function updateArticleProcessingState(id, processingState, details) {
    const updates = {
      processing_state: processingState,
      last_error_code: details && details.last_error_code ? details.last_error_code : null,
      last_error_message: details && details.last_error_message ? details.last_error_message : null,
    };

    if (processingState === 'analyzed' || processingState === 'assigned' || processingState === 'ready') {
      updates.last_analyzed_at = new Date().toISOString();
    }

    return updateArticle(id, updates);
  }

  async function refreshArticleSavedAt(id) {
    const now = new Date().toISOString();
    return updateArticle(id, { last_saved_at: now });
  }

  async function markArticleRead(id) {
    return updateArticleLifecycleState(id, 'read');
  }

  async function markArticleArchived(id) {
    return updateArticleLifecycleState(id, 'archived');
  }

  async function markArticleDeleted(id) {
    return updateArticleLifecycleState(id, 'deleted');
  }

  async function deleteArticlePermanently(id) {
    await runTransaction(STORES.articles, 'readwrite', async (stores) => {
      stores[STORES.articles].delete(id);
    });
  }

  namespace.normalizeUrl = normalizeUrl;
  namespace.createArticleRecord = createArticleRecord;
  namespace.getArticleById = getArticleById;
  namespace.listArticles = listArticles;
  namespace.listActiveArticles = listActiveArticles;
  namespace.listArticlesByLifecycleState = listArticlesByLifecycleState;
  namespace.countActiveInboxItems = countActiveInboxItems;
  namespace.findArticleByCanonicalUrl = findArticleByCanonicalUrl;
  namespace.createQueuedArticle = createQueuedArticle;
  namespace.upsertArticle = upsertArticle;
  namespace.updateArticle = updateArticle;
  namespace.updateArticleLifecycleState = updateArticleLifecycleState;
  namespace.updateArticleProcessingState = updateArticleProcessingState;
  namespace.refreshArticleSavedAt = refreshArticleSavedAt;
  namespace.markArticleRead = markArticleRead;
  namespace.markArticleArchived = markArticleArchived;
  namespace.markArticleDeleted = markArticleDeleted;
  namespace.deleteArticlePermanently = deleteArticlePermanently;
})();
