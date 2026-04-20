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
