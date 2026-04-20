# Reading Inbox Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the topic-summary reading inbox with a filter-first active reading queue built around labels, priority buckets, and actionable article cards.

**Architecture:** Keep the extension browser-native and reuse the existing `IndexedDB` article store, but stop routing the inbox UI through topic summary state. The redesigned inbox should read directly from article metadata, compute filter groups from the active article list, render medium-density result cards grouped by priority, and degrade gracefully while articles are being reprocessed for the new model.

**Tech Stack:** Chrome Extension Manifest V3, plain HTML/CSS/JavaScript, `IndexedDB`, in-page browser spec harnesses under `extension/dev/`, real extension smoke tests through a headed Playwright Chromium persistent context.

---

### Task 1: Replace the inbox shell markup with filter and results panels

**Files:**
- Modify: `extension/index.html`
- Modify: `extension/lib/homepage-controller.js`
- Test: `extension/dev/spec-homepage-controller.js`

**Step 1: Write the failing controller spec**

Add or update a spec that expects the homepage controller to target:

- `readingFiltersPanel`
- `readingResultsPanel`
- `readingResultsSummary`
- `readingResultsGroups`

Example expectation:

```js
assertEqual(Boolean(document.getElementById('readingFiltersPanel')), true);
assertEqual(Boolean(document.getElementById('topicSummaryPanel')), false);
```

**Step 2: Run the spec to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the homepage-controller spec fails because the old topic summary shell is still present.

**Step 3: Write the minimal HTML and controller changes**

Replace the reading inbox section structure so the controller works with a filter rail and result rail instead of a topic summary panel.

Expected DOM shape:

```html
<section class="mode-panel" data-mode-panel="reading-inbox">
  <div class="reading-layout">
    <aside id="readingFiltersPanel"></aside>
    <section id="readingResultsPanel">
      <div id="readingResultsSummary"></div>
      <div id="readingResultsGroups"></div>
    </section>
  </div>
</section>
```

**Step 4: Run the spec to verify it passes**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the homepage-controller spec passes for the new shell IDs and no longer references `topicSummaryPanel`.

**Step 5: Commit**

```bash
git add extension/index.html extension/lib/homepage-controller.js extension/dev/spec-homepage-controller.js
git commit -m "feat: replace reading inbox shell with filter and results layout" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

### Task 2: Refactor article analysis output to the new queue metadata model

**Files:**
- Modify: `extension/lib/article-analysis.js`
- Modify: `extension/lib/jobs-runner.js`
- Test: `extension/dev/spec-analysis-parsing.js`
- Test: `extension/dev/spec-jobs-runner.js`

**Step 1: Write the failing parsing spec**

Add a parsing spec that expects analysis payloads to resolve to:

- `labels`
- `priorityBucket`
- `shortReason`

Example expectation:

```js
assertEqual(result.labels.join(','), 'agent,pricing');
assertEqual(result.priorityBucket, 'read_now');
assertEqual(result.shortReason, 'Useful for the current queue because pricing changed.');
```

**Step 2: Run the spec to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: parsing fails because the code still expects `summary_short`, `main_topic_label`, and `why_recommended`.

**Step 3: Write the minimal analysis changes**

Update the article-analysis prompt and response parser to request and parse:

```text
labels, priority_bucket, short_reason, reading_time_estimate
```

Update the jobs runner to persist those values directly on the article and stop using topic assignment as part of the active inbox pipeline.

**Step 4: Add a jobs-runner spec for article updates**

Verify that a processed article is updated like this:

```js
{
  labels: ['agent', 'pricing'],
  priority_bucket: 'read_now',
  short_reason: 'Useful for the current queue because pricing changed.',
  processing_state: 'ready'
}
```

**Step 5: Run the specs to verify they pass**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: analysis parsing and jobs-runner specs pass with the new queue metadata model.

**Step 6: Commit**

```bash
git add extension/lib/article-analysis.js extension/lib/jobs-runner.js extension/dev/spec-analysis-parsing.js extension/dev/spec-jobs-runner.js
git commit -m "feat: switch article analysis to labels and queue priority" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

