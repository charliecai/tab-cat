(function () {
  const namespace = (globalThis.TabOutJobsRunner = globalThis.TabOutJobsRunner || {});
  const RUNNER_CONCURRENCY = 2;
  const RUNNER_THRESHOLD_MS = 90 * 1000;
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
      if (input.processingState === 'assigning') {
        return { processingState: 'analyzed', retryable: true };
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
      markdown_content: captureResult.markdown,
      excerpt: captureResult.excerpt,
      word_count: captureResult.word_count,
      language: captureResult.language,
      author: captureResult.author,
      lead_image_url: captureResult.lead_image_url,
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
      const error = new Error(validation.errors.join(', '));
      error.code = 'invalid_ai_settings';
      throw error;
    }

    const analysis = await globalThis.TabOutArticleAnalysis.analyzeArticle(article.markdown_content || '', article, settings);
    const nextArticle = await globalThis.TabOutArticlesRepo.updateArticle(article.id, {
      summary_short: analysis.summaryShort,
      main_topic_label: null,
      recommended_action: analysis.recommendedAction,
      why_recommended: analysis.whyRecommended,
      sub_angles: analysis.subAngles,
      keywords: analysis.keywords,
      content_type: analysis.contentType,
      novelty_score: analysis.noveltyScore,
      duplicate_candidates: analysis.duplicateCandidates,
      reading_question: analysis.readingQuestion,
      processing_state: 'analyzed',
      last_error_code: null,
      last_error_message: null,
    });
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: 'analyzed',
      last_error_code: null,
      last_error_message: null,
    });
    await notifyDataChanged();
    return { article: nextArticle, analysis };
  }

  async function runAssignmentStage(article, analysis, job) {
    await globalThis.TabOutArticlesRepo.updateArticleProcessingState(article.id, 'assigning');
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: 'assigning',
      last_error_code: null,
      last_error_message: null,
    });

    const topics = await globalThis.TabOutTopicsRepo.listTopics();
    const match = globalThis.TabOutTopicEngine.matchTopic(analysis, topics);

    let topicId = match.topicId;
    let topic;
    if (match.matchType === 'existing') {
      topic = topics.find((item) => item.id === match.topicId);
      topic = await globalThis.TabOutTopicsRepo.upsertTopic({
        ...topic,
        article_count: (topic.article_count || 0) + 1,
        last_updated: new Date().toISOString(),
      });
      topicId = topic.id;
    } else {
      topic = await globalThis.TabOutTopicsRepo.upsertTopic(
        globalThis.TabOutTopicEngine.seedTopicFromArticle(analysis)
      );
      topicId = topic.id;
    }

    await globalThis.TabOutArticlesRepo.updateArticle(article.id, {
      main_topic_id: topicId,
      main_topic_label: topic.title,
      processing_state: 'assigned',
      last_error_code: null,
      last_error_message: null,
    });
    await globalThis.TabOutJobsRepo.updateJob(job.id, {
      processing_state: 'assigned',
      last_error_code: null,
      last_error_message: null,
    });
    await notifyDataChanged();
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
        const result = await runAnalysisStage(article, job);
        failureState = 'assignment_failed';
        await runAssignmentStage(result.article, result.analysis, await globalThis.TabOutJobsRepo.getJobByArticleId(job.article_id));
        return;
      }
      if (['analyzed', 'assigning', 'assignment_failed'].includes(job.processing_state)) {
        failureState = 'assignment_failed';
        const current = await globalThis.TabOutArticlesRepo.getArticleById(job.article_id);
        const analysis = {
          summaryShort: current.summary_short,
          mainTopicLabel: current.main_topic_label,
          recommendedAction: current.recommended_action,
          whyRecommended: current.why_recommended,
          subAngles: current.sub_angles || [],
          keywords: current.keywords || [],
          readingQuestion: current.reading_question || null,
          contentType: current.content_type || null,
          noveltyScore: current.novelty_score || null,
          duplicateCandidates: current.duplicate_candidates || [],
        };
        await runAssignmentStage(current, analysis, job);
        return;
      }
    } catch (error) {
      await failJob(article, job, failureState || 'assignment_failed', error);
    }
  }

  async function getRunnableJobs() {
    const jobs = await globalThis.TabOutJobsRepo.listJobs();
    const now = Date.now();
    return jobs
      .filter((job) => {
        if (['assigned'].includes(job.processing_state)) return false;
        if (job.next_retry_at && new Date(job.next_retry_at).getTime() > now) return false;
        return ['queued', 'captured', 'analyzed', 'capture_failed', 'analysis_failed', 'assignment_failed'].includes(job.processing_state);
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
