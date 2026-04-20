(function () {
  const namespace = (globalThis.TabOutHomepageController =
    globalThis.TabOutHomepageController || {});

  const state = {
    mode: 'now',
    nowCount: 0,
    readingView: 'active',
    selectedArticleId: null,
    inboxCount: 0,
    initialized: false,
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, params) {
    return globalThis.TabOutI18n ? globalThis.TabOutI18n.t(key, params) : key;
  }

  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return url || '';
    }
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

  function setNowCount(count) {
    state.nowCount = count;
    const badge = byId('nowModeBadge');
    if (badge) badge.textContent = String(count);
  }

  function setReadingInboxCount(count) {
    state.inboxCount = count;
    const badge = byId('readingInboxBadge');
    const queueCount = byId('readingQueueCount');
    if (badge) badge.textContent = String(count);
    if (queueCount) queueCount.textContent = t('counts.activeItems', { count });
  }

  function filterVisibleNowTabs(tabs, articles) {
    // "Now" should reflect the user's actual open tabs.
    // Reading inbox state is orthogonal and should not hide live tabs.
    return Array.isArray(tabs) ? tabs.slice() : [];
  }

  function dismissNowTab(tabUrl, options = {}) {
    const normalizedUrl = normalizeUrl(tabUrl);
    if (!normalizedUrl) return 0;

    const chips = Array.from(document.querySelectorAll('.page-chip[data-action="focus-tab"]')).filter(
      (chip) => normalizeUrl(chip.dataset.tabUrl) === normalizedUrl
    );
    const animate = options.animate !== false;

    chips.forEach((chip) => {
      const removeChip = () => {
        const card = chip.closest('.mission-card');
        chip.remove();
        if (card && card.querySelectorAll('.page-chip[data-action="focus-tab"]').length === 0) {
          card.remove();
        }
      };

      if (!animate) {
        removeChip();
        return;
      }

      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity = '0';
      chip.style.transform = 'scale(0.8)';
      window.setTimeout(removeChip, 200);
    });

    const openTabsSection = byId('openTabsSection');
    const syncSectionVisibility = () => {
      if (!openTabsSection) return;
      if (document.querySelectorAll('#openTabsMissions .mission-card').length === 0) {
        openTabsSection.style.display = 'none';
      }
    };
    if (openTabsSection && chips.length > 0) {
      if (!animate) {
        syncSectionVisibility();
      } else {
        window.setTimeout(() => {
          syncSectionVisibility();
        }, 200);
      }
    }

    return chips.length;
  }

  function setSelectedArticleId(articleId) {
    state.selectedArticleId = articleId || null;
    window.dispatchEvent(
      new CustomEvent('tabout:selected-article-changed', {
        detail: { articleId: state.selectedArticleId },
      })
    );
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPinnedHostname(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function getPinnedDisplayTitle(entry) {
    return entry.title || getPinnedHostname(entry.url) || entry.url || '';
  }

  function getPinnedFallbackLabel(entry) {
    const source = getPinnedDisplayTitle(entry);
    const match = source.trim().match(/[A-Za-z0-9]/);
    return match ? match[0].toUpperCase() : '#';
  }

  function getPinnedIconUrl(entry) {
    if (entry.icon) return entry.icon;
    try {
      const parsed = new URL(entry.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return `${parsed.origin}/favicon.ico`;
    } catch {
      return '';
    }
  }

  function renderPinnedHandle(entry) {
    return `
      <button
        class="pinned-drag-handle"
        type="button"
        data-drag-handle="true"
        data-pinned-id="${entry.id}"
        title="${escapeHtml(t('pinned.reorderHandle'))}"
        aria-label="${escapeHtml(t('pinned.reorderHandle'))}"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="7" cy="5" r="1.25"></circle>
          <circle cx="13" cy="5" r="1.25"></circle>
          <circle cx="7" cy="10" r="1.25"></circle>
          <circle cx="13" cy="10" r="1.25"></circle>
          <circle cx="7" cy="15" r="1.25"></circle>
          <circle cx="13" cy="15" r="1.25"></circle>
        </svg>
      </button>
    `;
  }

  function renderPinnedMenu(entry) {
    return `
      <div class="pinned-card-controls">
        <button
          class="pinned-menu-trigger"
          type="button"
          data-action="toggle-pinned-menu"
          data-pinned-id="${entry.id}"
          aria-haspopup="menu"
          aria-expanded="false"
          title="${escapeHtml(t('pinned.menu.moreActions'))}"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5.5" r="1.75"></circle>
            <circle cx="12" cy="12" r="1.75"></circle>
            <circle cx="12" cy="18.5" r="1.75"></circle>
          </svg>
        </button>
        <div class="pinned-card-menu" role="menu" aria-hidden="true">
          <button class="pinned-menu-item" type="button" role="menuitem" data-action="edit-pinned-entry" data-pinned-id="${entry.id}">${t('actions.edit')}</button>
          <button class="pinned-menu-item danger" type="button" role="menuitem" data-action="remove-pinned-entry" data-pinned-id="${entry.id}">${t('actions.remove')}</button>
        </div>
      </div>
    `;
  }

  function renderPinnedItem(entry) {
    const displayTitle = getPinnedDisplayTitle(entry);
    const hostname = getPinnedHostname(entry.url);
    const safeTitle = escapeHtml(displayTitle);
    const safeUrl = escapeHtml(entry.url || '');
    const safeHostname = escapeHtml(hostname || entry.url || '');
    const fallbackLabel = escapeHtml(getPinnedFallbackLabel(entry));
    const iconUrl = getPinnedIconUrl(entry);
    const iconHtml = iconUrl
      ? `<img class="pinned-card-favicon" src="${escapeHtml(iconUrl)}" alt="" data-hide-broken-image="true">`
      : '';
    return `
      <article class="pinned-card" data-pinned-id="${entry.id}" draggable="true">
        ${renderPinnedHandle(entry)}
        <a class="pinned-card-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeTitle}">
          <span class="pinned-card-media" aria-hidden="true">
            <span class="pinned-card-fallback">${fallbackLabel}</span>
            ${iconHtml}
          </span>
          <span class="pinned-card-body">
            <span class="pinned-card-title">${safeTitle}</span>
            <span class="pinned-card-subtitle">${safeHostname}</span>
          </span>
        </a>
        ${renderPinnedMenu(entry)}
      </article>
    `;
  }

  function renderPinned(entries) {
    const list = byId('pinnedList');
    const empty = byId('pinnedEmpty');
    const count = byId('pinnedCount');
    if (!list || !empty || !count) return;

    const rows = entries || [];
    count.textContent = rows.length ? t('counts.savedPins', { count: rows.length }) : '';
    empty.style.display = rows.length ? 'none' : 'block';
    list.style.display = rows.length ? 'grid' : 'none';
    list.innerHTML = rows.map(renderPinnedItem).join('');
  }

  function renderReadingFilters(content) {
    const body = byId('readingFiltersBody');
    if (body) body.innerHTML = content;
  }

  function renderReadingResultGroups(items, emptyText) {
    const list = byId('readingResultsGroups');
    const empty = byId('readingResultsEmpty');
    if (!list || !empty) return;
    const renderedItems = Array.isArray(items) ? items.join('') : (items || '');

    if (!renderedItems) {
      list.innerHTML = '';
      list.style.display = 'none';
      empty.style.display = 'block';
      if (emptyText) empty.textContent = emptyText;
      return;
    }

    list.innerHTML = renderedItems;
    list.style.display = 'grid';
    empty.style.display = 'none';
  }

  function renderReadingResultsSummary(content) {
    const body = byId('readingResultsSummary');
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
    setNowCount(state.nowCount);
    setReadingInboxCount(state.inboxCount);
  }

  namespace.init = init;
  namespace.setMode = setMode;
  namespace.getMode = () => state.mode;
  namespace.setNowCount = setNowCount;
  namespace.setReadingView = setReadingView;
  namespace.getReadingView = () => state.readingView;
  namespace.setReadingInboxCount = setReadingInboxCount;
  namespace.filterVisibleNowTabs = filterVisibleNowTabs;
  namespace.dismissNowTab = dismissNowTab;
  namespace.setSelectedArticleId = setSelectedArticleId;
  namespace.getSelectedArticleId = () => state.selectedArticleId;
  namespace.renderPinned = renderPinned;
  namespace.renderReadingFilters = renderReadingFilters;
  namespace.renderReadingResultGroups = renderReadingResultGroups;
  namespace.renderReadingResultsSummary = renderReadingResultsSummary;
  namespace.toggleSettings = toggleSettings;
})();
