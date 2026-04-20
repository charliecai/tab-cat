test('reading inbox view model derives filters and groups from active articles', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const articles = [
    {
      id: 'a-1',
      title: 'Agent pricing changes',
      url: 'https://example.com/agent-pricing',
      site_name: 'example.com',
      labels: ['agent', 'pricing'],
      priority_bucket: 'read_now',
      processing_state: 'ready',
      saved_at: '2026-04-20T02:00:00.000Z',
      last_saved_at: '2026-04-20T02:00:00.000Z',
      last_opened_at: null,
    },
    {
      id: 'a-2',
      title: 'Design notes',
      url: 'https://design.example.com/notes',
      site_name: 'design.example.com',
      labels: ['design'],
      priority_bucket: 'skim_later',
      processing_state: 'ready',
      saved_at: '2026-04-18T02:00:00.000Z',
      last_saved_at: '2026-04-18T02:00:00.000Z',
      last_opened_at: '2026-04-19T02:00:00.000Z',
    },
  ];

  const filters = helpers.deriveReadingFilters(articles);
  const visible = helpers.applyReadingFilters(articles, {
    search: 'pricing',
    labels: ['agent'],
    source: 'example.com',
    time: '',
    status: 'ready',
  });
  const groups = helpers.groupReadingResultsByPriority(visible);

  assertEqual(filters.labels[0].value, 'agent');
  assertEqual(filters.sources[0].value, 'design.example.com');
  assertEqual(visible.length, 1);
  assertEqual(groups[0].id, 'read_now');
  assertEqual(groups[0].articles.length, 1);
});

test('reading inbox renderer returns medium-density cards with open action and labels', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const html = helpers.renderReadingResultCard({
    id: 'a-1',
    title: 'Agent pricing changes',
    url: 'https://example.com/agent-pricing',
    site_name: 'example.com',
    labels: ['agent', 'pricing'],
    priority_bucket: 'read_now',
    processing_state: 'ready',
    short_reason: 'Useful for the current queue because pricing changed.',
    reading_time_estimate: 6,
    saved_at: '2026-04-20T02:00:00.000Z',
    last_saved_at: '2026-04-20T02:00:00.000Z',
    lifecycle_state: 'active',
  });

  document.body.innerHTML = `<div id="fixture">${html}</div>`;

  assertEqual(Boolean(document.querySelector('.reading-result-card')), true);
  assertEqual(Boolean(document.querySelector('.reading-result-title')), true);
  assertEqual(Boolean(document.querySelector('.reading-result-label')), true);
  assertEqual(
    document.querySelector('.reading-item-action.primary').textContent.trim(),
    globalThis.TabOutI18n.t('actions.open')
  );
});

test('reading inbox read cards keep read as the terminal state without archive action', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const html = helpers.renderReadingResultCard({
    id: 'read-1',
    title: 'Read article',
    url: 'https://example.com/read',
    site_name: 'example.com',
    labels: ['agent'],
    priority_bucket: 'worth_keeping',
    processing_state: 'ready',
    short_reason: 'Useful for the current queue after one pass.',
    reading_time_estimate: 4,
    saved_at: '2026-04-19T02:00:00.000Z',
    last_saved_at: '2026-04-19T02:00:00.000Z',
    lifecycle_state: 'read',
  });

  document.body.innerHTML = `<div id="fixture">${html}</div>`;

  const actions = Array.from(document.querySelectorAll('.reading-result-actions .reading-item-action')).map((node) =>
    node.textContent.trim()
  );

  assertEqual(Boolean(document.querySelector('[data-action="archive-article"]')), false);
  assertDeepEqual(actions, [
    globalThis.TabOutI18n.t('actions.open'),
    globalThis.TabOutI18n.t('actions.delete'),
  ]);
});

