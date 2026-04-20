(function () {
  const namespace = (globalThis.TabOutJobsRepo = globalThis.TabOutJobsRepo || {});
  const { STORES } = globalThis.TabOutSchema;
  const { requestToPromise, runTransaction, generateId } = globalThis.TabOutDb;

  async function listJobs() {
    return runTransaction(STORES.jobs, 'readonly', async (stores) => {
      return requestToPromise(stores[STORES.jobs].getAll());
    });
  }

  async function getJobByArticleId(articleId) {
    return runTransaction(STORES.jobs, 'readonly', async (stores) => {
      return requestToPromise(stores[STORES.jobs].index('by_article_id').get(articleId));
    });
  }

  async function enqueueJob(input) {
    const existing = await getJobByArticleId(input.article_id);
    const now = new Date().toISOString();
    const job = {
      id: existing ? existing.id : generateId('job'),
      article_id: input.article_id,
      processing_state: input.processing_state || 'queued',
      attempt_count: input.attempt_count || 0,
      next_retry_at: input.next_retry_at || null,
      last_error_code: input.last_error_code || null,
      last_error_message: input.last_error_message || null,
      updated_at: now,
      created_at: existing ? existing.created_at : now,
    };

    await runTransaction(STORES.jobs, 'readwrite', async (stores) => {
      stores[STORES.jobs].put(job);
    });

    return job;
  }

  async function updateJob(id, updates) {
    return runTransaction(STORES.jobs, 'readwrite', async (stores) => {
      const store = stores[STORES.jobs];
      const job = await requestToPromise(store.get(id));
      if (!job) return null;
      const next = {
        ...job,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      store.put(next);
      return next;
    });
  }

  async function listStuckJobs(thresholdMs) {
    const jobs = await listJobs();
    const now = Date.now();
    return jobs.filter((job) => {
      if (!['capturing', 'analyzing'].includes(job.processing_state)) {
        return false;
      }

      const updatedAt = new Date(job.updated_at || job.created_at || 0).getTime();
      return now - updatedAt > thresholdMs;
    });
  }

  async function rollbackJobToCheckpoint(id) {
    return runTransaction([STORES.jobs, STORES.articles], 'readwrite', async (stores) => {
      const jobStore = stores[STORES.jobs];
      const articleStore = stores[STORES.articles];
      const job = await requestToPromise(jobStore.get(id));
      if (!job) return null;

      const article = await requestToPromise(articleStore.get(job.article_id));
      if (!article) {
        jobStore.delete(id);
        return null;
      }

      let nextState = 'queued';
      if (job.processing_state === 'analyzing') {
        nextState = 'captured';
      }

      const now = new Date().toISOString();
      articleStore.put({
        ...article,
        processing_state: nextState,
        updated_at: now,
      });

      jobStore.put({
        ...job,
        processing_state: nextState,
        updated_at: now,
      });

      return { ...job, processing_state: nextState, updated_at: now };
    });
  }

  async function deleteJob(id) {
    await runTransaction(STORES.jobs, 'readwrite', async (stores) => {
      stores[STORES.jobs].delete(id);
    });
  }

  namespace.listJobs = listJobs;
  namespace.getJobByArticleId = getJobByArticleId;
  namespace.enqueueJob = enqueueJob;
  namespace.updateJob = updateJob;
  namespace.listStuckJobs = listStuckJobs;
  namespace.rollbackJobToCheckpoint = rollbackJobToCheckpoint;
  namespace.deleteJob = deleteJob;
})();
