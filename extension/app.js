/* ================================================================
   Tab Out — Dashboard App (Pure Extension Edition)

   This file is the brain of the dashboard. Now that the dashboard
   IS the extension page (not inside an iframe), it can call
   chrome.tabs and chrome.storage directly — no postMessage bridge needed.

   What this file does:
   1. Reads open browser tabs directly via chrome.tabs.query()
   2. Groups tabs by domain with a landing pages category
   3. Renders domain cards, banners, and stats
   4. Handles all user actions (close tabs, save for later, focus tab)
   5. Stores "Saved for Later" tabs in chrome.storage.local (no server)
   ================================================================ */

'use strict';


/* ----------------------------------------------------------------
   CHROME TABS — Direct API Access

   Since this page IS the extension's new tab page, it has full
   access to chrome.tabs and chrome.storage. No middleman needed.
   ---------------------------------------------------------------- */

// All open tabs — populated by fetchOpenTabs()
let openTabs = [];
let visibleNowTabs = [];
let pinnedEditorState = {
  entry: null,
  trigger: null,
};
let readingFilterState = {
  lifecycle: 'active',
  search: '',
  labels: [],
  source: '',
  time: '',
  status: '',
};
let pinnedDragState = {
  armedId: null,
  draggedId: null,
  originalOrder: [],
  blockClicksUntil: 0,
};
const LIGHTWEIGHT_PREHEAT_LIMIT = 5;
const LIGHTWEIGHT_PREHEAT_CONCURRENCY = 1;
const LIGHTWEIGHT_PREHEAT_TIMEOUT_MS = 4000;
const LIGHTWEIGHT_PREHEAT_WAIT_MS = 350;
const preheatEntries = new Map();
let preheatQueue = [];
let preheatInFlight = 0;
let preheatKickScheduled = false;

/**
 * fetchOpenTabs()
 *
 * Reads all currently open browser tabs directly from Chrome.
 * Sets the extensionId flag so we can identify Tab Out's own pages.
 */
async function fetchOpenTabs() {
  try {
    const extensionId = chrome.runtime.id;
    // The new URL for this page is now index.html (not newtab.html)
    const newtabUrl = `chrome-extension://${extensionId}/index.html`;

    const tabs = await chrome.tabs.query({});
    openTabs = tabs.map(t => ({
      id:       t.id,
      url:      t.url,
      title:    t.title,
      favIconUrl: t.favIconUrl || '',
      windowId: t.windowId,
      active:   t.active,
      // Flag Tab Out's own pages so we can detect duplicate new tabs
      isTabOut: t.url === newtabUrl || t.url === 'chrome://newtab/',
    }));
  } catch {
    // chrome.tabs API unavailable (shouldn't happen in an extension page)
    openTabs = [];
  }
}

function escapeAttribute(value) {
  return String(value || '').replace(/"/g, '&quot;');
}

function getTabFaviconUrl(tabLike) {
  if (!tabLike) return '';
  if (tabLike.favIconUrl) return tabLike.favIconUrl;
  return '';
}

function derivePinnedEntryIconUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function renderFaviconImage(src, className = 'chip-favicon', style = '') {
  if (!src) return '';
  const styleAttr = style ? ` style="${escapeAttribute(style)}"` : '';
  return `<img class="${escapeAttribute(className)}" src="${escapeAttribute(src)}" alt="" data-hide-broken-image="true"${styleAttr}>`;
}

function getPinnedListElement() {
  return document.getElementById('pinnedList');
}

function getPinnedCards(list = getPinnedListElement()) {
  if (!list) return [];
  return Array.from(list.querySelectorAll('.pinned-card'));
}

function clearPinnedDropTargets(list = getPinnedListElement()) {
  getPinnedCards(list).forEach((card) => {
    card.classList.remove('drop-target');
  });
}

function resetPinnedDragState() {
  const list = getPinnedListElement();
  if (list) {
    list.classList.remove('pinned-list-dragging');
  }

  getPinnedCards(list).forEach((card) => {
    card.classList.remove('dragging');
    card.classList.remove('drop-target');
  });

  pinnedDragState = {
    armedId: null,
    draggedId: null,
    originalOrder: [],
    blockClicksUntil: pinnedDragState.blockClicksUntil,
  };
}

function getPinnedOrderFromDom(list = getPinnedListElement()) {
  return getPinnedCards(list)
    .map((card) => card.dataset.pinnedId)
    .filter(Boolean);
}

function resolvePinnedDragCard(target) {
  if (!(target instanceof Element)) return null;
  return target.closest('#pinnedList .pinned-card');
}

function shouldInsertPinnedCardBefore(targetCard, event) {
  const rect = targetCard.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const deltaX = (event.clientX || centerX) - centerX;
  const deltaY = (event.clientY || centerY) - centerY;
  return Math.abs(deltaY) > Math.abs(deltaX)
    ? (event.clientY || centerY) < centerY
    : (event.clientX || centerX) < centerX;
}

function armPinnedDrag(pinnedId) {
  if (!pinnedId) return;
  closePinnedMenus();
  pinnedDragState.armedId = pinnedId;
}

function clearPinnedDragArm() {
  if (pinnedDragState.draggedId) return;
  pinnedDragState.armedId = null;
}

async function persistPinnedOrder(list = getPinnedListElement()) {
  const pinnedRepo = globalThis.TabOutPinnedRepo;
  if (!list || !pinnedRepo || typeof pinnedRepo.reorderPinnedEntries !== 'function') return;

  const nextOrder = getPinnedOrderFromDom(list);
  if (nextOrder.length === 0) return;
  if (nextOrder.join('|') === pinnedDragState.originalOrder.join('|')) return;

  await pinnedRepo.reorderPinnedEntries(nextOrder);
  await renderPinnedSurface();
}

function finishPinnedDrag(options = {}) {
  const { suppressClicks = false } = options;
  if (suppressClicks) {
    pinnedDragState.blockClicksUntil = Date.now() + 250;
  }
  resetPinnedDragState();
}

document.addEventListener('error', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return;
  if (target.dataset.hideBrokenImage !== 'true') return;
  target.style.display = 'none';
}, true);

/**
 * closeTabsByUrls(urls)
 *
 * Closes all open tabs whose hostname matches any of the given URLs.
 * After closing, re-fetches the tab list to keep our state accurate.
 *
 * Special case: file:// URLs are matched exactly (they have no hostname).
 */
async function closeTabsByUrls(urls) {
  if (!urls || urls.length === 0) return;

  // Separate file:// URLs (exact match) from regular URLs (hostname match)
  const targetHostnames = [];
  const exactUrls = new Set();

  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u);
    } else {
      try { targetHostnames.push(new URL(u).hostname); }
      catch { /* skip unparseable */ }
    }
  }

  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs
    .filter(tab => {
      const tabUrl = tab.url || '';
      if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
      try {
        const tabHostname = new URL(tabUrl).hostname;
        return tabHostname && targetHostnames.includes(tabHostname);
      } catch { return false; }
    })
    .map(tab => tab.id);

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabsExact(urls)
 *
 * Closes tabs by exact URL match (not hostname). Used for landing pages
 * so closing "Gmail inbox" doesn't also close individual email threads.
 */
async function closeTabsExact(urls) {
  if (!urls || urls.length === 0) return;
  const urlSet = new Set(urls);
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(t => urlSet.has(t.url)).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * focusTab(url)
 *
 * Switches Chrome to the tab with the given URL (exact match first,
 * then hostname fallback). Also brings the window to the front.
 */
async function focusTab(url) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  // Try exact URL match first
  let matches = allTabs.filter(t => t.url === url);

  // Fall back to hostname match
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }

  if (matches.length === 0) return;

  // Prefer a match in a different window so it actually switches windows
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

/**
 * closeDuplicateTabs(urls, keepOne)
 *
 * Closes duplicate tabs for the given list of URLs.
 * keepOne=true → keep one copy of each, close the rest.
 * keepOne=false → close all copies.
 */
async function closeDuplicateTabs(urls, keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const toClose = [];

  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== keep.id) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabOutDupes()
 *
 * Closes all duplicate Tab Out new-tab pages except the current one.
 */
async function closeTabOutDupes() {
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;

  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();
  const tabOutTabs = allTabs.filter(t =>
    t.url === newtabUrl || t.url === 'chrome://newtab/'
  );

  if (tabOutTabs.length <= 1) return;

  // Keep the active Tab Out tab in the CURRENT window — that's the one the
  // user is looking at right now. Falls back to any active one, then the first.
  const keep =
    tabOutTabs.find(t => t.active && t.windowId === currentWindow.id) ||
    tabOutTabs.find(t => t.active) ||
    tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}


/* ----------------------------------------------------------------
   LEGACY DEFERRED CLEANUP — chrome.storage.local

   Older builds stored "save for later" checklist items under the
   "deferred" key, with completed rows representing the archive.
   The current product no longer exposes that archive layer, so boot
   clears completed rows and strips the legacy fields from survivors.
   ---------------------------------------------------------------- */

let deferredCleanupPromise = null;

async function cleanupLegacyDeferredState() {
  if (deferredCleanupPromise) return deferredCleanupPromise;

  deferredCleanupPromise = (async () => {
    const stored = await chrome.storage.local.get('deferred');
    const deferred = Array.isArray(stored.deferred) ? stored.deferred : [];
    const cleaned = deferred
      .filter((item) => item && !item.completed)
      .map(({ completed, completedAt, ...rest }) => rest);
    const changed =
      cleaned.length !== deferred.length ||
      deferred.some((item) => item && ('completed' in item || 'completedAt' in item));

    if (changed) {
      await chrome.storage.local.set({ deferred: cleaned });
    }

    return cleaned;
  })().catch((error) => {
    deferredCleanupPromise = null;
    throw error;
  });

  return deferredCleanupPromise;
}

/**
 * saveTabForLater(tab)
 *
 * Queues a single tab for the new Reading inbox flow.
 * Applies same-URL dedupe and re-queues unfinished work instead of creating duplicates.
 * @param {{ id?: number, url: string, title: string }} tab
 */
async function saveTabForLater(tab) {
  const articlesRepo = globalThis.TabOutArticlesRepo;
  const jobsRepo = globalThis.TabOutJobsRepo;
  if (!articlesRepo || !jobsRepo) {
    throw new Error('Reading inbox repositories are unavailable');
  }

  const sourceRef = tab.id ? String(tab.id) : null;
  const lightweightCapture = sourceRef ? await resolveLightweightCaptureForSave(tab) : { payload: null, source: 'save-fallback' };

  const existing = await articlesRepo.findArticleByCanonicalUrl(tab.url);
  if (existing) {
    const captureAlreadyCompleted = !['queued', 'capturing', 'capture_failed'].includes(existing.processing_state);
    const hasCapturedPayload = Boolean(lightweightCapture.payload && lightweightCapture.payload.analysis_source_text);
    const shouldCloseAfterCapture = !captureAlreadyCompleted && Boolean(sourceRef) && !hasCapturedPayload;
    const refreshed = await articlesRepo.updateArticle(existing.id, {
      lifecycle_state: 'active',
      last_saved_at: new Date().toISOString(),
      source_ref: sourceRef || existing.source_ref || null,
      close_source_tab_after_capture: shouldCloseAfterCapture,
      capture_source: hasCapturedPayload ? lightweightCapture.source : existing.capture_source || lightweightCapture.source || null,
    });

    const checkpointState = getRetryCheckpointState(existing.processing_state);
    const shouldRequeue = checkpointState !== 'ready';
    if (!shouldRequeue) {
      return {
        article: refreshed,
        deduped: true,
        requeued: false,
        shouldCloseNow: captureAlreadyCompleted,
        shouldCloseAfterCapture,
      };
    }

    if (hasCapturedPayload) {
      const hydrated = await articlesRepo.updateArticle(
        existing.id,
        buildCapturedArticlePatch(tab, lightweightCapture.payload, lightweightCapture.source, {
          lifecycle_state: 'active',
          last_saved_at: new Date().toISOString(),
          source_ref: sourceRef || existing.source_ref || null,
        })
      );
      await jobsRepo.enqueueJob({
        article_id: existing.id,
        processing_state: 'captured',
      });
      return {
        article: hydrated,
        deduped: true,
        requeued: true,
        shouldCloseNow: Boolean(sourceRef),
        shouldCloseAfterCapture: false,
      };
    }

    const resetArticle = await articlesRepo.updateArticleProcessingState(existing.id, checkpointState);
    const finalArticle =
      resetArticle && (resetArticle.source_ref !== refreshed.source_ref ||
      resetArticle.close_source_tab_after_capture !== refreshed.close_source_tab_after_capture)
        ? await articlesRepo.updateArticle(existing.id, {
            source_ref: refreshed.source_ref,
            close_source_tab_after_capture: refreshed.close_source_tab_after_capture,
          })
        : resetArticle;
    await jobsRepo.enqueueJob({
      article_id: existing.id,
      processing_state: checkpointState,
    });

    return {
      article: finalArticle,
      deduped: true,
      requeued: true,
      shouldCloseNow: captureAlreadyCompleted,
      shouldCloseAfterCapture,
    };
  }

  const siteName = getSiteNameFromUrl(tab.url);
  const article = await articlesRepo.createQueuedArticle({
    source_type: 'tab',
    source_ref: sourceRef,
    url: tab.url,
    title: tab.title || tab.url,
    site_name: siteName,
    close_source_tab_after_capture: Boolean(sourceRef) && !lightweightCapture.payload,
    capture_source: lightweightCapture.source,
  });

  if (lightweightCapture.payload && lightweightCapture.payload.analysis_source_text) {
    const capturedArticle = await articlesRepo.updateArticle(
      article.id,
      buildCapturedArticlePatch(tab, lightweightCapture.payload, lightweightCapture.source)
    );
    await jobsRepo.enqueueJob({
      article_id: article.id,
      processing_state: 'captured',
    });

    return {
      article: capturedArticle,
      deduped: false,
      requeued: true,
      shouldCloseNow: Boolean(sourceRef),
      shouldCloseAfterCapture: false,
    };
  }

  await jobsRepo.enqueueJob({
    article_id: article.id,
    processing_state: 'queued',
  });

  return {
    article,
    deduped: false,
    requeued: true,
    shouldCloseNow: false,
    shouldCloseAfterCapture: Boolean(sourceRef),
  };
}