### Task 3: Simplify the article schema and repository reads for label-based inbox rendering

**Files:**
- Modify: `extension/lib/articles-repo.js`
- Modify: `extension/lib/schema.js`
- Modify: `extension/lib/db.js`
- Test: `extension/dev/spec-backup-service.js`

**Step 1: Write the failing repository expectations**

Add a lightweight spec or smoke helper that expects article records to include:

```js
{
  labels: [],
  priority_bucket: null,
  short_reason: null
}
```

and no longer require `main_topic_id` or `main_topic_label` to render the inbox.

**Step 2: Run the spec or smoke helper to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the article shape still reflects the topic-first schema.

**Step 3: Write the minimal schema changes**

Update article creation and storage defaults to support the queue-first model:

- add `labels`
- add `priority_bucket`
- add `short_reason`
- preserve existing baseline fields used by the queue
- stop treating topic indexes as required inbox dependencies

**Step 4: Reload the unpacked extension and verify IndexedDB**

Run:

```bash
open -a "Google Chrome" chrome://extensions
```

Manual checks in DevTools Application panel:

- Article records retain old data.
- New article records contain `labels`, `priority_bucket`, and `short_reason`.
- The extension still loads even when old topic-related records remain in IndexedDB.

**Step 5: Commit**

```bash
git add extension/lib/articles-repo.js extension/lib/schema.js extension/lib/db.js extension/dev/spec-backup-service.js
git commit -m "feat: simplify article storage for filter-first inbox rendering" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

### Task 4: Build filter derivation and active result grouping in the app layer

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/lib/homepage-controller.js`
- Test: `extension/dev/spec-app.js`

**Step 1: Write the failing app spec**

Add a pure rendering or view-model spec that expects:

- filter groups derived from active articles
- active filter chips
- result groups derived from `priority_bucket`

Example expectation:

```js
assertEqual(viewModel.filters.labels[0].value, 'agent');
assertEqual(viewModel.groups[0].id, 'read_now');
assertEqual(viewModel.groups[0].articles.length, 2);
```

**Step 2: Run the spec to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the app still renders a linear inbox list plus topic summary panel.

**Step 3: Write the minimal view-model helpers**

Implement helpers in `extension/app.js` for:

- deriving filters from active articles
- applying current filter state
- grouping visible articles by priority bucket
- sorting each group by `last_saved_at`

Keep the controller focused on state reads and DOM writes, not data derivation.

**Step 4: Run the spec to verify it passes**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the app spec passes with label, source, time, and status filtering plus grouped results.

**Step 5: Commit**

```bash
git add extension/app.js extension/lib/homepage-controller.js extension/dev/spec-app.js
git commit -m "feat: derive inbox filters and grouped results from active articles" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

### Task 5: Replace the old reading row UI with medium-density result cards

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/style.css`
- Modify: `extension/lib/i18n.js`
- Test: `extension/dev/spec-app-runner.html`

**Step 1: Write the failing UI expectation**

Capture the expected card structure in the dev app harness:

```html
<article class="reading-result-card">
  <h3>Title</h3>
  <div class="reading-result-meta">site · time · reading time</div>
  <div class="reading-result-labels">...</div>
  <p class="reading-result-reason">...</p>
  <div class="reading-result-actions">...</div>
</article>
```

**Step 2: Run the dev app harness to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-app-runner.html
```

Expected: the page still shows the old `reading-item` rows and topic panel styling.

**Step 3: Write the minimal UI changes**

Replace `renderReadingInboxRow()` with card rendering that emphasizes:

- title
- metadata
- labels
- one-line reason
- `Open` as primary action

Update CSS for:

- medium-density cards
- two-column reading layout
- filter rail
- priority section headers
- empty and failed states

**Step 4: Run the dev app harness to verify it passes**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-app-runner.html
```

Expected: the harness shows filter rail plus medium-density cards without any topic-summary surface.

**Step 5: Commit**

