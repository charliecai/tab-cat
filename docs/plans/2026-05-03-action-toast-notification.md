# Action Toast Notification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a warm, design-aligned in-page toast in the current tab when the toolbar action saves or fails to save a page to Reading inbox.

**Architecture:** Keep the save behavior in `TabOutActionController`, and add a small injected notification helper that runs in the active tab via `chrome.scripting.executeScript`. The background action click will show success/already-saved/failure messages without opening or closing tabs.

**Tech Stack:** Chrome Extension MV3, plain JavaScript, existing dev spec runner with Playwright.

---

### Task 1: Add Action Toast API With Failing Specs

**Files:**
- Modify: `extension/dev/spec-action-controller.js`
- Modify: `extension/lib/action-controller.js`

**Steps:**
1. Add a spec proving `saveCurrentTabToReadingInbox` injects a success toast into the current tab after creating a new article.
2. Add a spec proving an existing inbox article injects an `Already in Reading inbox` toast.
3. Add a spec proving unsupported pages inject a failure toast and keep the default icon.
4. Run the spec runner and confirm the new tests fail because toast injection is not implemented.

### Task 2: Implement Minimal Injected Toast

**Files:**
- Modify: `extension/lib/action-controller.js`
- Modify: `extension/background.js`

**Steps:**
1. Add `showActionToast(chromeApi, tabId, options)` that calls `chrome.scripting.executeScript` with a function injected into the page.
2. Style the injected toast with `DESIGN.md` warm ivory surface, rounded corners, soft border, subtle shadow, success/failure accent.
3. Update save success, dedupe, and unsupported/error paths to call `showActionToast`.
4. Ensure injection failures are swallowed so restricted pages do not break the action flow.
5. Run the spec runner and confirm all specs pass.

### Task 3: Browser Smoke And Commit

**Files:**
- Verify: `extension/background.js`, `extension/lib/action-controller.js`, `extension/dev/spec-action-controller.js`

**Steps:**
1. Run `git diff --check`.
2. Run the full spec runner through Playwright.
3. Run a headed extension smoke that clicks the action and verifies the article is saved and a toast node appears on the page.
4. Commit the Story with a descriptive English message and AI co-author attribution.
