test('captureArticle fails explicitly when the source tab closes while waiting for load', async () => {
  const onUpdatedListeners = [];
  const onRemovedListeners = [];

  globalThis.chrome = {
    tabs: {
      get: async () => ({ id: 42, status: 'loading', discarded: false }),
      sendMessage: async () => ({ ok: true, payload: {} }),
      reload: async () => {},
      onUpdated: {
        addListener(listener) {
          onUpdatedListeners.push(listener);
        },
        removeListener(listener) {
          const index = onUpdatedListeners.indexOf(listener);
          if (index >= 0) {
            onUpdatedListeners.splice(index, 1);
          }
        },
      },
      onRemoved: {
        addListener(listener) {
          onRemovedListeners.push(listener);
        },
        removeListener(listener) {
          const index = onRemovedListeners.indexOf(listener);
          if (index >= 0) {
            onRemovedListeners.splice(index, 1);
          }
        },
      },
    },
    scripting: {
      executeScript: async () => {},
    },
  };

  const capturePromise = globalThis.TabOutCapture.captureArticle({
    source_ref: '42',
    url: 'https://example.com/article',
  });

  setTimeout(() => {
    onRemovedListeners.forEach((listener) => listener(42));
  }, 0);

  let capturedError = null;
  try {
    await Promise.race([
      capturePromise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timed out waiting for capture to fail')), 25);
      }),
    ]);
  } catch (error) {
    capturedError = error;
  }

  if (!capturedError) {
    throw new Error('Expected capture to fail when the tab closes');
  }

  assertEqual(capturedError.code, 'source_tab_closed_before_payload');
});

test('captureArticle requests lightweight capture payloads by default', async () => {
  let receivedMessage = null;

  globalThis.chrome = {
    tabs: {
      get: async () => ({ id: 42, status: 'complete', discarded: false }),
      sendMessage: async (_tabId, message) => {
        receivedMessage = message;
        return {
          ok: true,
          payload: {
            title: 'Example article',
            excerpt: 'Lead paragraph',
            analysis_source_text: 'Example article\n\nLead paragraph',
            word_count: 120,
            language: 'en',
            author: 'Author',
            lead_image_url: 'https://example.com/cover.png',
          },
        };
      },
      reload: async () => {},
      onUpdated: {
        addListener() {},
        removeListener() {},
      },
      onRemoved: {
        addListener() {},
        removeListener() {},
      },
    },
    scripting: {
      executeScript: async () => {},
    },
  };

  const result = await globalThis.TabOutCapture.captureArticle({
    source_ref: '42',
    url: 'https://example.com/article',
  });

  assertEqual(receivedMessage.mode, 'light');
  assertEqual(result.analysis_source_text, 'Example article\n\nLead paragraph');
});

test('captureArticle falls back to an already-open matching tab when the saved source tab is gone', async () => {
  const capturedTabIds = [];

  globalThis.chrome = {
    tabs: {
      get: async (tabId) => {
        if (tabId === 42) {
          throw new Error('Missing original tab');
        }
        if (tabId === 77) {
          return {
            id: 77,
            url: 'https://example.com/article#fragment',
            status: 'complete',
            discarded: false,
          };
        }
        throw new Error(`Unexpected tab id ${tabId}`);
      },
      query: async () => [
        {
          id: 77,
          url: 'https://example.com/article#fragment',
          status: 'complete',
          discarded: false,
        },
      ],
      create: async () => {
        throw new Error('Should reuse an existing matching tab before opening a new one');
      },
      remove: async () => {
        throw new Error('Should not close a reused tab');
      },
      sendMessage: async (tabId) => {
        capturedTabIds.push(tabId);
        return {
          ok: true,
          payload: {
            title: 'Recovered article',
            analysis_source_text: 'Recovered article',
          },
        };
      },
      reload: async () => {},
      onUpdated: {
        addListener() {},
        removeListener() {},
      },
      onRemoved: {
        addListener() {},
        removeListener() {},
      },
    },
    scripting: {
      executeScript: async () => {},
    },
  };

  const result = await globalThis.TabOutCapture.captureArticle({
    source_ref: '42',
    url: 'https://example.com/article',
  });

  assertDeepEqual(capturedTabIds, [77]);
  assertEqual(result.title, 'Recovered article');
});

test('captureArticle opens and closes a temporary tab when no matching tab is open', async () => {
  const onUpdatedListeners = [];
  const createdTabs = [];
  const removedTabs = [];
  let capturedTabId = null;

  globalThis.chrome = {
    tabs: {
      get: async (tabId) => {
        if (tabId === 42) {
          throw new Error('Missing original tab');
        }
        if (tabId === 91) {
          return {
            id: 91,
            url: 'https://example.com/article',
            status: 'loading',
            discarded: false,
          };
        }
        throw new Error(`Unexpected tab id ${tabId}`);
      },
      query: async () => [],
      create: async (input) => {
        createdTabs.push({ ...input });
        setTimeout(() => {
          onUpdatedListeners.forEach((listener) => listener(91, { status: 'complete' }));
        }, 0);
        return {
          id: 91,
          url: input.url,
          status: 'loading',
          discarded: false,
        };
      },
      remove: async (tabId) => {
        removedTabs.push(tabId);
      },
      sendMessage: async (tabId) => {
        capturedTabId = tabId;
        return {
          ok: true,
          payload: {
            title: 'Fresh capture',
            analysis_source_text: 'Fresh capture',
          },
        };
      },
      reload: async () => {},
      onUpdated: {
        addListener(listener) {
          onUpdatedListeners.push(listener);
        },
        removeListener(listener) {
          const index = onUpdatedListeners.indexOf(listener);
          if (index >= 0) {
            onUpdatedListeners.splice(index, 1);
          }
        },
      },
      onRemoved: {
        addListener() {},
        removeListener() {},
      },
    },
    scripting: {
      executeScript: async () => {},
    },
  };

  const result = await globalThis.TabOutCapture.captureArticle({
    source_ref: '42',
    url: 'https://example.com/article',
  });

  assertEqual(createdTabs.length, 1);
  assertEqual(createdTabs[0].active, false);
  assertEqual(capturedTabId, 91);
  assertDeepEqual(removedTabs, [91]);
  assertEqual(result.title, 'Fresh capture');
});