```bash
git add extension/app.js extension/style.css extension/lib/i18n.js extension/dev/spec-app-runner.html
git commit -m "feat: render reading inbox as grouped article cards" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

### Task 6: Add lazy reprocessing and degraded-card behavior for old articles

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/lib/jobs-runner.js`
- Modify: `extension/lib/homepage-controller.js`
- Test: `extension/dev/spec-jobs-runner.js`

**Step 1: Write the failing migration-state spec**

Add a spec that expects old articles without the new fields to:

- remain visible
- show a processing or degraded state
- be eligible for reprocessing

Example expectation:

```js
assertEqual(card.state, 'processing');
assertEqual(card.canOpen, true);
assertEqual(card.showRetry, false);
```

**Step 2: Run the spec to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: old records are not recognized as reprocessing candidates.

**Step 3: Write the minimal migration logic**

When an active article lacks `labels`, `priority_bucket`, or `short_reason`:

- render a degraded card immediately
- enqueue reprocessing in the background
- refresh the result set when the article finishes

Do not block queue rendering on metadata regeneration.

**Step 4: Run the spec to verify it passes**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: old articles remain usable while the queue quietly backfills the new metadata model.

**Step 5: Commit**

```bash
git add extension/app.js extension/lib/jobs-runner.js extension/lib/homepage-controller.js extension/dev/spec-jobs-runner.js
git commit -m "feat: backfill old inbox articles without blocking queue use" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

### Task 7: Remove topic-summary dependencies from the active inbox path

**Files:**
- Modify: `extension/app.js`
- Modify: `extension/lib/topic-summary.js`
- Modify: `extension/lib/digest-renderer.js`
- Modify: `extension/lib/topic-engine.js`
- Modify: `extension/lib/topics-repo.js`
- Test: `extension/dev/spec-app.js`

**Step 1: Write the failing regression spec**

Add a regression expectation that the active inbox no longer calls or depends on:

- `buildTopicSummaryViewModel`
- `renderTopicSummaryPanel`
- `matchTopic`

Example expectation:

```js
assertEqual(viewModel.usesTopicSummary, false);
```

**Step 2: Run the spec to verify it fails**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: the active inbox path still references topic-summary modules.

**Step 3: Write the minimal dependency cleanup**

Stop importing or calling topic-summary helpers from the active inbox flow.
Leave topic-related modules in place only if they are still needed for non-inbox storage compatibility, backups, or later cleanup work.

**Step 4: Run the spec to verify it passes**

Run:

```bash
open -a "Google Chrome" /Users/charliec/Projects/my-works/tab-out/extension/dev/spec-runner.html
```

Expected: active inbox rendering no longer depends on topic summary or topic matching logic.

**Step 5: Commit**

```bash
git add extension/app.js extension/lib/topic-summary.js extension/lib/digest-renderer.js extension/lib/topic-engine.js extension/lib/topics-repo.js extension/dev/spec-app.js
git commit -m "refactor: remove topic summary from active inbox path" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```

### Task 8: Verify the real extension flow in a headed persistent browser context

**Files:**
- Modify: `docs/plans/2026-04-20-reading-inbox-redesign-design.md`
- Modify: `docs/plans/2026-04-20-reading-inbox-redesign.md`

**Step 1: Reload the unpacked extension**

Run:

```bash
open -a "Google Chrome" chrome://extensions
```

Expected: the unpacked extension reloads without runtime errors.

**Step 2: Run a headed smoke test using a persistent context**

Run a real extension smoke flow similar to:

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

Manual checks:

- Save a few tabs into `Reading inbox`.
- Confirm the left filter rail populates.
- Confirm the right side groups cards by priority.
- Confirm `Open` returns to the original tab.
- Confirm `Mark read` removes the item from the active queue.
- Confirm older topic summary UI no longer appears anywhere in the active inbox view.

**Step 3: Update plan notes if verification found gaps**

Adjust the design doc or plan doc only if the smoke test revealed missing edge cases.

**Step 4: Commit**

```bash
git add docs/plans/2026-04-20-reading-inbox-redesign-design.md docs/plans/2026-04-20-reading-inbox-redesign.md
git commit -m "docs: capture qa verification for reading inbox redesign" -m "Co-authored-by: OpenAI Codex <codex@openai.com>"
```
