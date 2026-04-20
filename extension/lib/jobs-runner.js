(function () {
  const namespace = (globalThis.TabOutJobsRunner = globalThis.TabOutJobsRunner || {});
  const RUNNER_CONCURRENCY = 2;
  const RUNNER_THRESHOLD_MS = 90 * 1000;
  const WAITING_FOR_AI_MESSAGE =
    'AI settings are not ready yet. Test the saved connection, then retry this article.';
  let inFlight = 0;
  let kickScheduled = false;

  async function notifyDataChanged() {
    try {
      await chrome.runtime.sendMessage({ type: 'tabout:data-changed' });
    } catch {
      // No visible page is listening right now.
    }
  }

  function computeBackoffDelay(attemptCount) {
    const nextAttempt = Math.max(1, attemptCount || 1);
    return Math.min(30 * 60 * 1000, 30 * 1000 * Math.pow(2, nextAttempt - 1));
  }

  function isTransientCaptureFailure(errorCode) {
    return ['source_tab_loading', 'runtime_message_failed', 'provider_unavailable', 'source_tab_reloaded', 'source_tab_closed_before_payload'].includes(errorCode);
  }

  function computeJobTransition(input) {
    if (input.type === 'rollback_stuck_job') {
      if (input.processingState === 'analyzing') {
        return { processingState: 'captured', retryable: true };
      }
      return { processingState: 'queued', retryable: true };
    }

    if (input.type === 'capture_succeeded') {
      return {
        processingState: 'captured',
        retryable: false,
        markdown: input.markdown,
      };
    }

    if (input.type === 'capture_failed') {
      return {
        processingState: 'capture_failed',
        retryable: isTransientCaptureFailure(input.errorCode),
      };
    }

    return {
      processingState: input.processingState || 'queued',
      retryable: false,
    };
  }

  async function rollbackStuckJobs() {
    const jobs = await globalThis.TabOutJobsRepo.listStuckJobs(RUNNER_THRESHOLD_MS);
    for (const job of jobs) {
      await globalThis.TabOutJobsRepo.rollbackJobToCheckpoint(job.id);
    }
    if (jobs.length) {
      await notifyDataChanged();
    }
  }

  async function maybeCloseSourceTabAfterCapture(article) {
    if (!article || !article.close_source_tab_after_capture) {
      return article;
    }

    const sourceRef = Number(article.source_ref);
    if (!sourceRef) {
      return globalThis.TabOutArticlesRepo.updateArticle(article.id, {
        close_source_tab_after_capture: false,
      });
    }

    let sourceTab = null;
    try {
      sourceTab = await chrome.tabs.get(sourceRef);
    } catch {
      return globalThis.TabOutArticlesRepo.updateArticle(article.id, {
        close_source_tab_after_capture: false,
      });
    }

    if (sourceTab && sourceTab.active) {
      return globalThis.TabOutArticlesRepo.updateArticle(article.id, {
        close_source_tab_after_capture: false,
      });
    }

    try {
      await chrome.tabs.remove(sourceRef);
    } catch {
      // The tab may already be gone by the time capture finishes.
    }

    return globalThis.TabOutArticlesRepo.updateArticle(article.id, {
      close_source_tab_after_capture: false,
    });
  }

  async function runCaptureStage(article, job) {
    await globalThis.TabOutArticlesRepo.updateArticleProcessingState(article.id, 'capturing');
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: 'capturing',
      attempt_count: (job.attempt_count || 0) + 1,
      next_retry_at: null,
      last_error_code: null,
      last_error_message: null,
    });

    const captureResult = await globalThis.TabOutCapture.captureArticle(article);
    const nextArticle = await globalThis.TabOutArticlesRepo.updateArticle(article.id, {
      analysis_source_text: captureResult.analysis_source_text || null,
      excerpt: captureResult.excerpt,
      word_count: captureResult.word_count,
      language: captureResult.language,
      author: captureResult.author,
      lead_image_url: captureResult.lead_image_url,
      site_name: captureResult.site_name || article.site_name || '',
      processing_state: 'captured',
      last_error_code: null,
      last_error_message: null,
    });
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: 'captured',
      last_error_code: null,
      last_error_message: null,
    });
    const finalArticle = await maybeCloseSourceTabAfterCapture(nextArticle);
    await notifyDataChanged();
    return finalArticle;
  }

  async function runAnalysisStage(article, job) {
    await globalThis.TabOutArticlesRepo.updateArticleProcessingState(article.id, 'analyzing');
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: 'analyzing',
      last_error_code: null,
      last_error_message: null,
    });

    const settings = await globalThis.TabOutSettingsRepo.getAiSettings();
    const validation = globalThis.TabOutAiClient.validateAiSettings(settings);
    if (!validation.isValid) {
      const nextArticle = await globalThis.TabOutArticlesRepo.updateArticle(article.id, {
        processing_state: 'waiting_for_ai',
        last_error_code: null,
        last_error_message: WAITING_FOR_AI_MESSAGE,
      });
      await globalThis.TabOutJobsRepo.updateJob(job.id, {
        processing_state: 'waiting_for_ai',
        last_error_code: null,
        last_error_message: WAITING_FOR_AI_MESSAGE,
        next_retry_at: null,
      });
      await notifyDataChanged();
      return { article: nextArticle, deferred: true };
    }

    const analysis = await globalThis.TabOutArticleAnalysis.analyzeArticle(
      article.analysis_source_text || article.markdown_content || '',
      article,
      settings
    );
    const nextArticle = await globalThis.TabOutArticlesRepo.updateArticle(article.id, {
      labels: analysis.labels,
      priority_bucket: analysis.priorityBucket,
      short_reason: analysis.shortReason,
      reading_time_estimate: analysis.readingTimeEstimate,
      processing_state: 'ready',
      last_error_code: null,
      last_error_message: null,
    });
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: 'ready',
      last_error_code: null,
      last_error_message: null,
    });
    await notifyDataChanged();
    return { article: nextArticle, analysis };
  }

  async function failJob(article, job, processingState, error) {
    const errorCode = error && error.code ? error.code : 'unknown_error';
    const errorMessage = error && error.message ? error.message : String(error);
    const attemptCount = (job.attempt_count || 0) + 1;
    const retryable =
      processingState === 'capture_failed'
        ? isTransientCaptureFailure(errorCode)
        : errorCode !== 'invalid_ai_settings' && errorCode !== 'unsupported_url';

    const nextRetryAt = retryable
      ? new Date(Date.now() + computeBackoffDelay(attemptCount)).toISOString()
      : null;

    await globalThis.TabOutArticlesRepo.updateArticle(article.id, {
      processing_state: processingState,
      last_error_code: errorCode,
      last_error_message: errorMessage,
    });
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: processingState,
      attempt_count: attemptCount,
      last_error_code: errorCode,
      last_error_message: errorMessage,
      next_retry_at: nextRetryAt,
    });
    await notifyDataChanged();
  }

  async function runJob(job) {
    const article = await globalThis.TabOutArticlesRepo.getArticleById(job.article_id);
    if (!article || article.lifecycle_state === 'deleted') {
      await globalThis.TabOutJobsRepo.deleteJob(job.id);
      return;
    }

    let failureState = null;
    try {
      if (['queued', 'capturing', 'capture_failed'].includes(job.processing_state)) {
        failureState = 'capture_failed';
        const captured = await runCaptureStage(article, job);
        await runJob(await globalThis.TabOutJobsRepo.getJobByArticleId(job.article_id));
        return captured;
      }
      if (['captured', 'analyzing', 'analysis_failed'].includes(job.processing_state)) {
        failureState = 'analysis_failed';
        await runAnalysisStage(article, job);
        return;
      }
    } catch (error) {
      await failJob(article, job, failureState || 'analysis_failed', error);
    }
  }

  async function getRunnableJobs() {
    const jobs = await globalThis.TabOutJobsRepo.listJobs();
    const now = Date.now();
    return jobs
      .filter((job) => {
        if (['ready'].includes(job.processing_state)) return false;
        if (job.next_retry_at && new Date(job.next_retry_at).getTime() > now) return false;
        return ['queued', 'captured', 'capture_failed', 'analysis_failed'].includes(job.processing_state);
      })
      .sort((left, right) => new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime());
  }

  async function pumpQueue() {
    if (inFlight >= RUNNER_CONCURRENCY) return;
    const jobs = await getRunnableJobs();
    while (inFlight < RUNNER_CONCURRENCY && jobs.length) {
      const job = jobs.shift();
      inFlight += 1;
      runJob(job)
        .catch((error) => {
          console.warn('[tab-out] jobs-runner job failed:', error);
        })
        .finally(async () => {
          inFlight -= 1;
          if (kickScheduled) {
            kickScheduled = false;
            await pumpQueue();
          }
        });
    }
  }

  async function kick() {
    if (inFlight >= RUNNER_CONCURRENCY) {
      kickScheduled = true;
      return;
    }
    await pumpQueue();
  }

  namespace.RUNNER_CONCURRENCY = RUNNER_CONCURRENCY;
  namespace.computeBackoffDelay = computeBackoffDelay;
  namespace.isTransientCaptureFailure = isTransientCaptureFailure;
  namespace.computeJobTransition = computeJobTransition;
  namespace.rollbackStuckJobs = rollbackStuckJobs;
  namespace.kick = kick;
  globalThis.computeJobTransition = computeJobTransition;
})();
