(function () {
  const namespace = (globalThis.TabOutHomepageController =
    globalThis.TabOutHomepageController || {});

  const state = {
    mode: 'now',
    readingView: 'active',
    inboxCount: 0,
    initialized: false,
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function syncModeUi() {
    document.querySelectorAll('[data-mode-panel]').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.modePanel === state.mode);
    });
    document.querySelectorAll('[data-mode-target]').forEach((button) => {
      button.classList.toggle('active', button.dataset.modeTarget === state.mode);
    });
  }

  function syncReadingViewUi() {
    document.querySelectorAll('[data-reading-view]').forEach((button) => {
      button.classList.toggle('active', button.dataset.readingView === state.readingView);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    syncModeUi();
    window.dispatchEvent(
      new CustomEvent('tabout:mode-changed', {
        detail: { mode },
      })
    );
  }

  function setReadingView(view) {
    state.readingView = view;
    syncReadingViewUi();
    window.dispatchEvent(
      new CustomEvent('tabout:reading-view-changed', {
        detail: { view },
      })
    );
  }

  function setReadingInboxCount(count) {
    state.inboxCount = count;
    const badge = byId('readingInboxBadge');
    const queueCount = byId('readingQueueCount');
    if (badge) badge.textContent = String(count);
    if (queueCount) queueCount.textContent = `${count} active`;
  }

  function toggleSettings(forceOpen) {
    const drawer = byId('settingsDrawer');
    const trigger = document.querySelector('[data-action="toggle-settings"]');
    if (!drawer) return;

    const open = typeof forceOpen === 'boolean' ? forceOpen : drawer.getAttribute('aria-hidden') === 'true';
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (trigger) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function renderPinnedItem(entry) {
    const safeTitle = (entry.title || entry.url || '').replace(/"/g, '&quot;');
    const safeUrl = (entry.url || '').replace(/"/g, '&quot;');
    return `
      <div class="pinned-item" data-pinned-id="${entry.id}">
        <a class="pinned-link" href="${safeUrl}" target="_top" title="${safeTitle}">${entry.title || entry.url}</a>
        <div class="pinned-actions">
          <button class="pinned-action" type="button" data-action="edit-pinned-entry" data-pinned-id="${entry.id}">Edit</button>
          <button class="pinned-action" type="button" data-action="remove-pinned-entry" data-pinned-id="${entry.id}">Remove</button>
        </div>
      </div>
    `;
  }

  function renderPinned(entries) {
    const list = byId('pinnedList');
    const empty = byId('pinnedEmpty');
    const count = byId('pinnedCount');
    if (!list || !empty || !count) return;

    const rows = entries || [];
    count.textContent = rows.length ? `${rows.length} saved` : '';
    empty.style.display = rows.length ? 'none' : 'block';
    list.style.display = rows.length ? 'grid' : 'none';
    list.innerHTML = rows.map(renderPinnedItem).join('');
  }

  function renderReadingInboxList(items, emptyText) {
    const list = byId('readingInboxList');
    const empty = byId('readingInboxEmpty');
    if (!list || !empty) return;

    if (!items || items.length === 0) {
      list.innerHTML = '';
      list.style.display = 'none';
      empty.style.display = 'block';
      if (emptyText) empty.textContent = emptyText;
      return;
    }

    list.innerHTML = items.join('');
    list.style.display = 'grid';
    empty.style.display = 'none';
  }

  function setTopicSummary(content) {
    const body = byId('topicSummaryBody');
    if (body) body.innerHTML = content;
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    document.addEventListener('click', (event) => {
      const modeButton = event.target.closest('[data-mode-target]');
      if (modeButton) {
        setMode(modeButton.dataset.modeTarget);
        return;
      }

      const viewButton = event.target.closest('[data-reading-view]');
      if (viewButton) {
        setReadingView(viewButton.dataset.readingView);
        return;
      }

      if (event.target.closest('[data-action="toggle-settings"]')) {
        toggleSettings();
        return;
      }

      if (event.target.closest('[data-action="close-settings"]')) {
        toggleSettings(false);
      }
    });

    syncModeUi();
    syncReadingViewUi();
    setReadingInboxCount(state.inboxCount);
  }

  namespace.init = init;
  namespace.setMode = setMode;
  namespace.getMode = () => state.mode;
  namespace.setReadingView = setReadingView;
  namespace.getReadingView = () => state.readingView;
  namespace.setReadingInboxCount = setReadingInboxCount;
  namespace.renderPinned = renderPinned;
  namespace.renderReadingInboxList = renderReadingInboxList;
  namespace.setTopicSummary = setTopicSummary;
  namespace.toggleSettings = toggleSettings;
})();
