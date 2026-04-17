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

  async function captureArticle(article) {
    if (isUnsupportedCaptureUrl(article.url)) {
      throw createCaptureError('Capture unavailable on this page', 'unsupported_url');
    }

    const sourceRef = Number(article.source_ref);
    if (!sourceRef) {
      throw createCaptureError('Source tab is no longer available', 'source_tab_closed_before_payload');
    }

    let tab;
    try {
      tab = await chrome.tabs.get(sourceRef);
    } catch {
      throw createCaptureError('Source tab was closed before capture could start', 'source_tab_closed_before_payload');
    }

    if (tab.discarded) {
      await chrome.tabs.reload(sourceRef);
      await waitForTabComplete(sourceRef);
      tab = await chrome.tabs.get(sourceRef);
    } else if (tab.status !== 'complete') {
      await waitForTabComplete(sourceRef);
    }

    await chrome.scripting.executeScript({
      target: { tabId: sourceRef },
      files: ['lib/capture-content-script.js'],
    });

    const response = await chrome.tabs.sendMessage(sourceRef, {
      type: 'tabout:capture',
    });
    if (!response || !response.ok) {
      throw createCaptureError(response && response.error ? response.error : 'Capture messaging failed', 'runtime_message_failed');
    }

    return response.payload;
  }

  namespace.isUnsupportedCaptureUrl = isUnsupportedCaptureUrl;
  namespace.captureArticle = captureArticle;
})();
