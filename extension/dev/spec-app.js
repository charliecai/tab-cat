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
    status: ['ready', 'unopened'],
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
