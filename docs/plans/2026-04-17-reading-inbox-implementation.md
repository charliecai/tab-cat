# Reading Inbox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dual-mode Tab Out homepage with pinned shortcuts, a manual AI-backed reading inbox, topic digest generation, and in-page AI settings using an OpenAI-compatible provider.

**Architecture:** Keep the extension browser-native and refactor the current single-page script into small modules around storage, capture, AI orchestration, and topic logic. Preserve the existing tab dashboard behavior while introducing `IndexedDB` as the primary reading system of record and using asynchronous background processing for capture and analysis.

**Tech Stack:** Chrome Extension Manifest V3, plain HTML/CSS/JavaScript, `IndexedDB`, `chrome.storage.local` for lightweight settings, `Defuddle` for article capture, OpenAI-compatible HTTP API, browser-native manual smoke tests.

---

### Task 1: Introduce a browser-native spec harness for pure modules

**Files:**
- Create: `extension/dev/spec-runner.html`
- Create: `extension/dev/spec-runner.js`
- Create: `extension/dev/spec-topic-engine.js`
- Create: `extension/dev/spec-storage-schema.js`

**Step 1: Write the failing spec page**

Create `extension/dev/spec-runner.html` and import `spec-runner.js` plus empty spec files that reference modules that do not exist yet.

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the page shows failing specs or import errors for missing modules.

**Step 3: Write the minimal runner**

Add a tiny assertion runner that renders pass/fail results in the page and exposes `test()` and `assertEqual()` helpers.

**Step 4: Run the spec page to verify the runner works**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the page renders the runner and shows pending/failing specs cleanly.

**Step 5: Commit**

```bash
git add extension/dev/spec-runner.html extension/dev/spec-runner.js extension/dev/spec-topic-engine.js extension/dev/spec-storage-schema.js
git commit -m "test: add browser-native spec harness for pure modules"
```

### Task 2: Add IndexedDB schema and migration helpers

**Files:**
- Create: `extension/lib/db.js`
- Create: `extension/lib/schema.js`
- Modify: `extension/dev/spec-storage-schema.js`

**Step 1: Write failing schema specs**

Add specs for:

- opening the database
- creating object stores for `articles`, `topics`, `pinned_entries`, and `jobs`
- migrating a database version safely

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: specs fail because `db.js` and `schema.js` are missing.

**Step 3: Write minimal schema helpers**

Implement:

- `openTabOutDb()`
- `createStores(db)`
- `migrateSchema(db, oldVersion, newVersion)`

Use explicit store names and indexes instead of ad hoc storage keys.

**Step 4: Run the spec page to verify it passes**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: schema specs pass.

**Step 5: Commit**

```bash
git add extension/lib/db.js extension/lib/schema.js extension/dev/spec-storage-schema.js
git commit -m "feat: add IndexedDB schema for reading inbox"
```

### Task 3: Add repository modules for pinned entries, articles, topics, and jobs

**Files:**
- Create: `extension/lib/pinned-repo.js`
- Create: `extension/lib/articles-repo.js`
- Create: `extension/lib/topics-repo.js`
- Create: `extension/lib/jobs-repo.js`
- Modify: `extension/dev/spec-storage-schema.js`

**Step 1: Write failing repository specs**

Cover:

- creating and ordering pinned entries
- creating an article record in `queued` state
- updating article lifecycle state
- creating/updating topics
- enqueueing and completing background jobs

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: repository specs fail because the repository modules are missing.

**Step 3: Write minimal repository helpers**

Implement small CRUD helpers with clear function names such as:

- `listPinnedEntries()`
- `createPinnedEntry(input)`
- `reorderPinnedEntries(ids)`
- `createQueuedArticle(input)`
- `markArticleArchived(id)`
- `markArticleDeleted(id)`
- `upsertTopic(input)`
- `enqueueJob(input)`

**Step 4: Run the spec page to verify it passes**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: repository specs pass.

**Step 5: Commit**

```bash
git add extension/lib/pinned-repo.js extension/lib/articles-repo.js extension/lib/topics-repo.js extension/lib/jobs-repo.js extension/dev/spec-storage-schema.js
git commit -m "feat: add repository helpers for pinned entries articles and topics"
```

### Task 4: Split the homepage shell into `Work now` and `Reading inbox`

**Files:**
- Modify: `extension/index.html`
- Modify: `extension/style.css`
- Modify: `extension/app.js`

**Step 1: Write the failing UI shell change**

Replace the single current dashboard layout with placeholders for:

- mode switcher
- `Work now`
- `Pinned`
- `Open now`
- `Reading inbox`
- left inbox column
- right topic digest panel
- settings trigger/drawer

Do not wire behavior yet.

**Step 2: Reload the unpacked extension to verify the old shell no longer matches**

Run:

```bash
open -a "Google Chrome" chrome://extensions
```

Expected: after reload, the extension shows structural placeholders for both modes and the old single-column deferred layout is gone.

**Step 3: Write minimal shell rendering**

Update static markup and CSS so:

- `Work now` is the default visible mode
- `Reading inbox` is hidden by default
- major sections render with stable IDs for later JavaScript hooks

**Step 4: Reload and verify the shell**

Manual checks:

- `Work now` opens by default
- the mode switch is visible
- `Reading inbox` has left and right panels
- layout still works on desktop width and a narrow viewport

**Step 5: Commit**

```bash
git add extension/index.html extension/style.css extension/app.js
git commit -m "feat: add dual-mode homepage shell"
```

### Task 5: Add `Pinned v1` with manual management

**Files:**
- Modify: `extension/index.html`
- Modify: `extension/style.css`
- Modify: `extension/app.js`
- Modify: `extension/lib/pinned-repo.js`

**Step 1: Write the failing pinned specs**

Add repository specs for:

- creating a pinned entry from tab metadata
- editing title and URL
- removing an entry
- reordering entries

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: pinned entry specs fail.

**Step 3: Write minimal UI and actions**

Implement:

- `renderPinnedSection()`
- a `pin-single-tab` action on open tab chips
- edit/remove UI for pinned entries
- drag-to-reorder or a minimal reorder interaction

**Step 4: Reload and verify behavior**

Manual checks:

- pinning from `Open now` adds an item to `Pinned`
- pinned items persist after opening a new tab
- edit/remove work
- order persists after refresh

**Step 5: Commit**

```bash
git add extension/index.html extension/style.css extension/app.js extension/lib/pinned-repo.js extension/dev/spec-storage-schema.js
git commit -m "feat: add pinned shortcuts to work now"
```

### Task 6: Move saved-for-later records from `chrome.storage.local` to IndexedDB article records

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/jobs-repo.js`
- Modify: `extension/dev/spec-storage-schema.js`

**Step 1: Write the failing article queue specs**

Add specs for:

- creating a queued article record from a tab
- listing active articles sorted by `saved_at desc`
- archiving an article
- deleting an article
- retrying a failed job

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: article queue specs fail.

**Step 3: Write minimal migration-aware article flow**

Replace direct `chrome.storage.local` deferred writes with article records stored in IndexedDB. Preserve the current “save, close tab, refresh UI” feel while changing the backing store.

**Step 4: Reload and verify behavior**

Manual checks:

- clicking `Save for later` creates an inbox item immediately
- the source tab closes
- the inbox item appears in `Reading inbox`
- reload keeps the item

**Step 5: Commit**

```bash
git add extension/app.js extension/lib/articles-repo.js extension/lib/jobs-repo.js extension/dev/spec-storage-schema.js
git commit -m "feat: move reading inbox records to IndexedDB"
```

### Task 7: Add in-page AI settings for one OpenAI-compatible provider

**Files:**
- Create: `extension/lib/settings-repo.js`
- Create: `extension/lib/ai-client.js`
- Modify: `extension/index.html`
- Modify: `extension/style.css`
- Modify: `extension/app.js`

**Step 1: Write the failing settings and client specs**

Add specs for:

- saving and loading `base_url`, `api_key`, and `model_id`
- validating that all required fields exist
- building a compatible chat/completions request payload

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: settings/client specs fail.

**Step 3: Write minimal settings drawer and client**

Implement:

- a settings trigger in the homepage header
- inputs for `Base URL`, `API Key`, and `Model ID`
- `Test connection`
- settings persistence
- a small `OpenAICompatibleClient` wrapper

**Step 4: Reload and verify behavior**

Manual checks:

- settings drawer opens and closes
- values persist after reload
- `Test connection` shows success/failure state
- missing fields block capture analysis from starting

**Step 5: Commit**

```bash
git add extension/lib/settings-repo.js extension/lib/ai-client.js extension/index.html extension/style.css extension/app.js extension/dev/spec-storage-schema.js
git commit -m "feat: add in-page OpenAI-compatible settings"
```

### Task 8: Add Defuddle-based article capture jobs

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/background.js`
- Create: `extension/lib/capture.js`
- Create: `extension/lib/jobs-runner.js`
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/jobs-repo.js`
- Modify: `extension/app.js`

**Step 1: Write the failing capture job specs**

Add pure specs for:

- transitioning an article from `queued` to `capturing`
- marking capture success with Markdown payload
- marking capture failure and preserving retryability

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: capture lifecycle specs fail.

**Step 3: Write minimal capture pipeline**

Implement:

- job pickup from a background or orchestrator layer
- Defuddle-based capture for saved URLs
- persistence of Markdown content and metadata
- article status updates:
  - `queued`
  - `capturing`
  - `captured`
  - `capture_failed`

Add only the permissions needed for capture and network access.

**Step 4: Reload and verify behavior**

Manual checks:

- saving a real article transitions through queue states
- capture success stores Markdown and updates the row state
- failure shows `Retry`

**Step 5: Commit**

```bash
git add extension/manifest.json extension/background.js extension/lib/capture.js extension/lib/jobs-runner.js extension/lib/articles-repo.js extension/lib/jobs-repo.js extension/app.js extension/dev/spec-storage-schema.js
git commit -m "feat: add Defuddle capture pipeline for saved articles"
```

### Task 9: Add article analysis and topic matching engine

**Files:**
- Create: `extension/lib/article-analysis.js`
- Create: `extension/lib/topic-engine.js`
- Modify: `extension/lib/ai-client.js`
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/topics-repo.js`
- Modify: `extension/dev/spec-topic-engine.js`