function getHomepageController() {
  return globalThis.TabOutHomepageController || null;
}

async function syncVisibleNowTabs(realTabs = getRealTabs()) {
  const controller = getHomepageController();
  const articlesRepo = globalThis.TabOutArticlesRepo;
  const articles = articlesRepo ? await articlesRepo.listArticles() : [];

  visibleNowTabs =
    controller && typeof controller.filterVisibleNowTabs === 'function'
      ? controller.filterVisibleNowTabs(realTabs, articles)
      : realTabs.slice();

  if (controller && typeof controller.setNowCount === 'function') {
    controller.setNowCount(visibleNowTabs.length);
  }

  return visibleNowTabs;
}

function normalizeDashboardUrl(rawUrl) {
  const candidate = String(rawUrl || '').trim();
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return '';
  }
}

function getLandingPagePatterns() {
  return [
    { hostname: 'mail.google.com', test: (p, h) =>
        !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
    { hostname: 'x.com', pathExact: ['/home'] },
    { hostname: 'www.linkedin.com', pathExact: ['/'] },
    { hostname: 'github.com', pathExact: ['/'] },
    { hostname: 'www.youtube.com', pathExact: ['/'] },
    ...(typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []),
  ];
}

function getDomainGroupId(domain) {
  return `domain-${String(domain || '').replace(/[^a-z0-9]/g, '-')}`;
}

function buildDomainGroupsFromTabs(currentTabs = []) {
  const landingPagePatterns = getLandingPagePatterns();

  function isLandingPage(url) {
    try {
      const parsed = new URL(url);
      return landingPagePatterns.some((pattern) => {
        const hostnameMatch = pattern.hostname
          ? parsed.hostname === pattern.hostname
          : pattern.hostnameEndsWith
            ? parsed.hostname.endsWith(pattern.hostnameEndsWith)
            : false;
        if (!hostnameMatch) return false;
        if (pattern.test) return pattern.test(parsed.pathname, url);
        if (pattern.pathPrefix) return parsed.pathname.startsWith(pattern.pathPrefix);
        if (pattern.pathExact) return pattern.pathExact.includes(parsed.pathname);
        return parsed.pathname === '/';
      });
    } catch {
      return false;
    }
  }

  const customGroups = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : [];

  function matchCustomGroup(url) {
    try {
      const parsed = new URL(url);
      return customGroups.find((rule) => {
        const hostMatch = rule.hostname
          ? parsed.hostname === rule.hostname
          : rule.hostnameEndsWith
            ? parsed.hostname.endsWith(rule.hostnameEndsWith)
            : false;
        if (!hostMatch) return false;
        if (rule.pathPrefix) return parsed.pathname.startsWith(rule.pathPrefix);
        return true;
      }) || null;
    } catch {
      return null;
    }
  }

  const groupMap = {};
  const landingTabs = [];

  for (const tab of currentTabs) {
    try {
      if (isLandingPage(tab.url)) {
        landingTabs.push(tab);
        continue;
      }

      const customRule = matchCustomGroup(tab.url);
      if (customRule) {
        const key = customRule.groupKey;
        if (!groupMap[key]) groupMap[key] = { domain: key, label: customRule.groupLabel, tabs: [] };
        groupMap[key].tabs.push(tab);
        continue;
      }

      const hostname =
        tab.url && tab.url.startsWith('file://')
          ? 'local-files'
          : new URL(tab.url).hostname;
      if (!hostname) continue;

      if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] };
      groupMap[hostname].tabs.push(tab);
    } catch {
      // Skip malformed URLs
    }
  }

  if (landingTabs.length > 0) {
    groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };
  }

  const landingHostnames = new Set(landingPagePatterns.map((pattern) => pattern.hostname).filter(Boolean));
  const landingSuffixes = landingPagePatterns.map((pattern) => pattern.hostnameEndsWith).filter(Boolean);
  function isLandingDomain(domain) {
    if (landingHostnames.has(domain)) return true;
    return landingSuffixes.some((suffix) => domain.endsWith(suffix));
  }

  domainGroups = Object.values(groupMap).sort((a, b) => {
    const aIsLanding = a.domain === '__landing-pages__';
    const bIsLanding = b.domain === '__landing-pages__';
    if (aIsLanding !== bIsLanding) return aIsLanding ? -1 : 1;

    const aIsPriority = isLandingDomain(a.domain);
    const bIsPriority = isLandingDomain(b.domain);
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

    return b.tabs.length - a.tabs.length;
  });

  return domainGroups;
}

function renderOpenTabsSectionHeader(groupCount, tabCount) {
  const openTabsSectionCount = document.getElementById('openTabsSectionCount');
  const openTabsSectionTitle = document.getElementById('openTabsSectionTitle');
  if (openTabsSectionTitle) openTabsSectionTitle.textContent = t('section.openNow');
  if (!openTabsSectionCount) return;

  if (groupCount <= 0) {
    openTabsSectionCount.textContent = t('counts.domains', { count: 0 });
    return;
  }

  openTabsSectionCount.innerHTML =
    `${t('counts.domains', { count: groupCount })} &nbsp;&middot;&nbsp; ` +
    `<button class="action-btn close-tabs" data-action="close-all-open-tabs" style="font-size:11px;padding:3px 10px;">` +
    `${ICONS.close} ${t('actions.closeAllTabs', { count: tabCount })}` +
    '</button>';
}

function renderOpenTabsSection(currentTabs = visibleNowTabs) {
  const openTabsSection = document.getElementById('openTabsSection');
  const openTabsMissionsEl = document.getElementById('openTabsMissions');
  const nextGroups = buildDomainGroupsFromTabs(currentTabs);

  if (nextGroups.length > 0 && openTabsSection && openTabsMissionsEl) {
    renderOpenTabsSectionHeader(nextGroups.length, currentTabs.length);
    openTabsMissionsEl.innerHTML = nextGroups.map((group) => renderDomainCard(group)).join('');
    openTabsSection.style.display = 'block';
  } else if (openTabsSection) {
    openTabsSection.style.display = 'none';
  }

  return nextGroups;
}

async function closeTabById(tabId, options = {}) {
  if (!tabId || typeof chrome === 'undefined' || !chrome.tabs) {
    return { closed: false, skippedActive: false };
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (options.skipIfActive && tab && tab.active) {
      return { closed: false, skippedActive: true, tab };
    }
    await chrome.tabs.remove(tabId);
    return { closed: true, skippedActive: false, tab };
  } catch {
    return { closed: false, skippedActive: false };
  }
}

async function closeTabByUrl(tabUrl, options = {}) {
  if (!tabUrl || typeof chrome === 'undefined' || !chrome.tabs) {
    return { closed: false, skippedActive: false };
  }

  const allTabs = await chrome.tabs.query({});
  const match = allTabs.find((tab) => tab.url === tabUrl);
  if (!match) {
    return { closed: false, skippedActive: false };
  }

  return closeTabById(match.id, options);
}