test('reading inbox lifecycle filter supports all unread and read states', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const articles = [
    {
      id: 'active-1',
      title: 'Unread article',
      url: 'https://example.com/unread',
      site_name: 'example.com',
      labels: ['agent'],
      priority_bucket: 'read_now',
      processing_state: 'ready',
      lifecycle_state: 'active',
      saved_at: '2026-04-20T02:00:00.000Z',
      last_saved_at: '2026-04-20T02:00:00.000Z',
      last_opened_at: null,
    },
    {
      id: 'read-1',
      title: 'Read article',
      url: 'https://example.com/read',
      site_name: 'example.com',
      labels: ['agent'],
      priority_bucket: 'worth_keeping',
      processing_state: 'ready',
      lifecycle_state: 'read',
      saved_at: '2026-04-19T02:00:00.000Z',
      last_saved_at: '2026-04-19T02:00:00.000Z',
      last_opened_at: '2026-04-20T02:00:00.000Z',
    },
  ];

  const visibleAll = helpers.applyReadingFilters(articles, {
    search: '',
    labels: [],
    source: '',
    time: '',
    status: [],
    lifecycle: 'all',
  });
  const visibleUnread = helpers.applyReadingFilters(articles, {
    search: '',
    labels: [],
    source: '',
    time: '',
    status: [],
    lifecycle: 'active',
  });
  const visibleRead = helpers.applyReadingFilters(articles, {
    search: '',
    labels: [],
    source: '',
    time: '',
    status: [],
    lifecycle: 'read',
  });

  assertDeepEqual(
    visibleAll.map((article) => article.id),
    ['active-1', 'read-1']
  );
  assertDeepEqual(
    visibleUnread.map((article) => article.id),
    ['active-1']
  );
  assertDeepEqual(
    visibleRead.map((article) => article.id),
    ['read-1']
  );
});

test('reading inbox filters render all unread and read options', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const html = helpers.renderReadingFiltersHtml(
    {
      lifecycle: [
        { value: 'all', count: 3 },
        { value: 'active', count: 2 },
        { value: 'read', count: 1 },
      ],
      labels: [
        { value: 'agent', count: 3 },
        { value: 'pricing', count: 2 },
      ],
      sources: [],
      times: [],
      statuses: [],
    },
    {
      search: '',
      labels: [],
      source: '',
      time: '',
      status: [],
      lifecycle: 'all',
    }
  );

  document.body.innerHTML = `<div id="fixture">${html}</div>`;

  const lifecycleButtons = Array.from(document.querySelectorAll('[data-filter-kind="lifecycle"]')).map((node) =>
    node.textContent.replace(/\s+/g, ' ').trim()
  );

  assertDeepEqual(lifecycleButtons, [
    `${globalThis.TabOutI18n.t('reading.lifecycle.all')} 3`,
    `${globalThis.TabOutI18n.t('reading.lifecycle.active')} 2`,
    `${globalThis.TabOutI18n.t('reading.lifecycle.read')} 1`,
  ]);
  assertEqual(document.querySelector('.reading-filter-stack').firstElementChild.tagName, 'LABEL');
  assertEqual(
    document.querySelector('[data-filter-group="lifecycle"]').classList.contains('reading-filter-options-inline'),
    true
  );
  assertEqual(
    document.querySelector('[data-filter-group="labels"]').classList.contains('reading-filter-options-wrap'),
    true
  );
});

test('reading inbox status filter is single-select and matches one token at a time', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const articles = [
    {
      id: 'ready-1',
      title: 'Ready article',
      url: 'https://example.com/ready',
      site_name: 'example.com',
      labels: ['agent'],
      priority_bucket: 'read_now',
      processing_state: 'ready',
      lifecycle_state: 'active',
      saved_at: '2026-04-20T02:00:00.000Z',
      last_saved_at: '2026-04-20T02:00:00.000Z',
      last_opened_at: null,
    },
    {
      id: 'failed-1',
      title: 'Failed article',
      url: 'https://example.com/failed',
      site_name: 'example.com',
      labels: ['agent'],
      priority_bucket: 'skim_later',
      processing_state: 'capture_failed',
      lifecycle_state: 'active',
      saved_at: '2026-04-19T02:00:00.000Z',
      last_saved_at: '2026-04-19T02:00:00.000Z',
      last_opened_at: null,
    },
  ];

  const readyVisible = helpers.applyReadingFilters(articles, {
    lifecycle: 'all',
    search: '',
    labels: [],
    source: '',
    time: '',
    status: 'ready',
  });
  const failedVisible = helpers.applyReadingFilters(articles, {
    lifecycle: 'all',
    search: '',
    labels: [],
    source: '',
    time: '',
    status: 'failed',
  });

  assertDeepEqual(readyVisible.map((article) => article.id), ['ready-1']);
  assertDeepEqual(failedVisible.map((article) => article.id), ['failed-1']);
});

