test('homepage controller renders pinned cards with translated copy and inbox counts', () => {
  const i18n = globalThis.TabOutI18n;
  if (!i18n) throw new Error('TabOutI18n missing');

  document.body.innerHTML = '';
  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div id="pinnedList"></div>
      <div id="pinnedEmpty"></div>
      <div id="pinnedCount"></div>
      <div id="nowModeBadge"></div>
      <div id="readingInboxBadge"></div>
      <div id="readingQueueCount"></div>
    `
  );

  i18n.setLanguagePreference('zh-CN', 'zh-CN');

  globalThis.TabOutHomepageController.renderPinned([
    { id: 'pin-1', title: 'Example', url: 'https://example.com/docs/start' },
    { id: 'pin-2', title: 'Docs', url: 'https://docs.example.com/guide', icon: '' },
  ]);
  globalThis.TabOutHomepageController.setNowCount(7);
  globalThis.TabOutHomepageController.setReadingInboxCount(3);

  const countText = document.getElementById('pinnedCount').textContent;
  const nowBadge = document.getElementById('nowModeBadge').textContent;
  const queueText = document.getElementById('readingQueueCount').textContent;
  const menuTriggers = Array.from(document.querySelectorAll('.pinned-menu-trigger'));
  const dragHandles = Array.from(document.querySelectorAll('[data-drag-handle="true"]'));
  const actions = Array.from(document.querySelectorAll('.pinned-menu-item')).map((node) =>
    node.textContent.trim()
  );
  const cards = Array.from(document.querySelectorAll('.pinned-card'));
  const subtitles = cards.map((node) =>
    node.querySelector('.pinned-card-subtitle')
      ? node.querySelector('.pinned-card-subtitle').textContent.trim()
      : ''
  );
  const fallback = cards[1] ? cards[1].querySelector('.pinned-card-fallback') : null;

  assertEqual(countText, '2 个已固定');
  assertEqual(nowBadge, '7');
  assertEqual(queueText, '3 个待读');
  assertEqual(menuTriggers.length, 2);
  assertEqual(dragHandles.length, 2);
  assertDeepEqual(actions, ['编辑', '移除', '编辑', '移除']);
  assertEqual(cards.length, 2);
  assertDeepEqual(subtitles, ['example.com', 'docs.example.com']);
  assertEqual(cards[0].querySelector('.pinned-card-title').textContent.trim(), 'Example');
  assertEqual(cards[0].getAttribute('draggable'), 'true');
  assertEqual(Boolean(cards[0].querySelector('.pinned-drag-handle')), true);
  assertEqual(Boolean(fallback), true);
  assertEqual(fallback.textContent.trim(), 'D');
  assertEqual(Boolean(cards[0].querySelector('.pinned-card-menu')), true);
  assertEqual(Boolean(document.querySelector('.pinned-action')), false);
});

test('homepage controller hides reading-inbox tabs from Now and dismisses emptied cards', () => {
  document.body.innerHTML = `
    <section id="openTabsSection" style="display:block">
      <div class="missions" id="openTabsMissions">
        <article class="mission-card" data-domain="example.com">
          <div class="mission-pages">
            <div class="page-chip" data-action="focus-tab" data-tab-url="https://example.com/post#section"></div>
          </div>
        </article>
        <article class="mission-card" data-domain="docs.example.com">
          <div class="mission-pages">
            <div class="page-chip" data-action="focus-tab" data-tab-url="https://docs.example.com/guide"></div>
          </div>
        </article>
      </div>
      <div id="nowModeBadge"></div>
    </section>
  `;

  const visibleTabs = globalThis.TabOutHomepageController.filterVisibleNowTabs(
    [
      { url: 'https://example.com/post#section', title: 'Saved article' },
      { url: 'https://docs.example.com/guide', title: 'Visible doc' },
      { url: 'https://keep.example.com/page', title: 'Archived article should stay visible' },
    ],
    [
      { canonical_url: 'https://example.com/post', lifecycle_state: 'active' },
      { canonical_url: 'https://keep.example.com/page', lifecycle_state: 'archived' },
    ]
  );

  assertDeepEqual(
    visibleTabs.map((tab) => tab.url),
    ['https://docs.example.com/guide', 'https://keep.example.com/page']
  );

  const removedCount = globalThis.TabOutHomepageController.dismissNowTab(
    'https://example.com/post#another-anchor',
    { animate: false }
  );
  globalThis.TabOutHomepageController.setNowCount(visibleTabs.length);

  assertEqual(removedCount, 1);
  assertEqual(document.querySelectorAll('.page-chip[data-action="focus-tab"]').length, 1);
  assertEqual(document.querySelector('.mission-card[data-domain="example.com"]'), null);
  assertEqual(document.querySelector('.mission-card[data-domain="docs.example.com"]') !== null, true);
  assertEqual(document.getElementById('nowModeBadge').textContent, '2');
});

test('homepage controller hides the Now section after the last visible domain card is dismissed', () => {
  document.body.innerHTML = `
    <section id="openTabsSection" style="display:block">
      <div class="missions" id="openTabsMissions">
        <article class="mission-card" data-domain="docs.example.com">
          <div class="mission-pages">
            <div class="page-chip" data-action="focus-tab" data-tab-url="https://docs.example.com/guide#intro"></div>
          </div>
        </article>
      </div>
    </section>
  `;

  const removedCount = globalThis.TabOutHomepageController.dismissNowTab(
    'https://docs.example.com/guide#toc',
    { animate: false }
  );

  assertEqual(removedCount, 1);
  assertEqual(document.querySelectorAll('.mission-card').length, 0);
  assertEqual(document.getElementById('openTabsSection').style.display, 'none');
});
