# Reading Inbox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dual-mode Tab Out homepage with pinned shortcuts, a manual AI-backed reading inbox, topic digest generation, and in-page AI settings using an OpenAI-compatible provider.

**Architecture:** Keep the extension browser-native and refactor the current single-page script into small modules around storage, capture, AI orchestration, and topic logic. Preserve the existing tab dashboard behavior while introducing `IndexedDB` as the primary reading system of record and using asynchronous background processing for capture and analysis. All new UI work must follow the installed `DESIGN.md` system for typography, color, spacing, surfaces, and interaction treatment.

**Tech Stack:** Chrome Extension Manifest V3, plain HTML/CSS/JavaScript, `IndexedDB`, `chrome.storage.local` for lightweight settings, `Defuddle` for article capture, OpenAI-compatible HTTP API, browser-native manual smoke tests.

---

### Task 1: Introduce a browser-native spec harness for pure modules

The harness exists only for pure logic: topic matching rules, article-analysis parsing, schema-shape validation, and anything else that can be exercised without opening a real `IndexedDB` connection. `IndexedDB`-backed repositories are verified by manual smoke tests in later tasks (reload + DevTools Application panel), not by this harness. This avoids the cross-spec state pollution and monotonic-version constraints that make `IndexedDB` unit tests fragile.

**Files:**
- Create: `extension/dev/spec-runner.html`
- Create: `extension/dev/spec-runner.js`
- Create: `extension/dev/spec-topic-engine.js`
- Create: `extension/dev/spec-analysis-parsing.js`

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
git add extension/dev/spec-runner.html extension/dev/spec-runner.js extension/dev/spec-topic-engine.js extension/dev/spec-analysis-parsing.js
git commit -m "test: add browser-native spec harness for pure modules"
```

### Task 2: Add IndexedDB schema and migration helpers

`IndexedDB` is verified by manual smoke checks, not by the spec harness. The harness cannot cleanly exercise schema migrations because `IndexedDB` versions are monotonic per origin and specs cannot fully clear the database between runs without racing open connections.

**Files:**
- Create: `extension/lib/db.js`
- Create: `extension/lib/schema.js`

**Step 1: Implement schema helpers**

Implement:

- `openTabOutDb()`
- `createStores(db)`
- `migrateSchema(db, oldVersion, newVersion)`

Use explicit store names and indexes instead of ad hoc storage keys. Object stores to create: `articles`, `topics`, `pinned_entries`, `jobs`.

**Step 2: Reload the unpacked extension and verify via DevTools**

Run:

```bash
open -a "Google Chrome" chrome://extensions
```

Manual checks in DevTools → Application → IndexedDB:

- The `tab-out` database opens cleanly.
- All four object stores exist with the expected key paths and indexes.
- Bumping the schema version in code and reloading triggers `migrateSchema` without data loss for stores that should be preserved.

**Step 3: Commit**

```bash
git add extension/lib/db.js extension/lib/schema.js
git commit -m "feat: add IndexedDB schema for reading inbox"
```

### Task 3: Add repository modules for pinned entries, articles, topics, and jobs

Same principle as Task 2: verified by manual smoke, not by the spec harness.

**Files:**
- Create: `extension/lib/pinned-repo.js`
- Create: `extension/lib/articles-repo.js`
- Create: `extension/lib/topics-repo.js`
- Create: `extension/lib/jobs-repo.js`

**Step 1: Implement repository helpers**

Implement small CRUD helpers with clear function names such as:

- `listPinnedEntries()`
- `createPinnedEntry(input)`
- `reorderPinnedEntries(ids)`
- `createQueuedArticle(input)`
- `markArticleRead(id)`
- `markArticleArchived(id)`
- `markArticleDeleted(id)`
- `upsertTopic(input)`
- `enqueueJob(input)`
- `listStuckJobs(thresholdMs)`
- `rollbackJobToQueued(id)`

**Step 2: Reload and verify via DevTools**

In DevTools console, drive each helper against a throwaway record and confirm the resulting rows in the IndexedDB panel. Confirm cross-store relations (article ↔ topic, article ↔ job) behave as expected.

**Step 3: Commit**

```bash
git add extension/lib/pinned-repo.js extension/lib/articles-repo.js extension/lib/topics-repo.js extension/lib/jobs-repo.js
git commit -m "feat: add repository helpers for pinned entries articles topics and jobs"
```

### Task 4: Split the homepage shell into `Now` and `Reading inbox`

**Files:**
- Modify: `extension/index.html`
- Modify: `extension/style.css`
- Modify: `extension/app.js`

**Step 1: Write the failing UI shell change**

Replace the single current dashboard layout with placeholders for:

- mode switcher with a live `Reading inbox (N)` count badge
- `Now`
- `Pinned`
- `Open now`
- `Reading inbox`
- left inbox column
- right topic digest panel
- settings trigger/drawer

Do not wire behavior yet. The badge is static ("(0)") at this point — it is wired up in a later task.

**Step 2: Reload the unpacked extension to verify the old shell no longer matches**

Run:

```bash
open -a "Google Chrome" chrome://extensions
```

Expected: after reload, the extension shows structural placeholders for both modes and the old single-column deferred layout is gone.

**Step 3: Write minimal shell rendering**

Update static markup and CSS so:

- `Now` is the default visible mode
- `Reading inbox` is hidden by default
- major sections render with stable IDs for later JavaScript hooks
- the shell styling aligns with `DESIGN.md` tokens and visual direction

**Step 4: Reload and verify the shell**

Manual checks:

- `Now` opens by default
- the mode switch is visible and shows `Reading inbox (0)` with the count badge
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

**Step 1: Implement UI and actions**

Implement:

- `renderPinnedSection()`
- a `pin-single-tab` action on open tab chips
- edit/remove UI for pinned entries
- drag-to-reorder or a minimal reorder interaction

**Step 2: Reload and verify behavior**

Manual checks:

- pinning from `Open now` adds an item to `Pinned`
- pinned items persist after opening a new tab
- edit/remove work
- order persists after refresh

**Step 3: Commit**

```bash
git add extension/index.html extension/style.css extension/app.js extension/lib/pinned-repo.js
git commit -m "feat: add pinned shortcuts to work now"
```

### Task 6: Introduce IndexedDB-backed saved-for-later records and wire the Saved badge

Up to this point the existing extension used `chrome.storage.local` for deferred tabs. This task retires that path and introduces IndexedDB-backed article records as the new source of truth for saved items. It also wires the `Reading inbox (N)` count in the mode switcher to the live count of active inbox items.

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/jobs-repo.js`