test('reading inbox derives label filters ordered by article count descending', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const filters = helpers.deriveReadingFilters([
    {
      id: 'label-1',
      title: 'Agent pricing changes',
      url: 'https://example.com/pricing',
      site_name: 'example.com',
      labels: ['agent', 'pricing'],
      priority_bucket: 'read_now',
      processing_state: 'ready',
      lifecycle_state: 'active',
      saved_at: '2026-04-20T02:00:00.000Z',
      last_saved_at: '2026-04-20T02:00:00.000Z',
      last_opened_at: null,
    },
    {
      id: 'label-2',
      title: 'Agent notes',
      url: 'https://example.com/agent',
      site_name: 'example.com',
      labels: ['agent'],
      priority_bucket: 'skim_later',
      processing_state: 'ready',
      lifecycle_state: 'active',
      saved_at: '2026-04-19T02:00:00.000Z',
      last_saved_at: '2026-04-19T02:00:00.000Z',
      last_opened_at: null,
    },
    {
      id: 'label-3',
      title: 'Design roundup',
      url: 'https://example.com/design',
      site_name: 'example.com',
      labels: ['design'],
      priority_bucket: 'worth_keeping',
      processing_state: 'ready',
      lifecycle_state: 'active',
      saved_at: '2026-04-18T02:00:00.000Z',
      last_saved_at: '2026-04-18T02:00:00.000Z',
      last_opened_at: null,
    },
  ]);

  assertDeepEqual(
    filters.labels.map((entry) => `${entry.value}:${entry.count}`),
    ['agent:2', 'design:1', 'pricing:1']
  );
});

test('reading inbox retry rerenders queued state before background kick resolves', async () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const articles = [
    {
      id: 'retry-1',
      title: 'Retry me',
      url: 'https://example.com/retry',
      site_name: 'example.com',
      labels: ['agent'],
      priority_bucket: 'skim_later',
      processing_state: 'capture_failed',
      short_reason: 'Retry me',
      lifecycle_state: 'active',
      saved_at: '2026-04-20T02:00:00.000Z',
      last_saved_at: '2026-04-20T02:00:00.000Z',
      last_opened_at: null,
    },
  ];

  let enqueuedJob = null;
  globalThis.chrome.runtime.sendMessage = async () => new Promise(() => {});
  globalThis.TabOutArticlesRepo = {
    async countActiveInboxItems() {
      return articles.filter((article) => article.lifecycle_state === 'active').length;
    },
    async listArticles() {
      return articles.slice();
    },
    async getArticleById(articleId) {
      return articles.find((article) => article.id === articleId) || null;
    },
    async updateArticle(articleId, patch) {
      const index = articles.findIndex((article) => article.id === articleId);
      if (index < 0) return null;
      articles[index] = { ...articles[index], ...patch };
      return articles[index];
    },
  };
  globalThis.TabOutJobsRepo = {
    async enqueueJob(input) {
      enqueuedJob = { ...input };
      return enqueuedJob;
    },
    async listJobs() {
      return [];
    },
  };

  document.body.innerHTML = `
    <div id="readingInboxBadge"></div>
    <div id="readingQueueCount"></div>
    <div id="readingFiltersBody"></div>
    <div id="readingResultsSummary"></div>
    <div id="readingResultsGroups">${helpers.renderReadingResultGroupsHtml([{ id: 'skim_later', title: 'Skim later', articles }])}</div>
    <div id="readingResultsEmpty"></div>
    <div id="debugList"></div>
    <div id="toast"><span id="toastText"></span></div>
  `;

  document
    .querySelector('[data-action="retry-article"]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitForTick();
  await waitForTick();

  assertEqual(enqueuedJob.processing_state, 'queued');
  assertEqual(document.querySelector('.reading-item-processing').textContent.trim(), globalThis.TabOutI18n.t('processing.queued'));
  assertEqual(document.querySelectorAll('[data-action="retry-article"]').length, 0);
});