function animateNowChipOut(chip, options = {}) {
  if (!chip) {
    if (typeof options.onDone === 'function') {
      options.onDone();
    }
    return;
  }

  if (options.playEffects !== false) {
    const rect = chip.getBoundingClientRect();
    shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  chip.style.transition = 'opacity 0.2s, transform 0.2s';
  chip.style.opacity = '0';
  chip.style.transform = 'scale(0.8)';
  setTimeout(() => {
    chip.remove();
    if (typeof options.onDone === 'function') {
      options.onDone();
    }
  }, 200);
}

async function reconcileVisibleNowRemoval(tabUrl, options = {}) {
  const normalizedUrl = normalizeDashboardUrl(tabUrl);
  if (!normalizedUrl) return;

  const targetChips = options.chipEl
    ? [options.chipEl]
    : Array.from(document.querySelectorAll('.page-chip[data-action="focus-tab"]')).filter(
        (chip) => normalizeDashboardUrl(chip.dataset.tabUrl) === normalizedUrl
      );
  const affectedCards = Array.from(
    new Set(targetChips.map((chip) => chip.closest('.mission-card')).filter(Boolean))
  );

  if (options.closePhysicalTab) {
    const closeResult = options.tabId
      ? await closeTabById(options.tabId)
      : await closeTabByUrl(tabUrl);
    if (closeResult.closed) {
      await fetchOpenTabs();
    }
  }

  const nextVisibleTabs = await syncVisibleNowTabs();
  const nextGroups = buildDomainGroupsFromTabs(nextVisibleTabs);
  const nextGroupsById = new Map(nextGroups.map((group) => [getDomainGroupId(group.domain), group]));
  const playEffects = options.playEffects !== false;

  renderOpenTabsSectionHeader(nextGroups.length, nextVisibleTabs.length);

  const openTabsSection = document.getElementById('openTabsSection');
  if (openTabsSection) {
    openTabsSection.style.display = 'block';
  }

  if (options.playSound) {
    playCloseSound();
  }

  if (!affectedCards.length) {
    if (nextGroups.length > 0) {
      renderOpenTabsSection(nextVisibleTabs);
    } else {
      checkAndShowEmptyState();
    }
    return;
  }

  affectedCards.forEach((card) => {
    if (!card) return;

    const domainId = card.dataset.domainId;
    const nextGroup = nextGroupsById.get(domainId) || null;
    const urlStillVisible =
      nextGroup &&
      nextGroup.tabs.some((tab) => normalizeDashboardUrl(tab.url) === normalizedUrl);
    const chipsForCard = targetChips.filter((chip) => chip.closest('.mission-card') === card);

    if (!options.animate || !chipsForCard.length || urlStillVisible) {
      if (nextGroup) {
        card.outerHTML = renderDomainCard(nextGroup);
      } else if (playEffects) {
        animateCardOut(card, { playEffects });
      } else {
        card.remove();
        checkAndShowEmptyState();
      }
      return;
    }

    let remaining = chipsForCard.length;
    const finalizeCard = () => {
      remaining -= 1;
      if (remaining > 0) return;
      const currentCard = document.querySelector(`.mission-card[data-domain-id="${domainId}"]`) || card;
      if (!currentCard) return;
      if (nextGroup) {
        currentCard.outerHTML = renderDomainCard(nextGroup);
      } else if (playEffects) {
        animateCardOut(currentCard, { playEffects });
      } else {
        currentCard.remove();
        checkAndShowEmptyState();
      }
    };

    chipsForCard.forEach((chip) => {
      animateNowChipOut(chip, {
        playEffects,
        onDone: finalizeCard,
      });
    });
  });
}

function getI18n() {
  return globalThis.TabOutI18n || null;
}

function t(key, params) {
  const i18n = getI18n();
  return i18n ? i18n.t(key, params) : key;
}

function getCurrentLocale() {
  const i18n = getI18n();
  return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en-US';
}

async function applyLanguagePreference(preference) {
  const i18n = getI18n();
  if (!i18n || typeof i18n.setLanguagePreference !== 'function') return;
  i18n.setLanguagePreference(
    preference || 'auto',
    (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
  );
  i18n.apply(document);
  document.documentElement.lang = i18n.getEffectiveLanguage();
}

async function initializeLanguagePreference() {
  if (!globalThis.TabOutSettingsRepo) {
    await applyLanguagePreference('auto');
    return;
  }

  const settings = await globalThis.TabOutSettingsRepo.getAiSettings();
  await applyLanguagePreference(settings.language_preference || 'auto');
}

function getSiteNameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeCaptureUrl(url) {
  if (globalThis.TabOutArticlesRepo && typeof globalThis.TabOutArticlesRepo.normalizeUrl === 'function') {
    return globalThis.TabOutArticlesRepo.normalizeUrl(url);
  }
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url || '';
  }
}

function getPreheatEntryKey(tabId, url) {
  return `${Number(tabId) || 0}:${normalizeCaptureUrl(url)}`;
}

function clonePreheatEntry(entry) {
  if (!entry) return null;
  return {
    key: entry.key,
    tabId: entry.tabId,
    url: entry.url,
    status: entry.status,
    capturedAt: entry.capturedAt || null,
    payload: entry.payload ? { ...entry.payload } : null,
    errorCode: entry.errorCode || null,
    errorMessage: entry.errorMessage || null,
  };
}

function upsertPreheatEntry(input) {
  const key = input.key || getPreheatEntryKey(input.tabId, input.url);
  const next = {
    key,
    tabId: input.tabId,
    url: input.url,
    status: input.status || 'pending',
    capturedAt: input.capturedAt || null,
    payload: input.payload ? { ...input.payload } : null,
    errorCode: input.errorCode || null,
    errorMessage: input.errorMessage || null,
    promise: input.promise || null,
  };
  preheatEntries.set(key, next);
  return next;
}

function clearPreheatEntries() {
  preheatEntries.clear();
  preheatQueue = [];
  preheatInFlight = 0;
  preheatKickScheduled = false;
}

function seedPreheatEntry(input) {
  return clonePreheatEntry(upsertPreheatEntry(input));
}

function getPreheatEntriesSnapshot() {
  return Array.from(preheatEntries.values()).map(clonePreheatEntry);
}

function isReadyPreheatEntry(entry) {
  return Boolean(entry && entry.status === 'ready' && entry.payload && entry.payload.analysis_source_text);
}

function getCaptureSourceLabel(captureSource) {
  switch (captureSource) {
    case 'prefetch-hit':
      return t('debug.sourcePrefetchHit');
    case 'save-fallback':
      return t('debug.sourceSaveFallback');
    case 'retry':
      return t('debug.sourceRetry');
    default:
      return t('debug.sourceUnknown');
  }
}

function buildCapturedArticlePatch(tab, payload, captureSource, overrides = {}) {
  return {
    title: payload.title || tab.title || tab.url,
    url: tab.url,
    site_name: payload.site_name || getSiteNameFromUrl(tab.url),
    analysis_source_text: payload.analysis_source_text || null,
    excerpt: payload.excerpt || null,
    word_count: payload.word_count || null,
    language: payload.language || null,
    author: payload.author || null,
    lead_image_url: payload.lead_image_url || null,
    capture_source: captureSource || null,
    processing_state: 'captured',
    close_source_tab_after_capture: false,
    last_error_code: null,
    last_error_message: null,
    ...overrides,
  };
}

async function awaitPreheatEntry(key, timeoutMs = LIGHTWEIGHT_PREHEAT_WAIT_MS) {
  const entry = preheatEntries.get(key);
  if (!entry || !entry.promise) return clonePreheatEntry(entry);
  try {
    await Promise.race([
      entry.promise.catch(() => null),
      new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // Ignore and fall through to the latest cached state.
  }
  return clonePreheatEntry(preheatEntries.get(key));
}

async function resolveLightweightCaptureForSave(tab) {
  if (!tab || !tab.id || !globalThis.TabOutCapture) {
    return { payload: null, source: 'save-fallback' };
  }

  const key = getPreheatEntryKey(tab.id, tab.url);
  const existing = preheatEntries.get(key);
  if (isReadyPreheatEntry(existing)) {
    return { payload: { ...existing.payload }, source: 'prefetch-hit' };
  }

  if (existing && existing.status === 'pending') {
    const settled = await awaitPreheatEntry(key);
    if (isReadyPreheatEntry(settled)) {
      return { payload: { ...settled.payload }, source: 'prefetch-hit' };
    }
  }

  try {
    const payload = await globalThis.TabOutCapture.captureTab(
      { id: tab.id, url: tab.url },
      { mode: 'light', timeoutMs: LIGHTWEIGHT_PREHEAT_TIMEOUT_MS }
    );
    upsertPreheatEntry({
      key,
      tabId: tab.id,
      url: tab.url,
      status: 'ready',
      capturedAt: new Date().toISOString(),
      payload,
      errorCode: null,
      errorMessage: null,
      promise: null,
    });
    return { payload, source: 'save-fallback' };
  } catch (error) {
    if (existing) {
      upsertPreheatEntry({
        ...existing,
        status: 'failed',
        errorCode: error && error.code ? error.code : 'unknown_error',
        errorMessage: error && error.message ? error.message : String(error),
        promise: null,
      });
    }
    return { payload: null, source: 'save-fallback' };
  }
}

function normalizePinnedEntryUrl(rawUrl) {
  const candidate = String(rawUrl || '').trim();
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function getPinnedEntryDisplayTitle(entry) {
  if (!entry) return '';
  const title = String(entry.title || '').trim();
  if (title) return title;
  return getSiteNameFromUrl(entry.url) || entry.url || '';
}

function getRetryCheckpointState(processingState) {
  if (processingState === 'capture_failed' || processingState === 'queued' || processingState === 'capturing') {
    return 'queued';
  }
  if (
    processingState === 'analysis_failed' ||
    processingState === 'waiting_for_ai' ||
    processingState === 'captured' ||
    processingState === 'analyzing' ||
    processingState === 'ready'
  ) {
    return 'captured';
  }
  return processingState || 'queued';
}

function isAiReadyStatus(aiStatus) {
  return Boolean(aiStatus && aiStatus.state === 'ready');
}

function getProcessingTone(processingState) {
  if (['capture_failed', 'analysis_failed'].includes(processingState)) {
    return 'warning';
  }
  if (['ready'].includes(processingState)) {
    return 'ready';
  }
  return 'pending';
}

function getProcessingLabel(processingState) {
  switch (processingState) {
    case 'queued':
      return t('processing.queued');
    case 'capturing':
      return t('processing.capturing');
    case 'captured':
      return t('processing.captured');
    case 'analyzing':
      return t('processing.analyzing');
    case 'ready':
      return t('processing.ready');
    case 'waiting_for_ai':
      return t('processing.waiting_for_ai');
    case 'capture_failed':
      return t('processing.capture_failed');
    case 'analysis_failed':
      return t('processing.analysis_failed');
    default:
      return t('processing.pending');
  }
}

function getRetryActionLabel(article, aiReady) {
  if (article.processing_state === 'capture_failed') {
    return t('actions.retryCapture');
  }
  if (article.processing_state === 'analysis_failed') {
    return t('actions.retryAnalysis');
  }
  if (article.processing_state === 'waiting_for_ai' && aiReady) {
    return t('actions.resumeAnalysis');
  }
  return t('actions.retry');
}

function getInlineReason(article) {
  return article.processing_state === 'ready' ? getShortReason(article) : '';
}

function getStatusDetailLabel(article, job, aiReady) {
  const retryTime = job && job.next_retry_at ? timeAgo(job.next_retry_at) : '';

  switch (article.processing_state) {
    case 'waiting_for_ai':
      return aiReady
        ? t('statusDetail.waitingForAiReady')
        : t('statusDetail.waitingForAiBlocked');
    case 'capture_failed':
      return t('statusDetail.captureFailed', {
        reason: t(`statusReason.${article.last_error_code || 'unknown_error'}`),
        retry: retryTime ? t('statusDetail.autoRetryAt', { time: retryTime }) : t('statusDetail.manualRetry'),
        action: t('statusDetail.retryCaptureAction'),
      });
    case 'analysis_failed':
      return t('statusDetail.analysisFailed', {
        reason: t(`statusReason.${article.last_error_code || 'unknown_error'}`),
        retry: retryTime ? t('statusDetail.autoRetryAt', { time: retryTime }) : t('statusDetail.manualRetry'),
        action: t('statusDetail.retryAnalysisAction'),
      });
    default:
      return '';
  }
}

function getShortReason(article) {
  if (article.short_reason) {
    return article.short_reason;
  }
  if (article.processing_state === 'capture_failed') {
    return t('reason.captureFailed');
  }
  if (article.processing_state === 'analysis_failed') {
    return t('reason.analysisFailed');
  }
  if (article.processing_state === 'waiting_for_ai') {
    return t('reason.waitingForAi');
  }
  if (article.processing_state === 'ready') {
    return t('reason.readyToReopen');
  }
  return t('reason.waitingForPipeline');
}

function getPriorityBucket(article) {
  if (['read_now', 'worth_keeping', 'skim_later'].includes(article.priority_bucket)) {
    return article.priority_bucket;
  }
  return article.processing_state === 'ready' ? 'worth_keeping' : 'skim_later';
}

function getPriorityHeading(bucket) {
  switch (bucket) {
    case 'read_now':
      return t('reading.priority.readNow');
    case 'worth_keeping':
      return t('reading.priority.worthKeeping');
    default:
      return t('reading.priority.skimLater');
  }
}

function getReadingTimeLabel(article) {
  const estimate = Number(article.reading_time_estimate);
  if (Number.isFinite(estimate) && estimate > 0) {
    return t('reading.readingTimeMinutes', { count: estimate });
  }
  const words = Number(article.word_count);
  if (Number.isFinite(words) && words > 0) {
    return t('reading.readingTimeMinutes', { count: Math.max(1, Math.round(words / 200)) });
  }
  return '';
}

function getArticleSource(article) {
  return article.site_name || getSiteNameFromUrl(article.url);
}

function getArticleTimeBucket(article) {
  const source = article.last_saved_at || article.saved_at;
  if (!source) return 'older';
  const diffDays = Math.floor((Date.now() - new Date(source).getTime()) / 86400000);
  if (diffDays < 1) return 'today';
  if (diffDays < 3) return 'last_3_days';
  if (diffDays < 7) return 'last_7_days';
  return 'older';
}

function getArticleStatusTokens(article) {
  const tokens = [];
  if (article.processing_state === 'ready') {
    tokens.push('ready');
  } else if (['capture_failed', 'analysis_failed'].includes(article.processing_state)) {
    tokens.push('failed');
  } else {
    tokens.push('processing');
  }
  tokens.push(article.last_opened_at ? 'opened' : 'unopened');
  return tokens;
}

function isReadingLibraryArticle(article) {
  return Boolean(article) && ['active', 'read'].includes(article.lifecycle_state || 'active');
}

function matchesReadingLifecycle(article, lifecycle) {
  if (!isReadingLibraryArticle(article)) return false;
  if (!lifecycle || lifecycle === 'all') return true;
  return (article.lifecycle_state || 'active') === lifecycle;
}

function needsReadingMetadataBackfill(article) {
  if (!article) return false;
  if (
    ['queued', 'capturing', 'captured', 'analyzing', 'capture_failed', 'analysis_failed', 'waiting_for_ai'].includes(
      article.processing_state
    )
  ) {
    return false;
  }
  const hasLabels = Array.isArray(article.labels) && article.labels.length > 0;
  return !hasLabels || !article.priority_bucket || !article.short_reason;
}

async function ensureReadingMetadataBackfill(articles) {
  const jobsRepo = globalThis.TabOutJobsRepo;
  const articlesRepo = globalThis.TabOutArticlesRepo;
  if (!jobsRepo || !articlesRepo) return false;

  let enqueued = false;
  for (const article of articles) {
    if (!needsReadingMetadataBackfill(article)) continue;
    const existingJob = await jobsRepo.getJobByArticleId(article.id);
    if (existingJob && existingJob.processing_state !== 'ready') continue;

    const checkpointState = article.analysis_source_text || article.markdown_content ? 'captured' : 'queued';
    await articlesRepo.updateArticleProcessingState(article.id, checkpointState);
    article.processing_state = checkpointState;
    await jobsRepo.enqueueJob({
      article_id: article.id,
      processing_state: checkpointState,
    });
    enqueued = true;
  }

  if (enqueued) {
    await kickBackgroundJobs();
  }
  return enqueued;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    String(left).localeCompare(String(right))
  );
}

function normalizeReadingFilterKind(kind) {
  return kind === 'label' ? 'labels' : kind;
}

function deriveReadingFilters(articles) {
  const libraryArticles = (articles || []).filter(isReadingLibraryArticle);
  return {
    lifecycle: [
      { value: 'all', count: libraryArticles.length },
      {
        value: 'active',
        count: libraryArticles.filter((article) => (article.lifecycle_state || 'active') === 'active').length,
      },
      {
        value: 'read',
        count: libraryArticles.filter((article) => article.lifecycle_state === 'read').length,
      },
    ],
    labels: uniqueSorted(libraryArticles.flatMap((article) => article.labels || []))
      .map((value) => ({
        value,
        count: libraryArticles.filter((article) => (article.labels || []).includes(value)).length,
      }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value)),
    sources: uniqueSorted(libraryArticles.map(getArticleSource)).map((value) => ({
      value,
      count: libraryArticles.filter((article) => getArticleSource(article) === value).length,
    })),
    times: ['today', 'last_3_days', 'last_7_days', 'older']
      .map((value) => ({
        value,
        count: libraryArticles.filter((article) => getArticleTimeBucket(article) === value).length,
      }))
      .filter((entry) => entry.count > 0),
    statuses: ['ready', 'processing', 'failed', 'unopened', 'opened']
      .map((value) => ({
        value,
        count: libraryArticles.filter((article) => getArticleStatusTokens(article).includes(value)).length,
      }))
      .filter((entry) => entry.count > 0),
  };
}

function applyReadingFilters(articles, filterState) {
  const query = (filterState.search || '').trim().toLowerCase();
  const activeStatus = Array.isArray(filterState.status)
    ? (filterState.status[0] || '')
    : (filterState.status || '');
  return (articles || []).filter((article) => {
    if (!matchesReadingLifecycle(article, filterState.lifecycle || 'active')) {
      return false;
    }
    if (query) {
      const haystack = `${article.title || ''} ${article.url || ''} ${getArticleSource(article)}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filterState.labels.length > 0 && !filterState.labels.every((label) => (article.labels || []).includes(label))) {
      return false;
    }
    if (filterState.source && getArticleSource(article) !== filterState.source) {
      return false;
    }
    if (filterState.time && getArticleTimeBucket(article) !== filterState.time) {
      return false;
    }
    if (activeStatus) {
      const tokens = getArticleStatusTokens(article);
      if (!tokens.includes(activeStatus)) {
        return false;
      }
    }
    return true;
  });
}

function groupReadingResultsByPriority(articles) {
  const order = ['read_now', 'worth_keeping', 'skim_later'];
  return order
    .map((bucket) => ({
      id: bucket,
      title: getPriorityHeading(bucket),
      articles: articles
        .filter((article) => getPriorityBucket(article) === bucket)
        .sort(
          (left, right) =>
            new Date(right.last_saved_at || right.saved_at || 0).getTime() -
            new Date(left.last_saved_at || left.saved_at || 0).getTime()
        ),
    }))
    .filter((group) => group.articles.length > 0);
}

function buildActiveFilterChips(filterState) {
  const chips = [];
  if (filterState.search) {
    chips.push({ kind: 'search', value: filterState.search, label: `${t('reading.filters.search')}: ${filterState.search}` });
  }
  filterState.labels.forEach((value) => {
    chips.push({ kind: 'label', value, label: value });
  });
  if (filterState.source) {
    chips.push({ kind: 'source', value: filterState.source, label: filterState.source });
  }
  if (filterState.time) {
    chips.push({ kind: 'time', value: filterState.time, label: t(`reading.time.${filterState.time}`) });
  }
  const activeStatus = Array.isArray(filterState.status)
    ? (filterState.status[0] || '')
    : (filterState.status || '');
  if (activeStatus) {
    chips.push({ kind: 'status', value: activeStatus, label: t(`reading.status.${activeStatus}`) });
  }
  return chips;
}

function renderFilterOption(kind, value, label, count, active) {
  return `
    <button class="reading-filter-option${active ? ' active' : ''}" type="button" data-action="toggle-reading-filter" data-filter-kind="${escapeAttribute(kind)}" data-filter-value="${escapeAttribute(value)}">
      <span>${label}</span>
      <span>${count}</span>
    </button>
  `;
}

function renderReadingFiltersHtml(filters, filterState) {
  const activeSource = filterState.source;
  const activeTime = filterState.time;
  const activeLifecycle = filterState.lifecycle || 'active';
  const activeStatus = Array.isArray(filterState.status)
    ? (filterState.status[0] || '')
    : (filterState.status || '');
  return `
    <div class="reading-filter-stack">
      <label class="reading-filter-search">
        <span>${t('reading.filters.search')}</span>
        <input id="readingFilterSearch" type="search" value="${escapeAttribute(filterState.search)}" placeholder="${escapeAttribute(t('reading.searchPlaceholder'))}">
      </label>
      <section class="reading-filter-section">
        <h3>${t('reading.filters.lifecycle')}</h3>
        <div class="reading-filter-options reading-filter-options-inline" data-filter-group="lifecycle">
          ${filters.lifecycle.map((entry) => renderFilterOption('lifecycle', entry.value, t(`reading.lifecycle.${entry.value}`), entry.count, activeLifecycle === entry.value)).join('')}
        </div>
      </section>
      <section class="reading-filter-section">
        <h3>${t('reading.filters.labels')}</h3>
        <div class="reading-filter-options reading-filter-options-wrap" data-filter-group="labels">
          ${filters.labels.map((entry) => renderFilterOption('label', entry.value, entry.value, entry.count, filterState.labels.includes(entry.value))).join('') || `<p class="reading-filter-empty">${t('reading.filters.empty')}</p>`}
        </div>
      </section>
      <section class="reading-filter-section">
        <h3>${t('reading.filters.source')}</h3>
        <div class="reading-filter-options">
          ${filters.sources.map((entry) => renderFilterOption('source', entry.value, entry.value, entry.count, activeSource === entry.value)).join('')}
        </div>
      </section>
      <section class="reading-filter-section">
        <h3>${t('reading.filters.time')}</h3>
        <div class="reading-filter-options">
          ${filters.times.map((entry) => renderFilterOption('time', entry.value, t(`reading.time.${entry.value}`), entry.count, activeTime === entry.value)).join('')}
        </div>
      </section>
      <section class="reading-filter-section">
        <h3>${t('reading.filters.status')}</h3>
        <div class="reading-filter-options">
          ${filters.statuses.map((entry) => renderFilterOption('status', entry.value, t(`reading.status.${entry.value}`), entry.count, activeStatus === entry.value)).join('')}
        </div>
      </section>
      <button class="reading-clear-filters" type="button" data-action="clear-reading-filters">${t('reading.clearFilters')}</button>
    </div>
  `;
}

function renderReadingResultsSummaryHtml(totalCount, visibleCount, filterState) {
  const chips = buildActiveFilterChips(filterState);
  return `
    <div class="reading-results-summary-bar">
      <div class="reading-results-count">${t('reading.resultsCount', { count: visibleCount, total: totalCount })}</div>
      <div class="reading-active-filters">
        ${chips.map((chip) => `<span class="reading-active-filter">${chip.label}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderReadingResultCard(article, options = {}) {
  const safeTitle = (article.title || article.url || '').replace(/"/g, '&quot;');
  const safeUrl = (article.url || '').replace(/"/g, '&quot;');
  const processingLabel = getProcessingLabel(article.processing_state);
  const processingTone = getProcessingTone(article.processing_state);
  const aiReady = isAiReadyStatus(options.aiStatus) || options.aiReady === true;
  const relatedJob = (options.jobsByArticleId && options.jobsByArticleId[article.id]) || null;
  const statusDetail = getStatusDetailLabel(article, relatedJob, aiReady);
  const safeStatusDetail = statusDetail.replace(/"/g, '&quot;');
  const reason = getInlineReason(article);
  const isRetryable =
    ['capture_failed', 'analysis_failed'].includes(article.processing_state) ||
    (article.processing_state === 'waiting_for_ai' && aiReady);
  const isReadView = article.lifecycle_state === 'read';
  const readingTimeLabel = getReadingTimeLabel(article);
  const labels = (article.labels || []).slice(0, 4);
  const labelsPlaceholder =
    article.processing_state === 'waiting_for_ai'
      ? t('reading.labelsWaitingForAi')
      : t('reading.labelsPending');
  const labelHtml = []
    .concat(article.lifecycle_state === 'read' ? [`<span class="reading-result-label">${t('reading.lifecycle.read')}</span>`] : [])
    .concat(labels.map((label) => `<span class="reading-result-label">${label}</span>`))
    .join('');
  const primaryAction = `<button class="reading-item-action primary" type="button" data-action="open-article-source" data-article-url="${safeUrl}">${t('actions.open')}</button>`;
  const secondaryAction = isReadView
    ? ''
    : `<button class="reading-item-action" type="button" data-action="mark-article-read" data-article-id="${article.id}">${t('actions.markRead')}</button>`;
  const retryAction = isRetryable
    ? `<button class="reading-item-action" type="button" data-action="retry-article" data-article-id="${article.id}">${getRetryActionLabel(article, aiReady)}</button>`
    : '';
  const metaBits = [getArticleSource(article), timeAgo(article.last_saved_at || article.saved_at), readingTimeLabel]
    .filter(Boolean)
    .map((value) => `<span>${value}</span>`)
    .join('');

  return `
    <article class="reading-result-card" data-article-id="${article.id}">
      <div class="reading-result-main">
        <div class="reading-result-heading">
          <button class="reading-result-title" type="button" data-action="open-article-source" data-article-url="${safeUrl}" title="${safeTitle}">${article.title || article.url}</button>
          <span class="reading-item-processing ${processingTone}" ${statusDetail ? `title="${safeStatusDetail}"` : ''}>${processingLabel}</span>
        </div>
        <div class="reading-result-meta">${metaBits}</div>
        <div class="reading-result-labels">${labelHtml || `<span class="reading-result-label muted">${labelsPlaceholder}</span>`}</div>
        ${reason ? `<p class="reading-result-reason">${reason}</p>` : ''}
      </div>
      <div class="reading-result-actions">
        ${primaryAction}
        ${secondaryAction}
        <button class="reading-item-action" type="button" data-action="delete-article" data-article-id="${article.id}">${t('actions.delete')}</button>
        ${retryAction}
      </div>
      <div class="reading-item-delete-confirm" data-delete-confirm-for="${article.id}">
        <span>${t('reading.deleteConfirm')}</span>
        <button class="reading-item-action danger" type="button" data-action="confirm-delete-article" data-article-id="${article.id}">${t('actions.delete')}</button>
        <button class="reading-item-action" type="button" data-action="cancel-delete-article" data-article-id="${article.id}">${t('actions.cancel')}</button>
      </div>
    </article>
  `;
}

function renderReadingResultGroupsHtml(groups, options = {}) {
  return groups
    .map((group) => `
      <section class="reading-result-group" data-priority-group="${group.id}">
        <div class="reading-result-group-header">
          <h3>${group.title}</h3>
          <span>${t('counts.articles', { count: group.articles.length })}</span>
        </div>
        <div class="reading-result-list">
          ${group.articles.map((article) => renderReadingResultCard(article, options)).join('')}
        </div>
      </section>
    `)
    .join('');
}

function isLikelyReadingTab(tab) {
  try {
    const parsed = new URL(tab.url);
    const path = parsed.pathname.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'mail.google.com' ||
      host === 'calendar.google.com' ||
      host === 'github.com' && path === '/' ||
      host === 'x.com' && path === '/home'
    ) {
      return false;
    }

    const pathSegments = path.split('/').filter(Boolean);
    const articlePath = /(article|blog|post|news|guide|docs|read|story)/.test(path);
    const longTitle = (tab.title || '').trim().length >= 42;
    return articlePath || pathSegments.length >= 2 || longTitle;
  } catch {
    return false;
  }
}

function isUnsupportedSaveUrl(url) {
  return (
    !url ||
    url.startsWith('file://') ||
    url.startsWith('https://chromewebstore.google.com') ||
    url.startsWith('https://chrome.google.com/webstore')
  );
}

function pickPreheatCandidates(tabs, limit = LIGHTWEIGHT_PREHEAT_LIMIT) {
  return (tabs || [])
    .filter((tab) => {
      if (!tab || !tab.id || isUnsupportedSaveUrl(tab.url)) return false;
      if (tab.isTabOut) return false;
      if (!isLikelyReadingTab(tab)) return false;
      if (globalThis.TabOutCapture && typeof globalThis.TabOutCapture.isUnsupportedCaptureUrl === 'function') {
        return !globalThis.TabOutCapture.isUnsupportedCaptureUrl(tab.url);
      }
      return true;
    })
    .slice(0, limit);
}

function syncPreheatEntriesWithTabs(tabs) {
  const liveKeys = new Set((tabs || []).map((tab) => getPreheatEntryKey(tab.id, tab.url)));
  preheatEntries.forEach((entry, key) => {
    if (!liveKeys.has(key) && entry.status !== 'stale') {
      preheatEntries.set(key, {
        ...entry,
        status: 'stale',
        promise: null,
      });
    }
  });
}

async function runPreheatForTab(tab) {
  const key = getPreheatEntryKey(tab.id, tab.url);
  const pending = upsertPreheatEntry({
    tabId: tab.id,
    url: tab.url,
    status: 'pending',
    errorCode: null,
    errorMessage: null,
  });

  const promise = globalThis.TabOutCapture.captureTab(
    { id: tab.id, url: tab.url },
    { mode: 'light', timeoutMs: LIGHTWEIGHT_PREHEAT_TIMEOUT_MS }
  )
    .then((payload) => {
      upsertPreheatEntry({
        ...pending,
        key,
        status: 'ready',
        capturedAt: new Date().toISOString(),
        payload,
        errorCode: null,
        errorMessage: null,
        promise: null,
      });
    })
    .catch((error) => {
      upsertPreheatEntry({
        ...pending,
        key,
        status: 'failed',
        capturedAt: new Date().toISOString(),
        payload: null,
        errorCode: error && error.code ? error.code : 'unknown_error',
        errorMessage: error && error.message ? error.message : String(error),
        promise: null,
      });
    });

  upsertPreheatEntry({
    ...pending,
    key,
    promise,
  });

  await promise;
}

async function pumpPreheatQueue() {
  if (preheatInFlight >= LIGHTWEIGHT_PREHEAT_CONCURRENCY || preheatQueue.length === 0) return;
  if (!globalThis.TabOutCapture || typeof globalThis.TabOutCapture.captureTab !== 'function') return;

  const nextTab = preheatQueue.shift();
  preheatInFlight += 1;
  try {
    await runPreheatForTab(nextTab);
  } finally {
    preheatInFlight -= 1;
    if (preheatQueue.length > 0) {
      await pumpPreheatQueue();
    }
  }
}

function kickPreheatQueue() {
  if (preheatKickScheduled) return;
  preheatKickScheduled = true;

  const schedule = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback.bind(window)
    : (callback) => window.setTimeout(callback, 0);

  schedule(async () => {
    preheatKickScheduled = false;
    await pumpPreheatQueue();
  });
}

function scheduleLightweightPreheat(tabs) {
  syncPreheatEntriesWithTabs(tabs);
  const nextCandidates = pickPreheatCandidates(tabs).filter((tab) => {
    const entry = preheatEntries.get(getPreheatEntryKey(tab.id, tab.url));
    return !entry || entry.status === 'failed';
  });
  if (nextCandidates.length === 0) return;
  preheatQueue = nextCandidates;
  kickPreheatQueue();
}


/* ----------------------------------------------------------------
   UI HELPERS
   ---------------------------------------------------------------- */

/**
 * playCloseSound()
 *
 * Plays a clean "swoosh" sound when tabs are closed.
 * Built entirely with the Web Audio API — no sound files needed.
 * A filtered noise sweep that descends in pitch, like air moving.
 */
function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    // Swoosh: shaped white noise through a sweeping bandpass filter
    const duration = 0.25;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate noise with a natural envelope (quick attack, smooth decay)
    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length;
      // Envelope: ramps up fast in first 10%, then fades out smoothly
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter sweeps from high to low — creates the "swoosh" character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);

    // Volume
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not supported — fail silently
  }
}

/**
 * shootConfetti(x, y)
 *
 * Shoots a burst of colorful confetti particles from the given screen
 * coordinates (typically the center of a card being closed).
 * Pure CSS + JS, no libraries.
 */
function shootConfetti(x, y) {
  const colors = [
    '#c8713a', // amber
    '#e8a070', // amber light
    '#5a7a62', // sage
    '#8aaa92', // sage light
    '#5a6b7a', // slate
    '#8a9baa', // slate light
    '#d4b896', // warm paper
    '#b35a5a', // rose
  ];

  const particleCount = 17;

  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('div');

    const isCircle = Math.random() > 0.5;
    const size = 5 + Math.random() * 6; // 5–11px
    const color = colors[Math.floor(Math.random() * colors.length)];

    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      opacity: 1;
    `;
    document.body.appendChild(el);

    // Physics: random angle and speed for the outward burst
    const angle   = Math.random() * Math.PI * 2;
    const speed   = 60 + Math.random() * 120;
    const vx      = Math.cos(angle) * speed;
    const vy      = Math.sin(angle) * speed - 80; // bias upward
    const gravity = 200;

    const startTime = performance.now();
    const duration  = 700 + Math.random() * 200; // 700–900ms

    function frame(now) {
      const elapsed  = (now - startTime) / 1000;
      const progress = elapsed / (duration / 1000);

      if (progress >= 1) { el.remove(); return; }

      const px = vx * elapsed;
      const py = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
      const opacity = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;
      const rotate  = elapsed * 200 * (isCircle ? 0 : 1);

      el.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) rotate(${rotate}deg)`;
      el.style.opacity = opacity;

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
}

/**
 * animateCardOut(card)
 *
 * Smoothly removes a mission card: fade + scale down, then confetti.
 * After the animation, checks if the grid is now empty.
 */
function animateCardOut(card, options = {}) {
  if (!card) return;

  if (options.playEffects !== false) {
    const rect = card.getBoundingClientRect();
    shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  card.classList.add('closing');
  setTimeout(() => {
    card.remove();
    checkAndShowEmptyState();
  }, 300);
}

/**
 * showToast(message)
 *
 * Brief pop-up notification at the bottom of the screen.
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

function setPinnedMenuOpen(card, open) {
  if (!card) return;
  const trigger = card.querySelector('.pinned-menu-trigger');
  const menu = card.querySelector('.pinned-card-menu');
  card.classList.toggle('menu-open', open);
  if (trigger) {
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (menu) {
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
}

function closePinnedMenus(exceptPinnedId = null) {
  document.querySelectorAll('.pinned-card.menu-open').forEach((card) => {
    if (exceptPinnedId && card.dataset.pinnedId === exceptPinnedId) return;
    setPinnedMenuOpen(card, false);
  });
}

function togglePinnedMenu(pinnedId) {
  if (!pinnedId) return;
  const card = document.querySelector(`.pinned-card[data-pinned-id="${pinnedId}"]`);
  if (!card) return;
  const shouldOpen = !card.classList.contains('menu-open');
  closePinnedMenus(shouldOpen ? pinnedId : null);
  setPinnedMenuOpen(card, shouldOpen);
}

function getPinnedEditorElements() {
  return {
    backdrop: document.getElementById('pinnedEditorBackdrop'),
    form: document.getElementById('pinnedEditorForm'),
    nameInput: document.getElementById('pinnedEditorName'),
    urlInput: document.getElementById('pinnedEditorUrl'),
    error: document.getElementById('pinnedEditorError'),
  };
}

function isPinnedEditorOpen() {
  const { backdrop } = getPinnedEditorElements();
  return !!backdrop && backdrop.getAttribute('aria-hidden') === 'false';
}

function setPinnedEditorError(message) {
  const { error } = getPinnedEditorElements();
  if (!error) return;
  error.textContent = message || '';
}

function openPinnedEditor(entry, trigger) {
  const { backdrop, nameInput, urlInput } = getPinnedEditorElements();
  if (!backdrop || !nameInput || !urlInput || !entry) return;

  closePinnedMenus();

  pinnedEditorState = {
    entry: { ...entry },
    trigger: trigger || document.activeElement,
  };

  nameInput.value = entry.title || '';
  urlInput.value = entry.url || '';
  setPinnedEditorError('');
  backdrop.setAttribute('aria-hidden', 'false');

  window.setTimeout(() => {
    nameInput.focus({ preventScroll: true });
    nameInput.select();
  }, 0);
}

function closePinnedEditor(options = {}) {
  const { restoreFocus = true } = options;
  const { backdrop, form, error } = getPinnedEditorElements();
  const trigger = pinnedEditorState.trigger;

  if (backdrop) {
    backdrop.setAttribute('aria-hidden', 'true');
  }
  if (form) {
    form.reset();
  }
  if (error) {
    error.textContent = '';
  }

  pinnedEditorState = {
    entry: null,
    trigger: null,
  };

  if (restoreFocus && trigger && typeof trigger.focus === 'function') {
    trigger.focus({ preventScroll: true });
  }
}

async function submitPinnedEditor() {
  const pinnedRepo = globalThis.TabOutPinnedRepo;
  const currentEntry = pinnedEditorState.entry;
  const { nameInput, urlInput } = getPinnedEditorElements();
  if (!pinnedRepo || !currentEntry || !nameInput || !urlInput) return;

  const normalizedUrl = normalizePinnedEntryUrl(urlInput.value);
  if (!normalizedUrl) {
    setPinnedEditorError(t('pinned.editor.invalidUrl'));
    urlInput.focus({ preventScroll: true });
    return;
  }

  const nextTitle = nameInput.value.trim() || getSiteNameFromUrl(normalizedUrl) || normalizedUrl;
  const currentNormalizedUrl = normalizePinnedEntryUrl(currentEntry.url);
  const nextIcon = normalizedUrl === currentNormalizedUrl
    ? (currentEntry.icon || '')
    : derivePinnedEntryIconUrl(normalizedUrl);

  const updatedEntry = await pinnedRepo.updatePinnedEntry(currentEntry.id, {
    title: nextTitle,
    url: normalizedUrl,
    icon: nextIcon || null,
  });
  if (!updatedEntry) return;

  closePinnedEditor();
  await renderPinnedSurface();
  showToast(t('toast.pinUpdated'));
}

/**
 * checkAndShowEmptyState()
 *
 * Shows a cheerful "Inbox zero" message when all domain cards are gone.
 */
function checkAndShowEmptyState() {
  const missionsEl = document.getElementById('openTabsMissions');
  if (!missionsEl) return;

  const remaining = missionsEl.querySelectorAll('.mission-card:not(.closing)').length;
  if (remaining > 0) return;

  missionsEl.innerHTML = `
    <div class="missions-empty-state">
      <div class="empty-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div class="empty-title">Inbox zero, but for tabs.</div>
      <div class="empty-subtitle">${t('emptyState.subtitle')}</div>
    </div>
  `;

  const titleEl = missionsEl.querySelector('.empty-title');
  if (titleEl) titleEl.textContent = t('emptyState.title');
  const countEl = document.getElementById('openTabsSectionCount');
  if (countEl) countEl.textContent = t('counts.domains', { count: 0 });
}

/**
 * timeAgo(dateStr)
 *
 * Converts an ISO date string into a human-friendly relative time.
 * "2026-04-04T10:00:00Z" → "2 hrs ago" or "yesterday"
 */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now  = new Date();
  const diffMins  = Math.floor((now - then) / 60000);
  const diffHours = Math.floor((now - then) / 3600000);
  const diffDays  = Math.floor((now - then) / 86400000);

  if (diffMins < 1) return t('timeAgo.justNow');
  if (diffMins < 60) return t('timeAgo.minAgo', { count: diffMins });
  if (diffHours < 24) return t('timeAgo.hourAgo', { count: diffHours });
  if (diffDays === 1) return t('timeAgo.yesterday');
  return t('timeAgo.dayAgo', { count: diffDays });
}

/**
 * getGreeting() — "Good morning / afternoon / evening"
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return t('greeting.morning');
  if (hour < 17) return t('greeting.afternoon');
  return t('greeting.evening');
}

/**
 * getDateDisplay() — "Friday, April 4, 2026"
 */
function getDateDisplay() {
  return new Date().toLocaleDateString(getCurrentLocale(), {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}


/* ----------------------------------------------------------------
   DOMAIN & TITLE CLEANUP HELPERS
   ---------------------------------------------------------------- */

// Map of known hostnames → friendly display names.
const FRIENDLY_DOMAINS = {
  'github.com':           'GitHub',
  'www.github.com':       'GitHub',
  'gist.github.com':      'GitHub Gist',
  'youtube.com':          'YouTube',
  'www.youtube.com':      'YouTube',
  'music.youtube.com':    'YouTube Music',
  'x.com':                'X',
  'www.x.com':            'X',
  'twitter.com':          'X',
  'www.twitter.com':      'X',
  'reddit.com':           'Reddit',
  'www.reddit.com':       'Reddit',
  'old.reddit.com':       'Reddit',
  'substack.com':         'Substack',
  'www.substack.com':     'Substack',
  'medium.com':           'Medium',
  'www.medium.com':       'Medium',
  'linkedin.com':         'LinkedIn',
  'www.linkedin.com':     'LinkedIn',
  'stackoverflow.com':    'Stack Overflow',
  'www.stackoverflow.com':'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'google.com':           'Google',
  'www.google.com':       'Google',
  'mail.google.com':      'Gmail',
  'docs.google.com':      'Google Docs',
  'drive.google.com':     'Google Drive',
  'calendar.google.com':  'Google Calendar',
  'meet.google.com':      'Google Meet',
  'gemini.google.com':    'Gemini',
  'chatgpt.com':          'ChatGPT',
  'www.chatgpt.com':      'ChatGPT',
  'chat.openai.com':      'ChatGPT',
  'claude.ai':            'Claude',
  'www.claude.ai':        'Claude',
  'code.claude.com':      'Claude Code',
  'notion.so':            'Notion',
  'www.notion.so':        'Notion',
  'figma.com':            'Figma',
  'www.figma.com':        'Figma',
  'slack.com':            'Slack',
  'app.slack.com':        'Slack',
  'discord.com':          'Discord',
  'www.discord.com':      'Discord',
  'wikipedia.org':        'Wikipedia',
  'en.wikipedia.org':     'Wikipedia',
  'amazon.com':           'Amazon',
  'www.amazon.com':       'Amazon',
  'netflix.com':          'Netflix',
  'www.netflix.com':      'Netflix',
  'spotify.com':          'Spotify',
  'open.spotify.com':     'Spotify',
  'vercel.com':           'Vercel',
  'www.vercel.com':       'Vercel',
  'npmjs.com':            'npm',
  'www.npmjs.com':        'npm',
  'developer.mozilla.org':'MDN',
  'arxiv.org':            'arXiv',
  'www.arxiv.org':        'arXiv',
  'huggingface.co':       'Hugging Face',
  'www.huggingface.co':   'Hugging Face',
  'producthunt.com':      'Product Hunt',
  'www.producthunt.com':  'Product Hunt',
  'xiaohongshu.com':      'RedNote',
  'www.xiaohongshu.com':  'RedNote',
  'local-files':          'Local Files',
};

function friendlyDomain(hostname) {
  if (!hostname) return '';
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname];

  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return capitalize(hostname.replace('.substack.com', '')) + "'s Substack";
  }
  if (hostname.endsWith('.github.io')) {
    return capitalize(hostname.replace('.github.io', '')) + ' (GitHub Pages)';
  }

  let clean = hostname
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|co\.uk|co\.jp)$/, '');

  return clean.split('.').map(part => capitalize(part)).join(' ');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function stripTitleNoise(title) {
  if (!title) return '';
  // Strip leading notification count: "(2) Title"
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  // Strip inline counts like "Inbox (16,359)"
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  // Strip email addresses (privacy + cleaner display)
  title = title.replace(/\s*[\-\u2010-\u2015]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  // Clean X/Twitter format
  title = title.replace(/\s+on X:\s*/, ': ');
  title = title.replace(/\s*\/\s*X\s*$/, '');
  return title.trim();
}

function cleanTitle(title, hostname) {
  if (!title || !hostname) return title || '';

  const friendly = friendlyDomain(hostname);
  const domain   = hostname.replace(/^www\./, '');
  const seps     = [' - ', ' | ', ' — ', ' · ', ' – '];

  for (const sep of seps) {
    const idx = title.lastIndexOf(sep);
    if (idx === -1) continue;
    const suffix     = title.slice(idx + sep.length).trim();
    const suffixLow  = suffix.toLowerCase();
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return title;
}

function smartTitle(title, url) {
  if (!url) return title || '';
  let pathname = '', hostname = '';
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname; }
  catch { return title || ''; }

  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http');

  if ((hostname === 'x.com' || hostname === 'twitter.com' || hostname === 'www.x.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1];
    if (username) return titleIsUrl ? `Post by @${username}` : title;
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts;
      if (rest[0] === 'issues' && rest[1]) return `${owner}/${repo} Issue #${rest[1]}`;
      if (rest[0] === 'pull'   && rest[1]) return `${owner}/${repo} PR #${rest[1]}`;
      if (rest[0] === 'blob' || rest[0] === 'tree') return `${owner}/${repo} — ${rest.slice(2).join('/')}`;
      if (titleIsUrl) return `${owner}/${repo}`;
    }
  }

  if ((hostname === 'www.youtube.com' || hostname === 'youtube.com') && pathname === '/watch') {
    if (titleIsUrl) return 'YouTube Video';
  }

  if ((hostname === 'www.reddit.com' || hostname === 'reddit.com' || hostname === 'old.reddit.com') && pathname.includes('/comments/')) {
    const parts  = pathname.split('/').filter(Boolean);
    const subIdx = parts.indexOf('r');
    if (subIdx !== -1 && parts[subIdx + 1]) {
      if (titleIsUrl) return `r/${parts[subIdx + 1]} post`;
    }
  }

  return title || url;
}


/* ----------------------------------------------------------------
   SVG ICON STRINGS
   ---------------------------------------------------------------- */
const ICONS = {
  tabs:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18" /></svg>`,
  close:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`,
  focus:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>`,
};


/* ----------------------------------------------------------------
   IN-MEMORY STORE FOR OPEN-TAB GROUPS
   ---------------------------------------------------------------- */
let domainGroups = [];


/* ----------------------------------------------------------------
   HELPER: filter out browser-internal pages
   ---------------------------------------------------------------- */

/**
 * getRealTabs()
 *
 * Returns tabs that are real web pages — no chrome://, extension
 * pages, about:blank, etc.
 */
function getRealTabs() {
  return openTabs.filter(t => {
    const url = t.url || '';
    return (
      !url.startsWith('chrome://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('about:') &&
      !url.startsWith('edge://') &&
      !url.startsWith('brave://')
    );
  });
}

/**
 * checkTabOutDupes()
 *
 * Counts how many Tab Out pages are open. If more than 1,
 * shows a banner offering to close the extras.
 */
function checkTabOutDupes() {
  const tabOutTabs = openTabs.filter(t => t.isTabOut);
  const banner  = document.getElementById('tabOutDupeBanner');
  const countEl = document.getElementById('tabOutDupeCount');
  if (!banner) return;

  if (tabOutTabs.length > 1) {
    if (countEl) countEl.textContent = tabOutTabs.length;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}


/* ----------------------------------------------------------------
   OVERFLOW CHIPS ("+N more" expand button in domain cards)
   ---------------------------------------------------------------- */

function buildOverflowChips(hiddenTabs, urlCounts = {}) {
  const hiddenChips = hiddenTabs.map(tab => {
    const label    = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const count    = urlCounts[tab.url] || 1;
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = escapeAttribute(tab.url || '');
    const safeTitle = escapeAttribute(label);
    const faviconHtml = renderFaviconImage(getTabFaviconUrl(tab));
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconHtml}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-pin" data-action="pin-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" data-tab-id="${tab.id || ''}" title="${t('actions.pinToShortcuts')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.1" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.25 4.5 5.25 5.25m-9 8.25L5.25 21l2.25-5.25m3-9.75 5.25 5.25m-5.25-5.25-.97.97a2.25 2.25 0 0 0 0 3.182l2.318 2.318a2.25 2.25 0 0 0 3.182 0l.97-.97m-8.47-5.5 6.5-6.5a1.5 1.5 0 0 1 2.121 0l3.348 3.348a1.5 1.5 0 0 1 0 2.121l-6.5 6.5" /></svg>
        </button>
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" data-tab-id="${tab.id || ''}" title="${t('actions.saveForLater')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" data-tab-id="${tab.id || ''}" title="${t('actions.closeThisTab')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-chips-overflow" style="display:none">${hiddenChips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">${t('counts.moreTabs', { count: hiddenTabs.length })}</span>
    </div>`;
}

async function renderPinnedSurface() {
  const controller = getHomepageController();
  const pinnedRepo = globalThis.TabOutPinnedRepo;
  if (!controller || !pinnedRepo) return;
  const entries = await pinnedRepo.listPinnedEntries();
  controller.renderPinned(entries);
}

async function renderReadingInboxSurface(options = {}) {
  const includeFilters = options.includeFilters !== false;
  const includeDebug = options.includeDebug !== false;
  const controller = getHomepageController();
  const articlesRepo = globalThis.TabOutArticlesRepo;
  if (!controller || !articlesRepo) return;

  const [activeCount, aiStatus, jobs] = await Promise.all([
    articlesRepo.countActiveInboxItems(),
    globalThis.TabOutSettingsRepo ? globalThis.TabOutSettingsRepo.getAiStatus() : Promise.resolve(null),
    globalThis.TabOutJobsRepo ? globalThis.TabOutJobsRepo.listJobs() : Promise.resolve([]),
  ]);
  controller.setReadingInboxCount(activeCount);

  const articles = (await articlesRepo.listArticles())
    .filter(isReadingLibraryArticle)
    .sort(
      (left, right) =>
        new Date(right.last_saved_at || right.saved_at || 0).getTime() -
        new Date(left.last_saved_at || left.saved_at || 0).getTime()
    );
  await ensureReadingMetadataBackfill(articles);
  const filters = deriveReadingFilters(articles);
  const visibleArticles = applyReadingFilters(articles, readingFilterState);
  const groups = groupReadingResultsByPriority(visibleArticles);
  if (includeFilters) {
    controller.renderReadingFilters(renderReadingFiltersHtml(filters, readingFilterState));
  }
  controller.renderReadingResultsSummary(
    renderReadingResultsSummaryHtml(articles.length, visibleArticles.length, readingFilterState)
  );
  controller.renderReadingResultGroups(
    renderReadingResultGroupsHtml(groups, {
      aiStatus,
      jobsByArticleId: Object.fromEntries((jobs || []).map((job) => [job.article_id, job])),
    }),
    articles.length === 0
      ? t('reading.emptyActive')
      : readingFilterState.lifecycle === 'read' && visibleArticles.length === 0
        ? t('reading.emptyRead')
        : t('reading.emptyFiltered')
  );
  if (includeDebug) {
    await renderDebugSurface();
  }
}

async function renderInboxSurfaces() {
  await Promise.all([renderPinnedSurface(), renderReadingInboxSurface()]);
}

async function kickBackgroundJobs() {
  try {
    await chrome.runtime.sendMessage({ type: 'tabout:jobs:kick' });
  } catch (error) {
    console.warn('[tab-out] Failed to kick jobs runner:', error);
  }
}

async function refreshActionBadge() {
  try {
    await chrome.runtime.sendMessage({ type: 'tabout:badge:refresh' });
  } catch (error) {
    console.warn('[tab-out] Failed to refresh action badge:', error);
  }
}

function getAiSettingsDraft() {
  return {
    base_url: document.getElementById('settingsBaseUrl')?.value.trim() || '',
    api_key: document.getElementById('settingsApiKey')?.value.trim() || '',
    model_id: document.getElementById('settingsModelId')?.value.trim() || '',
    language_preference:
      document.getElementById('settingsLanguagePreference')?.value || 'auto',
  };
}

function setSettingsStatus(text) {
  const status = document.getElementById('settingsStatus');
  if (status) {
    status.textContent = text;
  }
}

function setLanguageStatus(text = '') {
  const status = document.getElementById('languageStatus');
  if (status) {
    status.textContent = text;
  }
}

function setBackupStatus(text) {
  const status = document.getElementById('backupStatus');
  if (status) {
    status.textContent = text;
  }
}

function triggerBackupDownload(snapshot) {
  const filename = globalThis.TabOutBackupService.buildBackupFilename(snapshot.exported_at);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(reader.error || new Error('Unable to read file.')));
    reader.readAsText(file);
  });
}

async function importBackupFile(file) {
  if (!file || !globalThis.TabOutBackupService) return;

  let parsed;
  try {
    const text = await readFileAsText(file);
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  const snapshot = globalThis.TabOutBackupService.validateSnapshot(parsed);
  const confirmed = window.confirm(
    `${t('settings.backup.confirm.title')}\n\n${t('settings.backup.confirm.body')}`
  );
  if (!confirmed) {
    return { canceled: true };
  }

  setBackupStatus(t('settings.backup.status.importing'));
  await globalThis.TabOutBackupService.restoreSnapshot(snapshot);
  await renderDashboard();
  await kickBackgroundJobs();
  setBackupStatus(t('settings.backup.status.restored'));
  showToast(t('toast.backupRestored'));
  return { canceled: false };
}

function getDebugStageLabel(item) {
  if (item.kind === 'preheat') {
    return t('debug.stagePrefetch');
  }
  if (item.processing_state === 'ready') {
    return t('processing.ready');
  }
  if (item.processing_state === 'waiting_for_ai') {
    return t('processing.waiting_for_ai');
  }
  if (item.processing_state === 'analyzing') {
    return t('processing.analyzing');
  }
  if (['analysis_failed', 'capture_failed'].includes(item.processing_state)) {
    return t(`processing.${item.processing_state}`);
  }
  return ['captured', 'capturing', 'queued'].includes(item.processing_state)
    ? t('processing.capturing')
    : t('processing.pending');
}

function buildDebugItems({ articles, jobs, aiStatus, preheatEntries: entries }) {
  const hostText = (aiStatus && aiStatus.host) || t('debug.noAiHost');
  const aiReady = isAiReadyStatus(aiStatus);
  const articleItems = (articles || []).map((article) => {
    const job = (jobs || []).find((item) => item.article_id === article.id) || null;
    const errorMessage =
      article.processing_state === 'waiting_for_ai'
        ? t('debug.waitingForAi')
        : article.last_error_message || job?.last_error_message || t('debug.noRecentError');
    const errorCode = article.last_error_code || job?.last_error_code || null;
    const meta = [
      getDebugStageLabel(article),
      article.lifecycle_state === 'read' ? t('lifecycle.read') : t('lifecycle.active'),
      hostText,
      getCaptureSourceLabel(article.capture_source),
      job && job.attempt_count ? t('debug.attemptCount', { count: job.attempt_count }) : '',
      job && job.next_retry_at ? t('debug.nextRetryIn', { time: timeAgo(job.next_retry_at) }) : '',
      t('debug.textSize', { count: String(article.analysis_source_text || article.markdown_content || '').length }),
    ].filter(Boolean);
    return {
      kind: 'article',
      key: article.id,
      title: article.title || article.url,
      stage: article.processing_state === 'ready'
        ? 'ready'
        : article.processing_state === 'waiting_for_ai'
          ? 'waiting'
        : ['analysis_failed', 'capture_failed'].includes(article.processing_state)
          ? 'failed'
          : article.processing_state === 'analyzing'
            ? 'analyze'
            : 'capture',
      source: article.capture_source || null,
      textSize: String(article.analysis_source_text || article.markdown_content || '').length,
      errorCode,
      errorMessage,
      updatedAt: article.updated_at || article.last_saved_at || article.saved_at || null,
      meta,
      retryable:
        ['capture_failed', 'analysis_failed'].includes(article.processing_state) ||
        (article.processing_state === 'waiting_for_ai' && aiReady),
      articleId: article.id,
    };
  });
  const preheatItems = (entries || [])
    .filter((entry) => entry && entry.status !== 'stale')
    .map((entry) => {
      const payload = entry.payload || null;
      const textSize = String(payload && payload.analysis_source_text ? payload.analysis_source_text : '').length;
      return {
        kind: 'preheat',
        key: entry.key,
        title: payload?.title || entry.url,
        stage: 'prefetch',
        source: 'prefetch',
        textSize,
        errorCode: entry.errorCode || null,
        errorMessage: entry.errorMessage || t('debug.noRecentError'),
        updatedAt: entry.capturedAt || null,
        meta: [
          getDebugStageLabel({ kind: 'preheat' }),
          hostText,
          t('debug.textSize', { count: textSize }),
        ],
        retryable: false,
        articleId: null,
      };
    });

  return articleItems
    .concat(preheatItems)
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime())
    .slice(0, 6);
}

async function renderDebugSurface() {
  const list = document.getElementById('debugList');
  if (!list || !globalThis.TabOutArticlesRepo || !globalThis.TabOutJobsRepo || !globalThis.TabOutSettingsRepo) return;

  const [articles, jobs, aiStatus] = await Promise.all([
    globalThis.TabOutArticlesRepo.listArticles(),
    globalThis.TabOutJobsRepo.listJobs(),
    globalThis.TabOutSettingsRepo.getAiStatus(),
  ]);

  const rows = buildDebugItems({
    articles,
    jobs,
    aiStatus,
    preheatEntries: getPreheatEntriesSnapshot(),
  })
    .map((item) => {
      const retryAction = item.retryable
        ? `<button class="reading-item-action" type="button" data-action="retry-article" data-article-id="${item.articleId}">${t('actions.retry')}</button>`
        : '';
      return `
        <div class="debug-item">
          <h4>${item.title}</h4>
          <p>${item.meta.join(' · ')}</p>
          <p>${item.errorCode ? `${t('debug.errorCode', { code: item.errorCode })} · ` : ''}${item.errorMessage}</p>
          ${retryAction ? `<div class="debug-item-actions">${retryAction}</div>` : ''}
        </div>
      `;
    })
    .join('');

  list.innerHTML =
    rows ||
    `
      <div class="debug-item">
        <h4>${t('debug.emptyTitle')}</h4>
        <p>${t('debug.emptyBody')}</p>
      </div>
    `;
}

async function loadSettingsSurface({ preserveLanguageStatus = false } = {}) {
  if (!globalThis.TabOutSettingsRepo) return;
  const [settings, status] = await Promise.all([
    globalThis.TabOutSettingsRepo.getAiSettings(),
    globalThis.TabOutSettingsRepo.getAiStatus(),
  ]);

  const baseUrlInput = document.getElementById('settingsBaseUrl');
  const apiKeyInput = document.getElementById('settingsApiKey');
  const modelIdInput = document.getElementById('settingsModelId');
  const languagePreferenceInput = document.getElementById('settingsLanguagePreference');
  if (baseUrlInput) baseUrlInput.value = settings.base_url || '';
  if (apiKeyInput) apiKeyInput.value = settings.api_key || '';
  if (modelIdInput) modelIdInput.value = settings.model_id || '';
  if (languagePreferenceInput) {
    languagePreferenceInput.value = settings.language_preference || 'auto';
  }
  if (!preserveLanguageStatus) {
    setLanguageStatus('');
  }

  if (status.state === 'ready') {
    setSettingsStatus(t('settings.status.ready', { host: status.host }));
  } else if (status.state === 'saved') {
    setSettingsStatus(t('settings.status.saved', { host: status.host }));
  } else if (status.state === 'failed') {
    setSettingsStatus(t('settings.status.failed', { error: status.last_error }));
  } else {
    setSettingsStatus(t('settings.status.notConfigured'));
  }

  await renderDebugSurface();
}


/* ----------------------------------------------------------------
   DOMAIN CARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderDomainCard(group, groupIndex)
 *
 * Builds the HTML for one domain group card.
 * group = { domain: string, tabs: [{ url, title, id, windowId, active }] }
 */
function renderDomainCard(group) {
  const tabs      = group.tabs || [];
  const tabCount  = tabs.length;
  const isLanding = group.domain === '__landing-pages__';
  const stableId  = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-');

  // Count duplicates (exact URL match)
  const urlCounts = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls   = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const hasDupes   = dupeUrls.length > 0;
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  const tabBadge = `<span class="open-tabs-badge">
    ${ICONS.tabs}
    ${t('counts.tabsOpen', { count: tabCount })}
  </span>`;

  const dupeBadge = hasDupes
    ? `<span class="open-tabs-badge" style="color:var(--accent-amber);background:rgba(200,113,58,0.08);">
        ${t('counts.duplicates', { count: totalExtras })}
      </span>`
    : '';

  // Deduplicate for display: show each URL once, with (Nx) badge if duped
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); }
  }

  const visibleTabs = uniqueTabs.slice(0, 8);
  const extraCount  = uniqueTabs.length - visibleTabs.length;

  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
    // For localhost tabs, prepend port number so you can tell projects apart
    try {
      const parsed = new URL(tab.url);
      if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
    } catch {}
    const count    = urlCounts[tab.url];
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const saveClass = isLikelyReadingTab(tab) ? ' chip-save-emphasis' : '';
    const saveDisabled = isUnsupportedSaveUrl(tab.url);
    const safeUrl   = escapeAttribute(tab.url || '');
    const safeTitle = escapeAttribute(label);
    const faviconHtml = renderFaviconImage(getTabFaviconUrl(tab));
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconHtml}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-pin" data-action="pin-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" data-tab-id="${tab.id || ''}" title="${t('actions.pinToShortcuts')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.1" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.25 4.5 5.25 5.25m-9 8.25L5.25 21l2.25-5.25m3-9.75 5.25 5.25m-5.25-5.25-.97.97a2.25 2.25 0 0 0 0 3.182l2.318 2.318a2.25 2.25 0 0 0 3.182 0l.97-.97m-8.47-5.5 6.5-6.5a1.5 1.5 0 0 1 2.121 0l3.348 3.348a1.5 1.5 0 0 1 0 2.121l-6.5 6.5" /></svg>
        </button>
        <button class="chip-action chip-save${saveClass}" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" data-tab-id="${tab.id || ''}" title="${saveDisabled ? t('labels.captureUnavailable') : t('actions.saveForLater')}" ${saveDisabled ? 'disabled aria-disabled="true"' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" data-tab-id="${tab.id || ''}" title="${t('actions.closeThisTab')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('') + (extraCount > 0 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts) : '');

  let actionsHtml = `
    <button class="action-btn close-tabs" data-action="close-domain-tabs" data-domain-id="${stableId}">
      ${ICONS.close}
      ${t('actions.closeAllTabs', { count: tabCount })}
    </button>`;

  if (hasDupes) {
    const dupeUrlsEncoded = dupeUrls.map(([url]) => encodeURIComponent(url)).join(',');
    actionsHtml += `
      <button class="action-btn" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}">
        ${t('actions.closeDuplicates', { count: totalExtras })}
      </button>`;
  }

  return `
    <div class="mission-card domain-card ${hasDupes ? 'has-amber-bar' : 'has-neutral-bar'}" data-domain-id="${stableId}">
      <div class="status-bar"></div>
      <div class="mission-content">
        <div class="mission-top">
          <span class="mission-name">${isLanding ? t('labels.homepages') : (group.label || friendlyDomain(group.domain))}</span>
          ${tabBadge}
          ${dupeBadge}
        </div>
        <div class="mission-pages">${pageChips}</div>
        <div class="actions">${actionsHtml}</div>
      </div>
      <div class="mission-meta">
        <div class="mission-page-count">${tabCount}</div>
        <div class="mission-page-label">${t('labels.tabs')}</div>
      </div>
    </div>`;
}


/* ----------------------------------------------------------------
   MAIN DASHBOARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderStaticDashboard()
 *
 * The main render function:
 * 1. Paints greeting + date
 * 2. Fetches open tabs via chrome.tabs.query()
 * 3. Groups tabs by domain (with landing pages pulled out to their own group)
 * 4. Renders domain cards
 * 5. Updates footer stats
 * 6. Renders the pinned shortcuts, reading inbox, and settings shell
 */
async function renderStaticDashboard() {
  const homepageController = getHomepageController();
  if (homepageController) {
    homepageController.init();
  }

  // --- Header ---
  const greetingEl = document.getElementById('greeting');
  const dateEl     = document.getElementById('dateDisplay');
  if (greetingEl) greetingEl.textContent = getGreeting();
  if (dateEl)     dateEl.textContent     = getDateDisplay();

  // --- Fetch tabs ---
  await fetchOpenTabs();
  const realTabs = getRealTabs();
  const currentTabs = await syncVisibleNowTabs(realTabs);
  renderOpenTabsSection(currentTabs);

  // --- Check for duplicate Tab Out tabs ---
  checkTabOutDupes();

  // --- Render pinned + reading inbox surfaces ---
  await Promise.all([renderInboxSurfaces(), loadSettingsSurface()]);
  scheduleLightweightPreheat(currentTabs);
}

async function renderDashboard() {
  await initializeLanguagePreference();
  await cleanupLegacyDeferredState();
  await renderStaticDashboard();
}

let localConfigLoadPromise = null;

async function hasPackagedFile(path) {
  if (
    typeof chrome === 'undefined' ||
    !chrome.runtime ||
    typeof chrome.runtime.getPackageDirectoryEntry !== 'function'
  ) {
    return false;
  }

  return new Promise((resolve) => {
    chrome.runtime.getPackageDirectoryEntry((root) => {
      if (!root) {
        resolve(false);
        return;
      }

      root.getFile(
        path,
        { create: false },
        () => resolve(true),
        () => resolve(false)
      );
    });
  });
}

async function loadOptionalLocalConfig() {
  if (localConfigLoadPromise) {
    return localConfigLoadPromise;
  }

  localConfigLoadPromise = (async () => {
    const configUrl =
      typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL('config.local.js')
        : 'config.local.js';

    const exists = await hasPackagedFile('config.local.js');
    if (!exists) {
      return;
    }

    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = configUrl;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', resolve, { once: true });
      document.head.appendChild(script);
    });
  })();

  return localConfigLoadPromise;
}

window.addEventListener('tabout:reading-view-changed', async () => {
  try {
    await renderReadingInboxSurface();
  } catch (error) {
    console.warn('[tab-out] Failed to rerender reading inbox after view change:', error);
  }
});

window.addEventListener('tabout:selected-article-changed', async () => {
  try {
    await renderReadingInboxSurface();
  } catch (error) {
    console.warn('[tab-out] Failed to rerender reading inbox after article selection:', error);
  }
});

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'tabout:data-changed') return;
    renderInboxSurfaces()
      .then(() => renderDebugSurface())
      .catch((error) => {
        console.warn('[tab-out] Failed to refresh after background update:', error);
      });
  });
}


/* ----------------------------------------------------------------
   EVENT HANDLERS — using event delegation

   One listener on document handles ALL button clicks.
   Think of it as one security guard watching the whole building
   instead of one per door.
   ---------------------------------------------------------------- */

document.addEventListener(
  'click',
  (event) => {
    if (Date.now() >= pinnedDragState.blockClicksUntil) return;
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('#pinnedList .pinned-card')) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true
);

document.addEventListener('pointerdown', (event) => {
  if (!(event.target instanceof Element)) {
    clearPinnedDragArm();
    return;
  }

  const handle = event.target.closest('[data-drag-handle="true"]');
  if (!handle) {
    clearPinnedDragArm();
    return;
  }

  armPinnedDrag(handle.dataset.pinnedId);
});

document.addEventListener('pointerup', () => {
  clearPinnedDragArm();
});

document.addEventListener('dragstart', (event) => {
  const card = resolvePinnedDragCard(event.target);
  if (!card) return;

  if (pinnedDragState.armedId !== card.dataset.pinnedId) {
    event.preventDefault();
    return;
  }

  const list = getPinnedListElement();
  if (!list) {
    event.preventDefault();
    return;
  }

  pinnedDragState.draggedId = card.dataset.pinnedId || null;
  pinnedDragState.originalOrder = getPinnedOrderFromDom(list);
  list.classList.add('pinned-list-dragging');
  card.classList.add('dragging');
  clearPinnedDropTargets(list);

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pinnedDragState.draggedId || '');
  }
});

document.addEventListener('dragover', (event) => {
  if (!pinnedDragState.draggedId) return;

  const list = getPinnedListElement();
  const draggedCard = resolvePinnedDragCard(document.querySelector('#pinnedList .pinned-card.dragging'));
  if (!list || !draggedCard) return;

  const targetCard = resolvePinnedDragCard(event.target);
  if (targetCard && targetCard !== draggedCard) {
    event.preventDefault();
    clearPinnedDropTargets(list);
    targetCard.classList.add('drop-target');
    const insertBefore = shouldInsertPinnedCardBefore(targetCard, event);
    list.insertBefore(draggedCard, insertBefore ? targetCard : targetCard.nextSibling);
    return;
  }

  if (event.target === list || (event.target instanceof Element && list.contains(event.target))) {
    event.preventDefault();
    clearPinnedDropTargets(list);
    if (!(event.target instanceof Element) || event.target === list) {
      list.appendChild(draggedCard);
    }
  }
});

document.addEventListener('drop', async (event) => {
  if (!pinnedDragState.draggedId) return;

  const list = getPinnedListElement();
  if (!list) {
    finishPinnedDrag({ suppressClicks: true });
    return;
  }

  if (
    event.target !== list &&
    (!(event.target instanceof Element) || !list.contains(event.target))
  ) {
    finishPinnedDrag({ suppressClicks: true });
    return;
  }

  event.preventDefault();

  try {
    await persistPinnedOrder(list);
  } finally {
    finishPinnedDrag({ suppressClicks: true });
  }
});

document.addEventListener('dragend', (event) => {
  const card = resolvePinnedDragCard(event.target);
  if (!card || card.dataset.pinnedId !== pinnedDragState.draggedId) return;
  finishPinnedDrag({ suppressClicks: true });
});

document.addEventListener('click', async (e) => {
  const pinnedEditorBackdrop = document.getElementById('pinnedEditorBackdrop');
  if (pinnedEditorBackdrop && e.target === pinnedEditorBackdrop) {
    closePinnedEditor();
    return;
  }

  const pinnedMenuTrigger = e.target.closest('.pinned-menu-trigger');
  const pinnedMenu = e.target.closest('.pinned-card-menu');
  if (!pinnedMenuTrigger && !pinnedMenu) {
    closePinnedMenus();
  }

  // Walk up the DOM to find the nearest element with data-action
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // ---- Close duplicate Tab Out tabs ----
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    playCloseSound();
    const banner = document.getElementById('tabOutDupeBanner');
    if (banner) {
      banner.style.transition = 'opacity 0.4s';
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1'; }, 400);
    }
    showToast(t('toast.closedExtraTabOutTabs'));
    return;
  }

  if (action === 'close-pinned-editor') {
    closePinnedEditor();
    return;
  }

  if (action === 'toggle-pinned-menu') {
    e.stopPropagation();
    togglePinnedMenu(actionEl.dataset.pinnedId);
    return;
  }

  const card = actionEl.closest('.mission-card');

  // ---- Expand overflow chips ("+N more") ----
  if (action === 'expand-chips') {
    const overflowContainer = actionEl.parentElement.querySelector('.page-chips-overflow');
    if (overflowContainer) {
      overflowContainer.style.display = 'contents';
      actionEl.remove();
    }
    return;
  }

  // ---- Focus a specific tab ----
  if (action === 'focus-tab') {
    const tabUrl = actionEl.dataset.tabUrl;
    if (tabUrl) await focusTab(tabUrl);
    return;
  }

  if (action === 'select-reading-article') {
    return;
  }

  if (action === 'open-article-source') {
    e.stopPropagation();
    const articleUrl = actionEl.dataset.articleUrl;
    const articleId =
      actionEl.dataset.articleId ||
      (actionEl.closest('.reading-result-card') && actionEl.closest('.reading-result-card').dataset.articleId);
    if (articleUrl) {
      if (articleId && globalThis.TabOutArticlesRepo && typeof globalThis.TabOutArticlesRepo.updateArticle === 'function') {
        await globalThis.TabOutArticlesRepo.updateArticle(articleId, {
          last_opened_at: new Date().toISOString(),
        });
        await renderReadingInboxSurface({ includeDebug: false });
      }
      await chrome.tabs.create({ url: articleUrl, active: true });
    }
    return;
  }

  if (action === 'pin-single-tab') {
    e.stopPropagation();
    const tabUrl = actionEl.dataset.tabUrl;
    const tabTitle = actionEl.dataset.tabTitle || tabUrl;
    const tabId = actionEl.dataset.tabId ? Number(actionEl.dataset.tabId) : undefined;
    const chip = actionEl.closest('.page-chip');
    if (!tabUrl || !globalThis.TabOutPinnedRepo) return;

    const entries = await globalThis.TabOutPinnedRepo.listPinnedEntries();
    const existing = entries.find((entry) => entry.url === tabUrl);
    if (existing) {
      await reconcileVisibleNowRemoval(tabUrl, {
        chipEl: chip,
        tabId,
        closePhysicalTab: true,
        animate: true,
        playEffects: true,
        playSound: true,
      });
      showToast(t('toast.alreadyPinned'));
      return;
    }

    const matchedTab = openTabs.find((tab) => tab.url === tabUrl);

    await globalThis.TabOutPinnedRepo.createPinnedEntry({
      title: tabTitle,
      url: tabUrl,
      icon: getTabFaviconUrl(matchedTab) || null,
    });
    await renderPinnedSurface();
    await reconcileVisibleNowRemoval(tabUrl, {
      chipEl: chip,
      tabId: tabId || (matchedTab && matchedTab.id),
      closePhysicalTab: true,
      animate: true,
      playEffects: true,
      playSound: true,
    });
    showToast(t('toast.pinnedToNow'));
    return;
  }

  if (action === 'save-ai-settings') {
    if (!globalThis.TabOutSettingsRepo) return;
    const draft = getAiSettingsDraft();
    await globalThis.TabOutSettingsRepo.saveAiSettings(draft);
    await globalThis.TabOutSettingsRepo.saveAiStatus({
      state: draft.base_url && draft.api_key && draft.model_id ? 'saved' : 'not_configured',
      host: getSiteNameFromUrl(draft.base_url),
      last_error: null,
    });
    await loadSettingsSurface({ preserveLanguageStatus: true });
    showToast(t('toast.settingsSaved'));
    return;
  }

  if (action === 'test-ai-settings') {
    try {
      setSettingsStatus(t('settings.status.testing'));
      const result = await chrome.runtime.sendMessage({ type: 'tabout:ai:test-connection' });
      if (!result || !result.ok) {
        throw new Error(result && result.error ? result.error : 'Connection test failed');
      }
      await loadSettingsSurface({ preserveLanguageStatus: true });
      await renderReadingInboxSurface({ includeDebug: false });
      showToast(t('toast.aiConnectionReady'));
    } catch (error) {
      setSettingsStatus(t('settings.status.failed', { error: error.message }));
      showToast(t('toast.aiConnectionFailed'));
    }
    return;
  }

  if (action === 'export-local-backup') {
    if (!globalThis.TabOutBackupService) return;
    try {
      setBackupStatus(t('settings.backup.status.exporting'));
      const snapshot = await globalThis.TabOutBackupService.exportSnapshot();
      triggerBackupDownload(snapshot);
      setBackupStatus(t('settings.backup.status.exported'));
      showToast(t('toast.backupExported'));
    } catch (error) {
      setBackupStatus(t('settings.backup.status.failed', { error: error.message }));
      showToast(t('toast.backupFailed'));
    }
    return;
  }

  if (action === 'import-local-backup') {
    const input = document.getElementById('backupImportFile');
    if (input) {
      input.value = '';
      input.click();
    }
    return;
  }

  // ---- Close a single tab ----
  if (action === 'close-single-tab') {
    e.stopPropagation(); // don't trigger parent chip's focus-tab
    const tabUrl = actionEl.dataset.tabUrl;
    const tabId = actionEl.dataset.tabId ? Number(actionEl.dataset.tabId) : undefined;
    const chip = actionEl.closest('.page-chip');
    if (!tabUrl) return;

    await reconcileVisibleNowRemoval(tabUrl, {
      chipEl: chip,
      tabId,
      closePhysicalTab: true,
      animate: true,
      playEffects: true,
      playSound: true,
    });

    showToast(t('toast.tabClosed'));
    return;
  }

  // ---- Save a single tab for later ----
  if (action === 'defer-single-tab') {
    e.stopPropagation();
    const tabUrl   = actionEl.dataset.tabUrl;
    const tabTitle = actionEl.dataset.tabTitle || tabUrl;
    const tabId    = actionEl.dataset.tabId ? Number(actionEl.dataset.tabId) : undefined;
    const chip = actionEl.closest('.page-chip');
    if (!tabUrl) return;

    try {
      const result = await saveTabForLater({ id: tabId, url: tabUrl, title: tabTitle });
      await reconcileVisibleNowRemoval(tabUrl, {
        chipEl: chip,
        tabId,
        closePhysicalTab: Boolean(result.shouldCloseNow),
        animate: true,
        playEffects: true,
        playSound: true,
      });
      await Promise.all([kickBackgroundJobs(), renderReadingInboxSurface(), refreshActionBadge()]);
      if (result.deduped) {
        showToast(result.requeued ? t('toast.alreadySavedRequeued') : t('toast.alreadySaved'));
      } else {
        showToast(t('toast.savedToReadingInbox'));
      }
    } catch (err) {
      console.error('[tab-out] Failed to save tab:', err);
      showToast(t('toast.failedToSaveTab'));
    }
    return;
  }

  if (action === 'mark-article-read') {
    const articleId = actionEl.dataset.articleId;
    if (!articleId || !globalThis.TabOutArticlesRepo) return;
    await globalThis.TabOutArticlesRepo.markArticleRead(articleId);
    await renderReadingInboxSurface();
    showToast(t('toast.markedRead'));
    return;
  }

  if (action === 'delete-article') {
    const articleId = actionEl.dataset.articleId;
    const row = actionEl.closest('.reading-result-card');
    if (!articleId || !row) return;
    row.classList.add('confirming-delete');
    return;
  }

  if (action === 'cancel-delete-article') {
    const row = actionEl.closest('.reading-result-card');
    if (row) {
      row.classList.remove('confirming-delete');
    }
    return;
  }

  if (action === 'confirm-delete-article') {
    const articleId = actionEl.dataset.articleId;
    if (!articleId || !globalThis.TabOutArticlesRepo) return;

    const article = await globalThis.TabOutArticlesRepo.getArticleById(articleId);
    if (!article) return;

    const relatedJob = globalThis.TabOutJobsRepo
      ? await globalThis.TabOutJobsRepo.getJobByArticleId(articleId)
      : null;
    if (relatedJob && globalThis.TabOutJobsRepo) {
      await globalThis.TabOutJobsRepo.deleteJob(relatedJob.id);
    }

    await globalThis.TabOutArticlesRepo.deleteArticlePermanently(articleId);

    await Promise.all([renderReadingInboxSurface(), refreshActionBadge()]);
    showToast(t('toast.deleted'));
    return;
  }

  if (action === 'retry-article') {
    const articleId = actionEl.dataset.articleId;
    if (!articleId || !globalThis.TabOutArticlesRepo || !globalThis.TabOutJobsRepo) return;
    const article = await globalThis.TabOutArticlesRepo.getArticleById(articleId);
    if (!article) return;
    const checkpointState = getRetryCheckpointState(article.processing_state);
    await globalThis.TabOutArticlesRepo.updateArticle(articleId, {
      processing_state: checkpointState,
      capture_source: 'retry',
      last_error_code: null,
      last_error_message: null,
    });
    await globalThis.TabOutJobsRepo.enqueueJob({
      article_id: articleId,
      processing_state: checkpointState,
    });
    await renderReadingInboxSurface();
    kickBackgroundJobs().catch((error) => {
      console.warn('[tab-out] Failed to kick jobs runner after retry:', error);
    });
    showToast(t('toast.queuedForRetry'));
    return;
  }

  if (action === 'toggle-reading-filter') {
    const kind = actionEl.dataset.filterKind;
    const value = actionEl.dataset.filterValue;
    if (!kind || !value) return;
    if (kind === 'label') {
      const stateKey = normalizeReadingFilterKind(kind);
      const current = new Set(readingFilterState[stateKey] || []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      readingFilterState = { ...readingFilterState, [stateKey]: Array.from(current) };
    } else {
      readingFilterState = {
        ...readingFilterState,
        [kind]: readingFilterState[kind] === value ? '' : value,
      };
    }
    await renderReadingInboxSurface();
    return;
  }

  if (action === 'clear-reading-filters') {
    readingFilterState = {
      lifecycle: 'active',
      search: '',
      labels: [],
      source: '',
      time: '',
      status: '',
    };
    await renderReadingInboxSurface();
    return;
  }

  if (action === 'edit-pinned-entry') {
    closePinnedMenus();
    const pinnedId = actionEl.dataset.pinnedId;
    if (!pinnedId || !globalThis.TabOutPinnedRepo) return;
    const entries = await globalThis.TabOutPinnedRepo.listPinnedEntries();
    const entry = entries.find((item) => item.id === pinnedId);
    if (!entry) return;
    openPinnedEditor(
      {
        ...entry,
        title: entry.title || getPinnedEntryDisplayTitle(entry),
      },
      actionEl
    );
    return;
  }

  if (action === 'remove-pinned-entry') {
    closePinnedMenus();
    const pinnedId = actionEl.dataset.pinnedId;
    if (!pinnedId || !globalThis.TabOutPinnedRepo) return;
    await globalThis.TabOutPinnedRepo.removePinnedEntry(pinnedId);
    await renderPinnedSurface();
    showToast(t('toast.pinRemoved'));
    return;
  }

  // ---- Close all tabs in a domain group ----
  if (action === 'close-domain-tabs') {
    const domainId = actionEl.dataset.domainId;
    const group    = domainGroups.find(g => {
      return 'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId;
    });
    if (!group) return;

    const urls      = group.tabs.map(t => t.url);
    // Landing pages and custom groups (whose domain key isn't a real hostname)
    // must use exact URL matching to avoid closing unrelated tabs
    const useExact  = group.domain === '__landing-pages__' || !!group.label;

    if (useExact) {
      await closeTabsExact(urls);
    } else {
      await closeTabsByUrls(urls);
    }

    if (card) {
      playCloseSound();
      animateCardOut(card);
    }

    // Remove from in-memory groups
    const idx = domainGroups.indexOf(group);
    if (idx !== -1) domainGroups.splice(idx, 1);

    const groupLabel = group.domain === '__landing-pages__' ? t('labels.homepages') : (group.label || friendlyDomain(group.domain));
    showToast(t('toast.closedTabsFromGroup', { count: urls.length, group: groupLabel }));

    await syncVisibleNowTabs();
    return;
  }

  // ---- Close duplicates, keep one copy ----
  if (action === 'dedup-keep-one') {
    const urlsEncoded = actionEl.dataset.dupeUrls || '';
    const urls = urlsEncoded.split(',').map(u => decodeURIComponent(u)).filter(Boolean);
    if (urls.length === 0) return;

    await closeDuplicateTabs(urls, true);
    playCloseSound();

    // Hide the dedup button
    actionEl.style.transition = 'opacity 0.2s';
    actionEl.style.opacity    = '0';
    setTimeout(() => actionEl.remove(), 200);

    // Remove dupe badges from the card
    if (card) {
      card.querySelectorAll('.chip-dupe-badge').forEach(b => {
        b.style.transition = 'opacity 0.2s';
        b.style.opacity    = '0';
        setTimeout(() => b.remove(), 200);
      });
      card.querySelectorAll('.open-tabs-badge').forEach(badge => {
        if (badge.textContent.includes('duplicate')) {
          badge.style.transition = 'opacity 0.2s';
          badge.style.opacity    = '0';
          setTimeout(() => badge.remove(), 200);
        }
      });
      card.classList.remove('has-amber-bar');
      card.classList.add('has-neutral-bar');
    }

    showToast(t('toast.closedDuplicates'));
    return;
  }

  // ---- Close ALL open tabs ----
  if (action === 'close-all-open-tabs') {
    const allUrls = visibleNowTabs.map((tab) => tab.url).filter(Boolean);
    if (allUrls.length === 0) return;
    await closeTabsByUrls(allUrls);
    await syncVisibleNowTabs();
    playCloseSound();

    document.querySelectorAll('#openTabsMissions .mission-card').forEach(c => {
      shootConfetti(
        c.getBoundingClientRect().left + c.offsetWidth / 2,
        c.getBoundingClientRect().top  + c.offsetHeight / 2
      );
      animateCardOut(c);
    });

    showToast(t('toast.allTabsClosed'));
    return;
  }
});

document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'pinnedEditorForm') return;
  event.preventDefault();
  await submitPinnedEditor();
});

document.addEventListener('change', async (event) => {
  if (event.target.id === 'settingsLanguagePreference') {
    if (!globalThis.TabOutSettingsRepo) return;
    const nextPreference = event.target.value || 'auto';
    const currentSettings = await globalThis.TabOutSettingsRepo.getAiSettings();
    const currentPreference = currentSettings.language_preference || 'auto';
    if (currentPreference === nextPreference) return;

    await globalThis.TabOutSettingsRepo.saveAiSettings({
      ...currentSettings,
      language_preference: nextPreference,
    });
    setLanguageStatus(t('settings.language.status.refreshRequired'));
    showToast(t('toast.languageSavedRefreshRequired'));
    return;
  }

  if (event.target.id !== 'backupImportFile') return;
  const input = event.target;
  const [file] = Array.from(input.files || []);
  if (!file) {
    input.value = '';
    return;
  }

  try {
    await importBackupFile(file);
  } catch (error) {
    setBackupStatus(t('settings.backup.status.failed', { error: error.message }));
    showToast(t('toast.backupFailed'));
  } finally {
    input.value = '';
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (isPinnedEditorOpen()) {
    closePinnedEditor();
    return;
  }
  closePinnedMenus();
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'pinnedEditorName' && event.target.id !== 'pinnedEditorUrl') return;
  setPinnedEditorError('');
});

document.addEventListener('input', async (event) => {
  if (event.target.id !== 'readingFilterSearch') return;
  readingFilterState = {
    ...readingFilterState,
    search: event.target.value || '',
  };
  await renderReadingInboxSurface({
    includeFilters: false,
    includeDebug: false,
  });
});


/* ----------------------------------------------------------------
   INITIALIZE
   ---------------------------------------------------------------- */
globalThis.TabOutReadingInbox = {
  deriveReadingFilters,
  applyReadingFilters,
  groupReadingResultsByPriority,
  needsReadingMetadataBackfill,
  renderReadingFiltersHtml,
  renderReadingResultCard,
  renderReadingResultGroupsHtml,
  renderReadingResultsSummaryHtml,
  pickPreheatCandidates,
  saveTabForLater,
  buildDebugItems,
  clearPreheatEntries,
  seedPreheatEntry,
  getPreheatEntriesSnapshot,
};

if (!globalThis.__TAB_OUT_SKIP_BOOT__) {
  loadOptionalLocalConfig()
    .catch((error) => {
      console.warn('[tab-out] Optional local config failed to load:', error);
    })
    .finally(() => {
      renderDashboard().catch((error) => {
        console.error('[tab-out] Failed to initialize dashboard:', error);
      });
    });
}