**Step 1: Implement the article queue flow**

Replace direct `chrome.storage.local` deferred writes with article records stored in IndexedDB. Do not auto-close the source tab at save time anymore, because later capture runs against the live DOM in that tab.

Implement:

- `createQueuedArticle(tab)` called from the `Save for later` handler
- `listActiveArticles({ sort: 'saved_at_desc' })`
- archive / delete wiring from the UI stubs
- a `countActiveInboxItems()` helper that drives the mode switcher badge, re-rendered whenever articles change

**Step 2: Reload and verify behavior**

Manual checks:

- clicking `Save for later` creates an inbox item immediately
- the source tab stays open
- the inbox item appears in `Reading inbox`
- the mode switcher updates to `Reading inbox (N+1)` right after save
- reload keeps the item and the count
- archiving/deleting decrements the count

**Step 3: Commit**

```bash
git add extension/app.js extension/lib/articles-repo.js extension/lib/jobs-repo.js
git commit -m "feat: introduce IndexedDB-backed reading inbox records and saved badge"
```

### Task 7: Add in-page AI settings for one OpenAI-compatible provider

**Files:**
- Create: `extension/lib/settings-repo.js`
- Create: `extension/lib/ai-client.js`
- Modify: `extension/index.html`
- Modify: `extension/style.css`
- Modify: `extension/app.js`

**Step 1: Write failing pure-function specs**

Add specs in `spec-analysis-parsing.js` (or a new `spec-ai-client.js`) for:

- validating that all required settings fields exist
- building a compatible chat/completions request payload from `base_url`, `model_id`, and a prompt

Do not spec `chrome.storage.local` load/save; that is manual-smoke only.

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: settings/client specs fail.

**Step 3: Implement settings drawer and client**

Implement:

- a settings trigger in the homepage header
- inputs for `Base URL`, `API Key`, and `Model ID`
- a visible notice next to the API key field: **"Stored in plaintext inside your browser profile. Do not use on shared machines."**
- `Test connection`
- settings persistence via `chrome.storage.local`
- a small `OpenAICompatibleClient` wrapper