**Step 1: Write the failing topic engine specs**

Cover:

- creating a seed topic from the first analyzed article
- matching an article into an existing topic only on strong fit
- creating a new topic on ambiguity
- preserving one `main_topic_id` per article
- tracking overlap groups

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: topic engine specs fail.

**Step 3: Write minimal article analysis and topic logic**

Implement:

- `analyzeArticle(markdown, metadata)`
- `matchTopic(analysis, candidateTopics)`
- `seedTopicFromArticle(articleAnalysis)`
- `assignArticleToTopic(articleId, topicId)`

Use the conservative rules from the design doc: only merge on clear fit; otherwise create a new topic.

**Step 4: Run specs and manual verification**

Run the spec page, then manual checks:

- captured articles move to `analyzed`
- topic labels appear on inbox rows
- similar articles merge into one topic
- ambiguous articles create separate topics

**Step 5: Commit**

```bash
git add extension/lib/article-analysis.js extension/lib/topic-engine.js extension/lib/ai-client.js extension/lib/articles-repo.js extension/lib/topics-repo.js extension/dev/spec-topic-engine.js
git commit -m "feat: add article analysis and topic assignment"
```

### Task 10: Render `Reading inbox` rows and topic digest panels

**Files:**
- Modify: `extension/index.html`
- Modify: `extension/style.css`
- Modify: `extension/app.js`
- Create: `extension/lib/digest-renderer.js`

**Step 1: Write the failing UI expectation**

Capture the target structure in code comments and placeholder rendering calls:

- left list sorted by `saved_at desc`
- row fields:
  - title
  - site
  - saved time
  - status
  - main topic
  - recommended action
- right digest fields:
  - title
  - one-line digest
  - best articles
  - overlaps
  - suggested path

**Step 2: Reload the extension to verify placeholders are missing**

Manual check the current incomplete rendering.

**Step 3: Write minimal renderers**

Implement:

- `renderReadingInbox()`
- `renderReadingInboxRow(article)`
- `renderTopicDigest(topicId)`
- selection/highlight linkage between the left row and the right digest panel

**Step 4: Reload and verify behavior**

Manual checks:

- inbox rows are ordered by newest first
- clicking a row updates the digest panel
- digest panel shows topic-level guidance rather than article detail dumps

**Step 5: Commit**

```bash
git add extension/index.html extension/style.css extension/app.js extension/lib/digest-renderer.js
git commit -m "feat: render reading inbox and topic digest"
```

### Task 11: Add archive, delete, and retry actions with topic refresh

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/topics-repo.js`
- Modify: `extension/lib/jobs-repo.js`
- Modify: `extension/lib/digest-renderer.js`
- Modify: `extension/dev/spec-topic-engine.js`

**Step 1: Write the failing lifecycle specs**

Cover:

- archiving keeps the article and topic membership
- deleting removes the article and refreshes or deletes its topic
- retry recreates the needed job without duplicating the article

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: lifecycle specs fail.

**Step 3: Write minimal lifecycle actions**

Implement:

- `archive-article`
- `delete-article`
- `retry-article-job`
- digest refresh after delete
- empty-topic cleanup

**Step 4: Run specs and manual verification**

Manual checks:

- archived rows leave active inbox and no longer drive default recommendations
- delete removes the item and updates digest output
- retry recovers a failed capture/analyze item

**Step 5: Commit**

```bash
git add extension/app.js extension/lib/articles-repo.js extension/lib/topics-repo.js extension/lib/jobs-repo.js extension/lib/digest-renderer.js extension/dev/spec-topic-engine.js
git commit -m "feat: add archive delete and retry lifecycle actions"
```

### Task 12: Final integration sweep and regression check

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-04-17-reading-inbox-design.md`
- Modify: `docs/plans/2026-04-17-reading-inbox-implementation.md`

**Step 1: Write the final verification checklist**

Document the release checklist directly in the plan or README:

- load unpacked extension
- configure AI
- pin a tab
- save an article
- verify capture
- verify analysis
- verify topic digest
- archive and delete behavior

**Step 2: Run the regression sweep**

Run:

```bash
open -a "Google Chrome" chrome://extensions
```

Expected: the unpacked extension reloads cleanly with no manifest errors. Manual smoke flow passes end-to-end.

**Step 3: Update docs**

Update `README.md` so setup and feature descriptions match the new dual-mode reading inbox behavior.

**Step 4: Commit**

```bash
git add README.md docs/plans/2026-04-17-reading-inbox-design.md docs/plans/2026-04-17-reading-inbox-implementation.md
git commit -m "docs: document reading inbox implementation and verification"
```
