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

  async function waitForTabComplete(tabId) {
    return new Promise((resolve) => {
      const onUpdated = (updatedTabId, changeInfo) => {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  }

  async function captureArticle(article) {
    if (isUnsupportedCaptureUrl(article.url)) {
      const error = new Error('Capture unavailable on this page');
      error.code = 'unsupported_url';
      throw error;
    }

    const sourceRef = Number(article.source_ref);
    if (!sourceRef) {
      const error = new Error('Source tab is no longer available');
      error.code = 'source_tab_closed_before_payload';
      throw error;
    }

    let tab;
    try {
      tab = await chrome.tabs.get(sourceRef);
    } catch {
      const error = new Error('Source tab was closed before capture could start');
      error.code = 'source_tab_closed_before_payload';
      throw error;
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
      const error = new Error(response && response.error ? response.error : 'Capture messaging failed');
      error.code = 'runtime_message_failed';
      throw error;
    }

    return response.payload;
  }

  namespace.isUnsupportedCaptureUrl = isUnsupportedCaptureUrl;
  namespace.captureArticle = captureArticle;
})();
