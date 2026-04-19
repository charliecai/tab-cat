(function () {
  const namespace = (globalThis.TabOutDigestRenderer = globalThis.TabOutDigestRenderer || {});

  function t(key, params) {
    return globalThis.TabOutI18n ? globalThis.TabOutI18n.t(key, params) : key;
  }

  function renderTopicSummaryPanel(viewModel) {
    if (!viewModel) return '';

    if (viewModel.kind === 'empty' || viewModel.kind === 'fallback') {
      return `
        <p class="topic-panel-lead">${viewModel.lead}</p>
        <p class="topic-panel-copy">${viewModel.body}</p>
      `;
    }

    const cards = (viewModel.representativeArticles || [])
      .map((article) => `<li>${article.title}</li>`)
      .join('');
    const related = (viewModel.relatedTopics || [])
      .map((topic) => `<span class="topic-summary-related">${topic}</span>`)
      .join('');

    return `
      <p class="topic-panel-lead">${viewModel.lead}</p>
      <p class="topic-panel-copy">${viewModel.body}</p>
      <section class="topic-summary-card">
        <div class="topic-summary-heading">
          <h3>${viewModel.title}</h3>
          <span>${viewModel.suggestedAction}</span>
        </div>
        <div class="topic-summary-path">${t('topic.representativeArticles')}</div>
        <ul class="topic-summary-listing">${cards}</ul>
        ${related ? `<div class="topic-summary-related-list">${related}</div>` : ''}
      </section>
    `;
  }

  namespace.renderTopicSummaryPanel = renderTopicSummaryPanel;
})();
