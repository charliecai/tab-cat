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