**Architectural constraint:** the API key must only be read by the background / jobs-runner layer that issues AI requests. `ai-client.js` is only imported from background-side modules, never from content scripts added in later tasks. Add a comment at the top of `ai-client.js` stating this invariant so future contributors do not accidentally import it from a content-script context.

**Step 4: Reload and verify behavior**

Manual checks:

- settings drawer opens and closes
- values persist after reload
- the plaintext-storage notice is visible next to the API key field
- `Test connection` shows success/failure state
- missing fields block capture analysis from starting

**Step 5: Commit**

```bash
git add extension/lib/settings-repo.js extension/lib/ai-client.js extension/index.html extension/style.css extension/app.js extension/dev/spec-analysis-parsing.js
git commit -m "feat: add in-page OpenAI-compatible settings"
```

### Task 8: Add Defuddle-based article capture via content script with SW recovery and concurrency control

**Capture execution environment (V1):** Defuddle runs inside a content script injected into the source tab. The service worker never parses DOM directly. If the tab is `discarded` when the user clicks `Save for later`, the extension reloads the tab, waits for `status === 'complete'`, and then injects the content script. Pages where content-script injection is forbidden (`chrome://`, the Chrome Web Store, extension pages, `file://` without permission) fail the capture job cleanly with a retryable error and a human-readable reason.

**Tab-closing rule (V1):** because capture depends on the live DOM, `Save for later` does not close the source tab immediately. Only after capture succeeds may the UI offer a close action or let the user close it manually.

An `offscreen document` fallback is deliberately **not** included in V1 — it would require a second capture path whose output quality is materially different from the content-script path, and the common failure cases (discarded tabs) are already handled by the reload step. Offscreen support is tracked in the design doc's Future Enhancements section.

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/background.js`
- Create: `extension/lib/capture.js` (service-worker side orchestration)
- Create: `extension/lib/capture-content-script.js` (runs in the source tab)
- Create: `extension/lib/jobs-runner.js`
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/jobs-repo.js`
- Modify: `extension/app.js`

**Step 1: Write failing pure-function specs for lifecycle transitions and the concurrency gate**

In `spec-topic-engine.js` (or a new `spec-jobs-runner.js`), cover:

- transitioning an article from `queued` to `capturing` and back to `queued` on stuck-job rollback
- marking capture success with a Markdown payload
- marking capture failure while preserving retryability
- the concurrency gate admits at most `N = 2` jobs at once and queues the rest
- exponential backoff delay progression for repeated failures

These are all pure-function specs against in-memory state; the real jobs-runner only needs to call into these helpers.

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: capture lifecycle and concurrency specs fail.

**Step 3: Implement the capture pipeline**

Implement:

- the background-side orchestrator in `capture.js`:
  - detect `tab.discarded` via `chrome.tabs.get(tabId)`
  - if discarded: `chrome.tabs.reload(tabId)`, then wait for `chrome.tabs.onUpdated` with `status === 'complete'`
  - inject `capture-content-script.js` via `chrome.scripting.executeScript`
  - receive the Defuddle-produced Markdown + metadata via message passing
  - persist the result to the article record and advance state
- the content-script side in `capture-content-script.js`:
  - load Defuddle
  - run it against the live DOM
  - post the result back to the service worker
- permission check before attempting injection: URL scheme filter for `chrome://`, `chrome-extension://`, `file://` (unless permission granted), and the Chrome Web Store. On unsupported URLs the `Save for later` button is disabled in the UI with a tooltip, and any job that reaches the orchestrator with such a URL is marked `capture_failed` with `reason = "unsupported_url"` immediately.
- the `jobs-runner`:
  - concurrency cap: `concurrency = 2`
  - exponential backoff on transient failures (capture network errors and 429/5xx from the AI provider in later tasks)
  - on every service worker startup, call `listStuckJobs(thresholdMs)` and roll those jobs back to `queued` via `rollbackJobToQueued(id)` before picking up new work
- article status updates:
  - `queued`
  - `capturing`
  - `captured`
  - `capture_failed`

Add only the permissions needed for capture and network access (`scripting`, `tabs`, any needed host permissions).

**Step 4: Reload and verify behavior**

Manual checks:

- saving a real article transitions through queue states end-to-end
- saving from a `discarded` tab (open many tabs, wait until Chrome discards one, then click Save) triggers a reload and still captures
- saving from a `chrome://` page is blocked at the UI layer with a tooltip
- capture success stores Markdown and updates the row state
- a transient network failure shows `Retry` and does not lose the inbox item
- killing the service worker mid-capture (via `chrome://serviceworker-internals` → Stop) and reloading rolls the stuck job back to `queued` and resumes

