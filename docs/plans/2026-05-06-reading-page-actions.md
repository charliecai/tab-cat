# Reading Page Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an in-page Reading inbox quick-action card that lets users mark the current article read or delete it, then close the current tab.

**Architecture:** Extend `TabOutActionController` with active-tab matching, page injection, and message handlers. Wire `background.js` to inject on tab lifecycle events and handle quick-action messages. Keep the injected UI self-contained because it runs on arbitrary webpages.

**Tech Stack:** Chrome Extension Manifest V3, plain JavaScript, IndexedDB-backed repos, browser spec runner under `extension/dev`.

---

### Task 1: Failing Action Controller Specs

**Files:**
- Modify: `extension/dev/spec-action-controller.js`

**Step 1: Write failing tests**
Add tests for `showCurrentTabReadingActions`, `markCurrentTabArticleReadAndClose`, and `deleteCurrentTabArticleAndClose`.

**Step 2: Run specs to verify failure**
Run the browser spec runner and confirm failures because the new functions do not exist.

### Task 2: Implement Controller Behavior

**Files:**
- Modify: `extension/lib/action-controller.js`

**Step 1: Add matching/injection helpers**
Add helper functions that query the active tab, find matching article by canonical URL, inject or remove the quick-action card with `chrome.scripting.executeScript`.

**Step 2: Add article operations**
Add functions that mark the current tab article read or delete it, refresh badge state, and close the tab.

**Step 3: Export functions**
Expose the new functions on `globalThis.TabOutActionController`.

**Step 4: Run specs to verify pass**
Run the browser spec runner and confirm the new tests pass.

### Task 3: Wire Background Runtime

**Files:**
- Modify: `extension/background.js`

**Step 1: Inject on tab lifecycle events**
Call the controller injection helper on install/startup/tab activated/tab updated/window focus, after badge refresh.

**Step 2: Handle quick-action messages**
Handle `tabout:reading-page-action` messages from injected UI for `mark-read-close` and `delete-close`.

**Step 3: Run specs and smoke QA**
Run browser specs and a headed extension smoke flow.

### Task 4: Final Verification and Commit

**Files:**
- Modified files from prior tasks

**Step 1: Verify git diff**
Review changed files and confirm only expected changes are present.

**Step 2: Run verification**
Run browser specs and smoke QA.

**Step 3: Commit**
Commit with an English message and AI co-author attribution.
