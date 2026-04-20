(function () {
  const namespace = (globalThis.TabOutCapture = globalThis.TabOutCapture || {});

  function isUnsupportedCaptureUrl(url) {
    return (
      !url ||
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('https://chromewebstore.google.com') ||
      url.startsWith('https://chrome.google.com/webstore') ||
      url.startsWith('file://')
    );
  }

  function createCaptureError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
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

  function getSiteNameFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  async function waitForTabComplete(tabId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let timeoutId = null;
      const cleanup = () => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        if (chrome.tabs.onRemoved && chrome.tabs.onRemoved.removeListener) {
          chrome.tabs.onRemoved.removeListener(onRemoved);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      const onUpdated = (updatedTabId, changeInfo) => {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status !== 'complete') return;
        cleanup();
        resolve();
      };

      const onRemoved = (removedTabId) => {
        if (removedTabId !== tabId) return;
        cleanup();
        reject(createCaptureError('Source tab was closed before capture could finish', 'source_tab_closed_before_payload'));
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
      if (chrome.tabs.onRemoved && chrome.tabs.onRemoved.addListener) {
        chrome.tabs.onRemoved.addListener(onRemoved);
      }
      timeoutId = setTimeout(() => {
        cleanup();
        reject(createCaptureError('Source tab did not finish loading before capture timed out', 'source_tab_loading'));
      }, timeoutMs);
    });
  }

  async function captureTab(input, options = {}) {
    if (!input || !input.id) {
      throw createCaptureError('Source tab is no longer available', 'source_tab_closed_before_payload');
    }
    if (isUnsupportedCaptureUrl(input.url)) {
      throw createCaptureError('Capture unavailable on this page', 'unsupported_url');
    }

    let tab = input.tabSnapshot || null;
    if (!tab) {
      try {
        tab = await chrome.tabs.get(input.id);
      } catch {
        throw createCaptureError('Source tab was closed before capture could start', 'source_tab_closed_before_payload');
      }
    }

    if (tab.discarded) {
      await chrome.tabs.reload(input.id);
      await waitForTabComplete(input.id, options.timeoutMs);
      try {
        tab = await chrome.tabs.get(input.id);
      } catch {
        tab = {
          ...tab,
          status: 'complete',
          discarded: false,
        };
      }
    } else if (tab.status !== 'complete') {
      await waitForTabComplete(input.id, options.timeoutMs);
      try {
        tab = await chrome.tabs.get(input.id);
      } catch {
        tab = {
          ...tab,
          status: 'complete',
        };
      }
    }

    await chrome.scripting.executeScript({
      target: { tabId: input.id },
      files: ['lib/capture-content-script.js'],
    });

    const response = await chrome.tabs.sendMessage(input.id, {
      type: 'tabout:capture',
      mode: options.mode || 'light',
    });
    if (!response || !response.ok) {
      throw createCaptureError(response && response.error ? response.error : 'Capture messaging failed', 'runtime_message_failed');
    }

    const payload = response.payload || {};
    return {
      title: payload.title || tab.title || '',
      excerpt: payload.excerpt || '',
      analysis_source_text: payload.analysis_source_text || '',
      word_count: payload.word_count || 0,
      language: payload.language || null,
      author: payload.author || null,
      lead_image_url: payload.lead_image_url || null,
      site_name: payload.site_name || getSiteNameFromUrl(input.url),
      primary_heading: payload.primary_heading || null,
      meta_description: payload.meta_description || null,
      paragraph_count: payload.paragraph_count || 0,
    };
  }

  async function findMatchingOpenTab(url, excludedTabId) {
    const normalizedTarget = normalizeUrl(url);
    if (!normalizedTarget) return null;

    const tabs = await chrome.tabs.query({});
    return (
      tabs.find((tab) => {
        if (!tab || !tab.id || tab.id === excludedTabId) return false;
        return normalizeUrl(tab.url) === normalizedTarget;
      }) || null
    );
  }

  async function captureFromTemporaryTab(url, options = {}) {
    const tempTab = await chrome.tabs.create({
      url,
      active: false,
    });
    const tempTabId = tempTab && tempTab.id ? Number(tempTab.id) : null;
    if (!tempTabId) {
      throw createCaptureError('Could not open a temporary source tab for capture', 'source_tab_closed_before_payload');
    }

    try {
      return await captureTab(
        {
          id: tempTabId,
          url,
          tabSnapshot: tempTab,
        },
        options
      );
    } finally {
      try {
        await chrome.tabs.remove(tempTabId);
      } catch {
        // Temporary capture tab may already be gone.
      }
    }
  }

  async function recoverArticleCapture(article, options = {}, excludedTabId = null) {
    const matchingTab = await findMatchingOpenTab(article.url, excludedTabId);
    if (matchingTab) {
      return captureTab(
        {
          id: matchingTab.id,
          url: article.url,
        },
        options
      );
    }
    return captureFromTemporaryTab(article.url, options);
  }

  async function captureArticle(article, options = {}) {
    const sourceRef = Number(article.source_ref);
    if (!sourceRef) {
      return recoverArticleCapture(article, options);
    }

    try {
      return await captureTab(
        {
          id: sourceRef,
          url: article.url,
        },
        options
      );
    } catch (error) {
      const canRecover =
        error &&
        error.code === 'source_tab_closed_before_payload' &&
        /before capture could start/i.test(error.message || '');
      if (!canRecover) {
        throw error;
      }
      return recoverArticleCapture(article, options, sourceRef);
    }
  }

  namespace.isUnsupportedCaptureUrl = isUnsupportedCaptureUrl;
  namespace.captureTab = captureTab;
  namespace.captureArticle = captureArticle;
})();
