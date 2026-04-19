# AGENTS.md -- Tab Out: Setup & Onboarding Guide for Coding Agents

You're installing **Tab Out** for the user. Your job is not just to set it up -- it's to get them excited about using it.

---

## Step 0 -- Introduce the product

Before doing anything technical, tell the user what they're about to get:

> **Tab Out** replaces your new tab page with a clean dashboard of everything you have open, grouped by domain.
>
> Here's what makes it great:
> - **See all your open tabs at a glance** grouped by domain on a grid
> - **Homepages group** pulls Gmail, X, LinkedIn, YouTube, GitHub homepages into one card for easy cleanup
> - **Close tabs with style** satisfying swoosh sound + confetti burst
> - **Duplicate detection** flags when you have the same page open twice
> - **Click any tab title to jump to it** even across different Chrome windows
> - **Save for later** bookmark individual tabs to a checklist before closing them
> - **100% local** no server, no accounts, no data sent anywhere
>
> It's just a Chrome extension. Setup takes about 1 minute.

---

## Step 1 -- Clone the repo

```bash
git clone https://github.com/zarazhangrui/tab-out.git
cd tab-out
```

---

## Step 2 -- Install the Chrome extension

This is the one step that requires manual action from the user. Make it as easy as possible.

**First**, print the full path to the `extension/` folder:
```bash
echo "Extension folder: $(cd extension && pwd)"
```

**Then**, copy the `extension/` folder path to their clipboard:
- macOS: `cd extension && pwd | pbcopy && echo "Path copied to clipboard"`
- Linux: `cd extension && pwd | xclip -selection clipboard 2>/dev/null || echo "Path: $(pwd)"`
- Windows: `cd extension && echo %CD% | clip`

**Then**, open the extensions page:
```bash
open "chrome://extensions"
```

**Then**, walk the user through it step by step:

> I've copied the extension folder path to your clipboard. Now:
>
> 1. You should see Chrome's extensions page. In the **top-right corner**, toggle on **Developer mode** (it's a switch).
> 2. Once Developer mode is on, you'll see a button called **"Load unpacked"** appear in the top-left. Click it.
> 3. A file picker will open. **Press Cmd+Shift+G** (Mac) or **Ctrl+L** (Windows/Linux) to open the "Go to folder" bar, then **paste** the path I copied (Cmd+V / Ctrl+V) and press Enter.
> 4. Click **"Select"** or **"Open"** and the extension will install.
>
> You should see "Tab Out" appear in your extensions list.

**Also**, open the file browser directly to the extension folder as a fallback:
- macOS: `open extension/`
- Linux: `xdg-open extension/`
- Windows: `explorer extension\\`

---

## Step 3 -- Show them around

Once the extension is loaded:

> You're all set! Open a **new tab** and you'll see Tab Out.
>
> Here's how it works:
> 1. **Your open tabs are grouped by domain** in a grid layout.
> 2. **Homepages** (Gmail inbox, X home, YouTube, etc.) are in their own group at the top.
> 3. **Click any tab title** to jump directly to that tab.
> 4. **Click the X** next to any tab to close just that one (with swoosh + confetti).
> 5. **Click "Close all N tabs"** on a group to close the whole thing.
> 6. **Duplicate tabs** are flagged with an amber "(2x)" badge. Click "Close duplicates" to keep one copy.
> 7. **Save a tab for later** by clicking the bookmark icon before closing it. Saved tabs appear in the sidebar.
>
> That's it! No server to run, no config files. Everything works right away.

---

## Key Facts

- Tab Out is a pure Chrome extension. No server, no Node.js, no npm.
- Saved tabs are stored in `chrome.storage.local` (persists across sessions).
- 100% local. No data is sent to any external service.
- To update: `cd tab-out && git pull`, then reload the extension in `chrome://extensions`.

---

## Browser QA For Agents

When you need to QA Tab Out through a browser, use a real extension runtime. Do **not** rely on the default DevTools-managed Chrome session if it was launched with `--disable-extensions`; in that environment, `Load unpacked` can show a toast while the extension never actually installs.

### What worked reliably

Use a **headed** Playwright Chromium persistent context and load the extension explicitly:

```bash
uv run --with playwright python - <<'PY'
import tempfile
from playwright.sync_api import sync_playwright

EXT = "/Users/charliec/Projects/my-works/tab-out/extension"
user_data_dir = tempfile.mkdtemp(prefix="tabout-qa-")

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir,
        headless=False,
        args=[
            f"--disable-extensions-except={EXT}",
            f"--load-extension={EXT}",
        ],
        viewport={"width": 1440, "height": 1024},
    )
    boot = context.new_page()
    boot.goto("chrome://extensions", wait_until="load")
    boot.wait_for_timeout(2000)
    ext_id = context.service_workers[0].url.split("/")[2]
    page = context.new_page()
    page.goto(f"chrome-extension://{ext_id}/index.html", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    print("Extension ready:", ext_id)
    input("Press Enter to close...")
    context.close()
PY
```

### Important runtime notes

- Use **headed** Chromium. The extension runtime was not stable enough in headless mode.
- Open `chrome://extensions` first. That consistently caused the extension service worker to appear.
- Derive the extension id from `context.service_workers[0].url` instead of guessing it.
- Open the app with `chrome-extension://<extension-id>/index.html` rather than `chrome://newtab` during automation.

### Recommended smoke flow

After the extension page is open:

1. Seed a few real tabs such as `example.com`, `iana.org`, and `news.ycombinator.com`.
2. Verify `Now` renders grouped tabs.
3. Click one `Save for later`.
4. Open `Reading inbox`.
5. Verify the saved article appears and the right panel shows the fallback topic summary when AI is not configured.
6. Click `Retry`.
7. Click `Mark read`.
8. Switch to `Read` and verify the item moved there.
9. Open `Settings` and confirm the debug surface shows the article pipeline state.

### How to capture QA evidence

- Attach `console` listeners to every page in the context.
- Attach `requestfailed` and `response` listeners to catch network failures.
- Take screenshots at least for:
  - initial `Now`
  - `Reading inbox` after save
  - `Read` view after marking read

### Noise to avoid misclassifying as product bugs

- External seed pages can emit their own favicon 404s such as `https://example.com/favicon.ico`.
- Only treat errors originating from the extension page or its resources as Tab Out regressions.
