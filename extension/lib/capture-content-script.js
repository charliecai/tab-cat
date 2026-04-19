(function () {
  if (window.__TABOUT_CAPTURE_LISTENER__) {
    return;
  }
  window.__TABOUT_CAPTURE_LISTENER__ = true;

  function extractMarkdown() {
    const root = document.querySelector('main article, article, main, [role="main"]') || document.body;
    const title = document.title || '';
    const text = (root.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    const excerpt = text.split('\n').find(Boolean) || '';
    const markdown = `# ${title}\n\n${text}`;
    return {
      title,
      excerpt: excerpt.slice(0, 280),
      markdown,
      word_count: text ? text.split(/\s+/).filter(Boolean).length : 0,
      language: document.documentElement.lang || null,
      author: document.querySelector('meta[name="author"]')?.content || null,
      lead_image_url:
        document.querySelector('meta[property="og:image"]')?.content ||
        document.querySelector('img')?.src ||
        null,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'tabout:capture') return;
    try {
      sendResponse({
        ok: true,
        payload: extractMarkdown(),
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error),
      });
    }
    return true;
  });
})();
