(function () {
  if (window.__TABOUT_CAPTURE_LISTENER__) {
    return;
  }
  window.__TABOUT_CAPTURE_LISTENER__ = true;

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniqueParagraphs(values, limit = 4) {
    const seen = new Set();
    const paragraphs = [];
    for (const value of values) {
      const next = cleanText(value);
      if (!next || next.length < 40 || seen.has(next)) continue;
      seen.add(next);
      paragraphs.push(next);
      if (paragraphs.length >= limit) break;
    }
    return paragraphs;
  }

  function getSiteName() {
    try {
      return window.location.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function extractLightweightPayload() {
    const root = document.querySelector('main article, article, main, [role="main"]') || document.body;
    const title = document.title || '';
    const primaryHeading = cleanText(
      root.querySelector('h1')?.textContent || document.querySelector('h1')?.textContent || ''
    );
    const metaDescription = cleanText(
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      ''
    );
    const rawBodyText = String(root.innerText || document.body.innerText || '');
    const rawText = cleanText(rawBodyText);
    const paragraphCandidates = Array.from(root.querySelectorAll('p')).map((node) => node.textContent || '');
    if (paragraphCandidates.length === 0 && rawText) {
      paragraphCandidates.push(...rawBodyText.split(/\n{2,}/g));
    }
    const paragraphs = uniqueParagraphs(paragraphCandidates);
    const excerpt = metaDescription || paragraphs[0] || cleanText(rawText.split('\n').find(Boolean) || '');
    const analysisSourceText = [
      title ? `Title: ${title}` : '',
      primaryHeading ? `Heading: ${primaryHeading}` : '',
      metaDescription ? `Description: ${metaDescription}` : '',
      paragraphs.length ? `Paragraphs:\n${paragraphs.join('\n\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 4000);

    return {
      title,
      excerpt: excerpt.slice(0, 280),
      analysis_source_text: analysisSourceText,
      word_count: rawText ? rawText.split(/\s+/).filter(Boolean).length : 0,
      language: document.documentElement.lang || null,
      author: document.querySelector('meta[name="author"]')?.content || null,
      site_name: getSiteName(),
      primary_heading: primaryHeading || null,
      meta_description: metaDescription || null,
      paragraph_count: paragraphs.length,
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
        payload: extractLightweightPayload(),
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