test('reading inbox live search preserves the existing input node and focus', async () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const articles = [
    {
      id: 'search-1',
      title: 'Agent pricing changes',
      url: 'https://example.com/pricing',
      site_name: 'example.com',
      labels: ['agent'],
      priority_bucket: 'read_now',
      processing_state: 'ready',
      short_reason: 'Useful',
      lifecycle_state: 'active',
      saved_at: '2026-04-20T02:00:00.000Z',
      last_saved_at: '2026-04-20T02:00:00.000Z',
      last_opened_at: null,
    },
  ];

  globalThis.TabOutArticlesRepo = {
    async countActiveInboxItems() {
      return 1;
    },
    async listArticles() {
      return articles.slice();
    },
  };
  globalThis.TabOutJobsRepo = {
    async getJobByArticleId() {
      return null;
    },
    async listJobs() {
      return [];
    },
  };
  globalThis.TabOutSettingsRepo = {
    async getAiStatus() {
      return { host: '', state: 'not_configured', last_error: null };
    },
  };

  document.body.innerHTML = `
    <div id="readingInboxBadge"></div>
    <div id="readingQueueCount"></div>
    <div id="readingFiltersBody">${helpers.renderReadingFiltersHtml(helpers.deriveReadingFilters(articles), {
      lifecycle: 'active',
      search: '',
      labels: [],
      source: '',
      time: '',
      status: '',
    })}</div>
    <div id="readingResultsSummary"></div>
    <div id="readingResultsGroups"></div>
    <div id="readingResultsEmpty"></div>
    <div id="debugList"></div>
  `;

  const originalInput = document.getElementById('readingFilterSearch');
  originalInput.focus();
  originalInput.value = 'pricing';
  originalInput.dispatchEvent(new Event('input', { bubbles: true }));
  await waitForTick();
  await waitForTick();

  const currentInput = document.getElementById('readingFilterSearch');
  assertEqual(currentInput, originalInput);
  assertEqual(document.activeElement, originalInput);
  assertEqual(currentInput.value, 'pricing');
  assertEqual(document.getElementById('readingResultsGroups').textContent.includes('Agent pricing changes'), true);
});

test('reading inbox label filters toggle the labels state and rerender filtered results', async () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const articles = [
    {
      id: 'tag-1',
      title: 'Agent pricing changes',
      url: 'https://example.com/pricing',
      site_name: 'example.com',
      labels: ['agent', 'pricing'],
      priority_bucket: 'read_now',
      processing_state: 'ready',
      short_reason: 'Useful',
      lifecycle_state: 'active',
      saved_at: '2026-04-20T02:00:00.000Z',
      last_saved_at: '2026-04-20T02:00:00.000Z',
      last_opened_at: null,
    },
    {
      id: 'tag-2',
      title: 'Design notes',
      url: 'https://design.example.com/notes',
      site_name: 'design.example.com',
      labels: ['design'],
      priority_bucket: 'skim_later',
      processing_state: 'ready',
      short_reason: 'Useful',
      lifecycle_state: 'active',
      saved_at: '2026-04-19T02:00:00.000Z',
      last_saved_at: '2026-04-19T02:00:00.000Z',
      last_opened_at: null,
    },
  ];

  globalThis.TabOutArticlesRepo = {
    async countActiveInboxItems() {
      return articles.length;
    },
    async listArticles() {
      return articles.slice();
    },
  };
  globalThis.TabOutJobsRepo = {
    async listJobs() {
      return [];
    },
  };
  globalThis.TabOutSettingsRepo = {
    async getAiStatus() {
      return { host: '', state: 'not_configured', last_error: null };
    },
  };

  document.body.innerHTML = `
    <div id="readingInboxBadge"></div>
    <div id="readingQueueCount"></div>
    <div id="readingFiltersBody">${helpers.renderReadingFiltersHtml(helpers.deriveReadingFilters(articles), {
      lifecycle: 'active',
      search: '',
      labels: [],
      source: '',
      time: '',
      status: '',
    })}</div>
    <div id="readingResultsSummary"></div>
    <div id="readingResultsGroups">${helpers.renderReadingResultGroupsHtml(helpers.groupReadingResultsByPriority(articles))}</div>
    <div id="readingResultsEmpty"></div>
    <div id="debugList"></div>
  `;

  document
    .querySelector('[data-filter-kind="label"][data-filter-value="agent"]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitForTick();
  await waitForTick();

  assertEqual(document.getElementById('readingResultsGroups').textContent.includes('Agent pricing changes'), true);
  assertEqual(document.getElementById('readingResultsGroups').textContent.includes('Design notes'), false);
  assertEqual(
    Array.from(document.querySelectorAll('.reading-active-filter')).some((node) => node.textContent.trim() === 'agent'),
    true
  );
  assertEqual(document.querySelector('[data-filter-kind="label"][data-filter-value="agent"]').classList.contains('active'), true);
});

