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
