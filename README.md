# Tab Out

**Keep tabs on your tabs.**

Tab Out is a Chrome extension that replaces your new tab page with a dashboard of everything you have open. Tabs are grouped by domain, with homepages (Gmail, X, LinkedIn, etc.) pulled into their own group. Close tabs with a satisfying swoosh + confetti.

The homepage now has two modes:

- **Now** for your live open tabs and pinned shortcuts
- **Reading inbox** for saved articles, background capture, topic clustering, and lightweight reading decisions

No server. No account. The core experience stays local-first inside Chrome.

---

## Install with a coding agent

Send your coding agent (Claude Code, Codex, etc.) this repo and say **"install this"**:

```
https://github.com/zarazhangrui/tab-out
```

The agent will walk you through it. Takes about 1 minute.

---

## Features

- **See all your tabs at a glance** on a clean grid, grouped by domain
- **Homepages group** pulls Gmail inbox, X home, YouTube, LinkedIn, GitHub homepages into one card
- **Close tabs with style** with swoosh sound + confetti burst
- **Duplicate detection** flags when you have the same page open twice, with one-click cleanup
- **Click any tab to jump to it** across windows, no new tab opened
- **Pinned shortcuts** let you keep a small set of stable launch points above the live tab grid
- **Reading inbox** saves article-like tabs into an IndexedDB-backed queue instead of a sidebar checklist
- **Background capture + analysis pipeline** moves items through queued, capture, analysis, and assignment states
- **Same-URL dedupe** refreshes an existing saved item instead of creating duplicates
- **Lightweight topic overview** clusters assigned articles into a calm decision panel on the right
- **Optional OpenAI-compatible analysis** works with `Base URL + API Key + Model ID` from the in-page settings drawer
- **Localhost grouping** shows port numbers next to each tab so you can tell your vibe coding projects apart
- **Expandable groups** show the first 8 tabs with a clickable "+N more"
- **Local-first by default** your tabs and reading inbox stay in the browser; article content is only sent out if you configure an AI provider
- **Pure Chrome extension** no server, no Node.js, no npm, no setup beyond loading the extension

---

## Manual Setup

**1. Clone the repo**

```bash
git clone https://github.com/zarazhangrui/tab-out.git
```

**2. Load the Chrome extension**

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Navigate to the `extension/` folder inside the cloned repo and select it

**3. Open a new tab**

You'll see Tab Out.

---

## How it works

```
You open a new tab
  -> Now shows live open tabs grouped by domain
  -> Homepages (Gmail, X, etc.) get their own group at the top
  -> Pin stable shortcuts for recurring tools
  -> Save article-like tabs into Reading inbox without closing the source tab
  -> The background pipeline captures content, analyzes it, and assigns a single topic
  -> Reading inbox surfaces lightweight topic guidance and retryable failures
```

Everything runs inside the Chrome extension. There is still no external server. Open tabs, pinned shortcuts, reading records, and topic metadata are stored locally in the extension. AI analysis is optional; when configured, captured article content is sent directly to the provider host you entered in Settings.

---

## Tech stack

| What | How |
|------|-----|
| Extension | Chrome Manifest V3 |
| Storage | IndexedDB for reading inbox + chrome.storage.local for settings |
| Sound | Web Audio API (synthesized, no files) |
| Animations | CSS transitions + JS confetti particles |
| Capture | Service worker + injected content script |
| AI | OpenAI-compatible chat completions (optional) |

---

## License

MIT

---

Built by [Zara](https://x.com/zarazhangrui)