test('reading inbox delete confirmation becomes visible when a card enters confirming state', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  document.body.innerHTML = helpers.renderReadingResultCard({
    id: 'delete-1',
    title: 'Delete me',
    url: 'https://example.com/delete',
    site_name: 'example.com',
    labels: ['agent'],
    priority_bucket: 'read_now',
    processing_state: 'ready',
    short_reason: 'Pending deletion',
    reading_time_estimate: 3,
    saved_at: '2026-04-20T02:00:00.000Z',
    last_saved_at: '2026-04-20T02:00:00.000Z',
    lifecycle_state: 'active',
  });

  const card = document.querySelector('.reading-result-card');
  const confirmRow = document.querySelector('.reading-item-delete-confirm');
  const actionsRow = document.querySelector('.reading-result-actions');

  card.classList.add('confirming-delete');

  assertEqual(window.getComputedStyle(confirmRow).display, 'flex');
  assertEqual(window.getComputedStyle(actionsRow).display, 'none');
});

test('reading inbox marks legacy articles without new metadata for backfill', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  assertEqual(
    helpers.needsReadingMetadataBackfill({
      processing_state: 'assigned',
      labels: [],
      priority_bucket: null,
      short_reason: null,
    }),
    true
  );

  assertEqual(
    helpers.needsReadingMetadataBackfill({
      processing_state: 'ready',
      labels: ['agent'],
      priority_bucket: 'read_now',
      short_reason: 'Useful right now.',
    }),
    false
  );
});

test('reading inbox preheat only picks lightweight reading candidates and caps them at five', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const candidates = helpers.pickPreheatCandidates([
    { id: 1, url: 'https://example.com/blog/one', title: 'A very long article title for one' },
    { id: 2, url: 'https://mail.google.com/', title: 'Inbox' },
    { id: 3, url: 'chrome://settings', title: 'Settings' },
    { id: 4, url: 'https://example.com/blog/two', title: 'A very long article title for two' },
    { id: 5, url: 'https://example.com/blog/three', title: 'A very long article title for three' },
    { id: 6, url: 'https://example.com/blog/four', title: 'A very long article title for four' },
    { id: 7, url: 'https://example.com/blog/five', title: 'A very long article title for five' },
    { id: 8, url: 'https://example.com/blog/six', title: 'A very long article title for six' },
    { id: 9, url: 'file:///Users/charliec/Desktop/note.md', title: 'Draft note' },
  ]);

  assertDeepEqual(
    candidates.map((tab) => tab.id),
    [1, 4, 5, 6, 7]
  );
});

