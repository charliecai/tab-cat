# Tab Cat

**Keep your tabs tidy, fast, and visible.**

Tab Cat is a Chrome extension that replaces the new tab page with a calm dashboard for everything you already have open. It groups live tabs by domain, highlights duplicates, gives homepages their own cleanup lane, and adds a lightweight reading inbox for article-like tabs you want to process later.

The extension is local-first. There is no server to run and no account to create.

## Highlights

- Group open tabs by domain on a single dashboard
- Pull Gmail, X, LinkedIn, GitHub, YouTube, and similar homepages into a dedicated group
- Jump to any existing tab directly, even across Chrome windows
- Close tabs with motion, sound, and confetti
- Detect duplicate tabs and clean them up quickly
- Pin a short list of stable launch points above the live tab grid
- Save article-like tabs into a Reading inbox instead of letting them pile up
- Capture and analyze saved articles with an optional OpenAI-compatible provider
- Keep core browsing state local inside Chrome

## Install

1. Clone the repo:

```bash
git clone https://github.com/charliecai/tab-cat.git
cd tab-cat
```

2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` folder.

After that, opening a new tab will show Tab Cat.

## How It Works

- `Now` shows your currently open tabs and pinned shortcuts.
- `Reading inbox` stores article-like tabs for later processing.
- Saved articles move through capture and analysis states in the background.
- If you configure an AI provider, captured article text is sent directly to the provider host you entered in Settings.
- If you do not configure AI, the rest of the extension still works locally.

## Tech Notes

- Chrome Extension: Manifest V3
- Storage: IndexedDB plus `chrome.storage.local`
- Capture: service worker plus injected content script
- AI: OpenAI-compatible chat completions API

## Acknowledgements

- Thanks to [zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out) for the original inspiration behind this project.
- Thanks to [RouteCat](https://routecat.io) for providing the Claude and Codex relay API used during development.

## License

MIT