**Step 5: Commit**

```bash
git add extension/manifest.json extension/background.js extension/lib/capture.js extension/lib/capture-content-script.js extension/lib/jobs-runner.js extension/lib/articles-repo.js extension/lib/jobs-repo.js extension/app.js extension/dev/spec-topic-engine.js
git commit -m "feat: capture articles via content script with SW recovery and concurrency gate"
```

### Task 9: Add article analysis and single-topic matching engine

Topic assignment in V1 is intentionally single-topic: each article carries one `main_topic_id` plus one `main_topic_label`. This keeps the inbox, digest logic, and lifecycle model stable while the product is still validating whether topic clustering is useful at all.

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
- tracking overlap groups for strict duplicates vs. near-duplicates

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: topic engine specs fail.

**Step 3: Implement analysis and topic assignment**

Implement:

- `analyzeArticle(markdown, metadata)`
- `matchTopic(analysis, candidateTopics)`
- `seedTopicFromArticle(articleAnalysis)`
- `assignArticleToTopic(articleId, topicId)`

Use the conservative rules from the design doc: only merge into an existing topic on clear fit, otherwise create a new topic. Prefer creating a new topic over a weak match.

**Step 4: Run specs and manual verification**

Run the spec page, then manual checks:

- captured articles move to `analyzed`
- main topic labels appear on inbox rows
- similar articles merge into one shared topic
- ambiguous articles create separate topics
- cross-cutting ideas show up as `related_topics`, not multi-membership

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
  - main topic label
  - recommended action
  - read-state visual de-emphasis for `read` articles
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

### Task 11: Add mark-as-read, archive, delete, and retry actions with topic refresh

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/topics-repo.js`
- Modify: `extension/lib/jobs-repo.js`
- Modify: `extension/lib/digest-renderer.js`
- Modify: `extension/dev/spec-topic-engine.js`

**Step 1: Write the failing lifecycle specs**

Cover:

- marking an article as `read` keeps it, keeps its topic membership, and decrements the active-inbox count
- archiving keeps the article and topic membership but removes it from default recommendations
- deleting removes the article, removes it from its topic, deletes the topic if it becomes empty, and triggers a digest refresh otherwise
- retry recreates the needed job without duplicating the article
- the Saved badge in the mode switcher reflects mark-as-read, archive, and delete immediately

**Step 2: Run the spec page to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: lifecycle specs fail.

**Step 3: Implement lifecycle actions**

Implement:

- `mark-article-read`
- `archive-article`
- `delete-article`
- `retry-article-job`
- digest refresh after mark-as-read / archive / delete
- empty-topic cleanup when an article's delete leaves a topic with zero members

**Step 4: Run specs and manual verification**

Manual checks:

- `Mark as read` visually de-emphasizes the row, keeps it in its topic, and decrements the Saved badge
- archived rows leave active inbox and no longer drive default recommendations
- delete removes the item from its topic and updates digest output
- retry recovers a failed capture/analyze item

**Step 5: Commit**

```bash
git add extension/app.js extension/lib/articles-repo.js extension/lib/topics-repo.js extension/lib/jobs-repo.js extension/lib/digest-renderer.js extension/dev/spec-topic-engine.js
git commit -m "feat: add mark-as-read archive delete and retry lifecycle actions"
```

### Task 12: Final integration sweep and regression check

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-04-17-reading-inbox-design.md`
- Modify: `docs/plans/2026-04-17-reading-inbox-implementation.md`

**Step 1: Write the final verification checklist**

Document the release checklist directly in the plan or README:

- load unpacked extension
- configure AI (verify plaintext-storage notice is visible)
- pin a tab
- save an article from a live tab
- save an article from a `discarded` tab (extension reloads the tab then captures)
- attempt to save a `chrome://` page (button disabled with tooltip)
- verify capture
- verify analysis with single-topic assignment
- verify topic digest reflects `related_topics` links instead of multi-membership
- mark an article as read (row de-emphasized, badge decrements)
- archive and delete behavior
- stop the service worker mid-capture and reload — stuck job rolls back to `queued`
- save 10 tabs at once — jobs-runner processes them with `concurrency = 2`
- mode switcher shows live `Reading inbox (N)` badge throughout

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