test('reading inbox saveTabForLater reuses ready preheated payloads and queues analysis from captured state', async () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  helpers.clearPreheatEntries();
  helpers.seedPreheatEntry({
    tabId: 11,
    url: 'https://example.com/blog/post',
    status: 'ready',
    capturedAt: '2026-04-20T05:00:00.000Z',
    payload: {
      title: 'Example post',
      excerpt: 'Lead paragraph',
      analysis_source_text: 'Example post\n\nLead paragraph',
      word_count: 120,
      language: 'en',
      author: 'Author',
      lead_image_url: 'https://example.com/cover.png',
    },
  });

  let createdInput = null;
  let updatedArticle = null;
  let enqueuedJob = null;

  globalThis.TabOutArticlesRepo = {
    async findArticleByCanonicalUrl() {
      return null;
    },
    async createQueuedArticle(input) {
      createdInput = { ...input };
      return {
        id: 'article-prefetch-1',
        lifecycle_state: 'active',
        processing_state: 'queued',
        ...input,
      };
    },
    async updateArticle(_articleId, patch) {
      updatedArticle = { ...patch };
      return {
        id: 'article-prefetch-1',
        ...createdInput,
        ...patch,
      };
    },
  };

  globalThis.TabOutJobsRepo = {
    async enqueueJob(input) {
      enqueuedJob = { ...input };
      return input;
    },
  };

  globalThis.TabOutCapture = {
    async captureArticle() {
      throw new Error('save flow should not capture again when preheat is ready');
    },
  };

  const result = await helpers.saveTabForLater({
    id: 11,
    url: 'https://example.com/blog/post',
    title: 'Example post',
  });

  assertEqual(result.shouldCloseNow, true);
  assertEqual(enqueuedJob.processing_state, 'captured');
  assertEqual(updatedArticle.capture_source, 'prefetch-hit');
  assertEqual(updatedArticle.analysis_source_text, 'Example post\n\nLead paragraph');
});

test('reading inbox debug items include preheat failures and capture source metadata', () => {
  const helpers = globalThis.TabOutReadingInbox;
  if (!helpers) throw new Error('TabOutReadingInbox missing');

  const items = helpers.buildDebugItems({
    articles: [
      {
        id: 'article-1',
        title: 'Saved article',
        url: 'https://example.com/post',
        lifecycle_state: 'active',
        processing_state: 'ready',
        capture_source: 'prefetch-hit',
        analysis_source_text: 'Saved article\n\nLead paragraph',
        last_error_code: null,
        last_error_message: null,
        updated_at: '2026-04-20T06:00:00.000Z',
      },
    ],
    jobs: [
      {
        article_id: 'article-1',
        attempt_count: 2,
        next_retry_at: null,
        last_error_code: null,
        last_error_message: null,
      },
    ],
    aiStatus: {
      host: 'api.example.com',
    },
    preheatEntries: [
      {
        key: 'preheat:1',
        url: 'https://example.com/pending',
        status: 'failed',
        capturedAt: '2026-04-20T07:00:00.000Z',
        errorCode: 'source_tab_loading',
        errorMessage: 'Timed out waiting for a stable page',
        payload: null,
      },
    ],
  });

  const preheatItem = items.find((item) => item.kind === 'preheat');
  const articleItem = items.find((item) => item.kind === 'article');

  assertEqual(preheatItem.stage, 'prefetch');
  assertEqual(preheatItem.errorCode, 'source_tab_loading');
  assertEqual(articleItem.source, 'prefetch-hit');
  assertEqual(articleItem.textSize, 'Saved article\n\nLead paragraph'.length);
});

function waitForTick() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function createDataTransferStub() {
  return {
    effectAllowed: '',
    dropEffect: '',
    setData() {},
    getData() {
      return '';
    },
  };
}

function setCardRect(card, left, top, width = 220, height = 80) {
  card.getBoundingClientRect = () => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
}

function setupPinnedDom() {
  document.body.innerHTML = `
    <div id="toast"><div id="toastText"></div></div>
    <div id="pinnedCount"></div>
    <div id="pinnedEmpty"></div>
    <div id="pinnedList"></div>
  `;
}

function renderPinnedEntries(entries) {
  globalThis.TabOutHomepageController.renderPinned(entries);
  return Array.from(document.querySelectorAll('.pinned-card'));
}

