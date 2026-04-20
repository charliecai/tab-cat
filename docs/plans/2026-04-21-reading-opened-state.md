# Reading Opened State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the `Unopened` and `Opened` reading status filters reflect real user behavior by recording `last_opened_at` whenever an article is reopened from the Reading inbox.

**Architecture:** Keep the change inside the existing `open-article-source` action path in `extension/app.js`. Reuse the `reading-result-card` root `data-article-id` to identify the article being reopened, persist `last_opened_at` through `TabOutArticlesRepo.updateArticle`, then rerender the Reading inbox so status counts stay current.

**Tech Stack:** Chrome extension, JavaScript, browser spec runner

---

### Task 1: Lock the reopened-article contract in an app spec

**Files:**
- Modify: `extension/dev/spec-app.js`
- Test: `extension/dev/spec-app-runner.html`

**Step 1: Write the failing test**

Add a spec that renders a ready article, clicks `Open`, and expects:

- `chrome.tabs.create` to receive the article URL
- `TabOutArticlesRepo.updateArticle` to receive a non-null `last_opened_at`

**Step 2: Run test to verify it fails**

Run the app spec runner and confirm the new spec fails because the current `open-article-source` path does not persist `last_opened_at`.

**Step 3: Write minimal implementation**

Update the open action handler to derive the article id from the nearest reading result card, persist `last_opened_at`, rerender the inbox, and then open the source tab.

**Step 4: Run test to verify it passes**

Re-run the app spec runner and confirm the new spec passes.

**Step 5: Commit**

```bash
git add extension/app.js extension/dev/spec-app.js docs/plans/2026-04-21-reading-opened-state.md
git commit -m "fix: persist reading opened state"
```