test('pinned drag requires a handle and keeps menu clicks working', async () => {
  setupPinnedDom();

  const entries = [
    { id: 'pin-1', title: 'Alpha', url: 'https://alpha.example.com' },
    { id: 'pin-2', title: 'Beta', url: 'https://beta.example.com' },
  ];

  renderPinnedEntries(entries);

  const firstCard = document.querySelector('.pinned-card[data-pinned-id="pin-1"]');
  const firstHandle = firstCard.querySelector('[data-drag-handle="true"]');
  const firstMenuTrigger = firstCard.querySelector('.pinned-menu-trigger');
  const firstLink = firstCard.querySelector('.pinned-card-link');
  const firstCardStyle = window.getComputedStyle(firstCard);
  const firstHandleStyle = window.getComputedStyle(firstHandle);

  assertEqual(firstLink.getAttribute('target'), '_blank');
  assertEqual(firstLink.getAttribute('rel'), 'noopener noreferrer');
  assertEqual(firstCardStyle.position, 'relative');
  assertEqual(firstHandleStyle.position, 'absolute');

  const blockedDrag = new Event('dragstart', { bubbles: true, cancelable: true });
  blockedDrag.dataTransfer = createDataTransferStub();
  const blockedResult = firstCard.dispatchEvent(blockedDrag);

  assertEqual(blockedResult, false);
  assertEqual(firstCard.classList.contains('dragging'), false);

  firstMenuTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  assertEqual(firstCard.classList.contains('menu-open'), true);

  let normalClickPrevented = null;
  firstLink.addEventListener('click', (event) => {
    normalClickPrevented = event.defaultPrevented;
    event.preventDefault();
  });
  const normalClick = new MouseEvent('click', { bubbles: true, cancelable: true });
  const clickResult = firstLink.dispatchEvent(normalClick);
  assertEqual(clickResult, false);
  assertEqual(normalClickPrevented, false);

  firstHandle.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  const allowedDrag = new Event('dragstart', { bubbles: true, cancelable: true });
  allowedDrag.dataTransfer = createDataTransferStub();
  const allowedResult = firstHandle.dispatchEvent(allowedDrag);

  assertEqual(allowedResult, true);
  assertEqual(firstCard.classList.contains('dragging'), true);
});

test('pinned drag reorders entries, persists them, and blocks the accidental post-drop click', async () => {
  setupPinnedDom();

  let entries = [
    { id: 'pin-1', title: 'Alpha', url: 'https://alpha.example.com' },
    { id: 'pin-2', title: 'Beta', url: 'https://beta.example.com' },
    { id: 'pin-3', title: 'Gamma', url: 'https://gamma.example.com' },
  ];
  let reorderPayload = null;

  globalThis.TabOutPinnedRepo = {
    async listPinnedEntries() {
      return entries.map((entry) => ({ ...entry }));
    },
    async reorderPinnedEntries(ids) {
      reorderPayload = ids.slice();
      entries = ids.map((id, index) => ({
        ...entries.find((entry) => entry.id === id),
        order: index,
      }));
    },
  };

  await renderPinnedSurface();

  const cards = Array.from(document.querySelectorAll('.pinned-card'));
  const [firstCard, secondCard, thirdCard] = cards;
  setCardRect(firstCard, 0, 0);
  setCardRect(secondCard, 240, 0);
  setCardRect(thirdCard, 480, 0);

  firstCard.querySelector('[data-drag-handle="true"]').dispatchEvent(
    new Event('pointerdown', { bubbles: true })
  );

  const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
  dragStart.dataTransfer = createDataTransferStub();
  firstCard.querySelector('[data-drag-handle="true"]').dispatchEvent(dragStart);

  const dragOver = new MouseEvent('dragover', {
    bubbles: true,
    cancelable: true,
    clientX: 690,
    clientY: 40,
  });
  thirdCard.dispatchEvent(dragOver);

  const dropEvent = new MouseEvent('drop', { bubbles: true, cancelable: true });
  document.getElementById('pinnedList').dispatchEvent(dropEvent);
  firstCard.dispatchEvent(new Event('dragend', { bubbles: true }));

  await waitForTick();

  assertDeepEqual(reorderPayload, ['pin-2', 'pin-3', 'pin-1']);
  assertDeepEqual(
    Array.from(document.querySelectorAll('.pinned-card')).map((card) => card.dataset.pinnedId),
    ['pin-2', 'pin-3', 'pin-1']
  );

  const draggedLink = document
    .querySelector('.pinned-card[data-pinned-id="pin-1"] .pinned-card-link');
  let blockedClickPrevented = null;
  draggedLink.addEventListener('click', (event) => {
    blockedClickPrevented = event.defaultPrevented;
    event.preventDefault();
  });
  const blockedClick = new MouseEvent('click', { bubbles: true, cancelable: true });
  const blockedClickResult = draggedLink.dispatchEvent(blockedClick);

  assertEqual(blockedClickResult, false);
  assertEqual(blockedClickPrevented, null);
});
