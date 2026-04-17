# Tab Out Reading Inbox Design

**Date:** 2026-04-17

**Summary:** Reposition Tab Out from a tab overview extension into a browser-native decision layer for tab debt. The extension remains a pure Chrome extension, introduces `IndexedDB` as the primary storage layer for captured reading items, and adds a second homepage mode for backlog processing.

**Implementation Snapshot:** Phase 1 now includes the `Now / Reading inbox` shell, `Pinned v1`, IndexedDB-backed article records, an article-scoped background pipeline (`capture -> analyze -> assign`), a lightweight topic summary panel, and an in-page settings/debug drawer for one OpenAI-compatible provider.

---

## Product Positioning

Tab Out is no longer only a dashboard for currently open tabs. It becomes a lightweight browser-native reading inbox with two clear jobs:

1. Prevent important reading tabs from being lost.
2. Reduce reading backlog with AI-assisted clustering, deduplication, and reading guidance.

The extension is **not** the user’s permanent knowledge base. It is a temporary processing layer before the user moves selected content into Obsidian or another notes tool.
Its deeper role is to act as a **browser decision layer**: decide what stays in `Now`, what gets pinned, and what moves into `Reading inbox`.

---

## Product Principles

- Manual-first capture. Only explicit user actions add content to the reading inbox.
- Temporary, not archival. The extension stores captured content for processing, not lifelong organization.
- AI should reduce reading work, not generate decorative summaries.
- Topic grouping should be stable and explainable.
- The UI should keep “current work” and “reading backlog” separate.
- The extension should stay lightweight in scope even when using external AI models.
- UI styling should follow the installed `DESIGN.md` system as the source of truth for visual direction.

---

## What Already Exists

Existing UI patterns and product instincts that this plan should reuse instead of reinventing:

- The new-tab page already behaves like a lightweight workbench rather than a generic marketing surface
- Open tabs are already grouped and action-oriented, which is the right foundation for `Now`
- Section headers with lightweight counts already exist and should evolve, not disappear
- The current right-side `Saved for later` column proves that a secondary backlog surface belongs in this product, even though its old checklist treatment should be replaced
- The current chip-style per-tab actions are a strong fit for `Open now` and should survive the redesign

---

## Scope Decisions

### Included in V1

- Dual homepage modes: `Now` and `Reading inbox`
- `Pinned` single-entry shortcuts with manual management
- Manual `Save for later` capture from `Open now`
- Same-URL dedupe on save, with `last_saved_at` refresh on the existing record
- `IndexedDB` as primary storage for captured articles and topics
- `Defuddle-only` content capture into Markdown
- OpenAI-compatible AI settings:
  - `base_url`
  - `api_key`
  - `model_id`
- Article-level AI analysis
- Topic creation, topic assignment, and topic digest generation
- Threshold-based backlog nudges for active inbox load
- Stronger `Save for later` affordance on article-like tabs inside `Now`
- Lightweight debug view inside Settings for jobs and error states
- Inbox actions:
  - `Mark as read`
  - `Archive`
  - `Delete`
  - `Retry`

### Explicitly Out of Scope for V1

- Auto-save based on dwell time or passive browsing
- File-system-first storage
- Markdown export
- Local image download
- PDF capture/download
- Cloud sync
- Post-capture close / auto-close
- Near-duplicate hint on save
- Keyboard triage shortcuts
- Topic manual editing tools
- Pinned groups
- Action-based pinned entries
- Full-library reclustering
- Advanced search and filtering

### Design Decisions Explicitly Not in Scope

- Turning `Reading inbox` into a long-form reading surface or second article reader
- Equal-weight dual-column layouts on narrow viewports
- Dashboard-tile treatment for `Pinned`
- A separate options page for V1 settings and debug flows
- Heavy visual chrome or developer-console styling for the debug surface

---

## Homepage Structure

The homepage exposes both modes through a single top-level mode switcher. The `Reading inbox` entry in the switcher shows a live count of active (unread, non-archived) items — e.g. `Reading inbox (12)` — so users who are working in `Now` still notice when their backlog grows. The badge updates as items are saved, read, archived, or deleted.

Information hierarchy by mode:

- `Now`
  - First: `Pinned`, the stable launch points for daily work
  - Second: `Open now`, the current grouped tab workspace
  - Third: secondary controls such as Settings
- `Reading inbox`
  - First: left-side inbox queue, ordered by recently saved items
  - Second: right-side topic digest, which summarizes the current backlog at the topic level
  - Third: Settings / debug surfaces

### Mode 1: Now

`Now` is for immediate action and current context.
Emotionally, it should feel like an active workbench: slightly denser, more operational, and optimized for quick scanning plus immediate tab actions.

#### Pinned

- Single-entry shortcuts only
- Fully manual management
- Visually, `Pinned` should read like a restrained shortcut strip under an editorial header, not like a grid of feature cards or dashboard tiles
- Actions:
  - Pin current tab from `Open now`
  - Edit pinned title and URL
  - Remove
  - Drag to reorder

#### Open now

- Preserves existing grouped tab view
- Existing actions remain available where relevant
- Adds:
  - `Save for later`
  - `Pin`
- `Save for later` should be visually stronger on article-like pages and quieter on homepages, dashboards, and tool surfaces
- In phase 1 this is presentation-only. It changes prominence, not semantics: the action label, meaning, and save flow remain identical across page types.
- `Pin` remains the quieter/stabler shortcut action. On article-like tabs, `Save for later` gets slightly higher visual priority than `Pin`; on obvious tool or homepage surfaces, `Pin` can remain the calmer default-looking secondary action.
- On unsupported pages, `Save for later` is disabled with a clear explanation instead of failing after click

### Mode 2: Reading inbox

`Reading inbox` is for backlog processing.
Emotionally, it should feel like a quieter processing room: calmer, more editorial, and more reflective than `Now`, but still clearly part of the same workflow rather than a separate reading product.
Within this mode, the left queue is the visual primary. The right digest is a calmer interpretation layer, not an equal-weight second list.

For the first successful save in a fresh install or profile, the product should provide a lightweight onboarding moment:

- confirm that the save worked
- explain that the item now lives in `Reading inbox`
- offer a gentle action to view `Reading inbox`, without forcing an automatic mode switch

#### Left panel: Saved for later

- Roughly the same width as the current deferred column
- Default sort: `recently saved`
- Each item is a queue entry, not a bookmark row
- Each row shows:
  - Title
  - Site name
  - Saved time
  - Processing state
  - Main topic label
- Recommended action
- Supported actions:
  - Open source
  - Mark as read
  - Archive
  - Delete
  - Retry
- Default queue view shows only `lifecycle_state = active` items
- `read` items leave the default backlog view and are only visible through an explicit secondary status view/filter
- That secondary view should be a minimal `Active / Read` toggle placed at the top of the left queue, not a separate global mode
- `archived` items remain out of the default queue in phase 1 and do not get a dedicated UI entry yet; they are preserved in data but intentionally hidden until a later filtering/archive pass exists
- Failure states must be visibly distinct at the row level:
  - `capture failed`: explain that the extension could not extract readable article content
  - `analysis failed`: explain that content was saved, but topic / summary generation did not complete
  - both states expose `Retry`, but their messaging should differ so users understand whether they lost content or only lost AI guidance
- Empty state should be a guided first-run surface, not a blank list:
  - warm explanation of what `Reading inbox` is for
  - one primary action that sends the user back to `Now` to save a first article
  - one short line explaining that saved items will later be grouped into topics and reading guidance

#### Right panel: Topic Digest

- Wider than the left panel
- Shows topic-level guidance rather than article details
- Default view shows a **global topic overview** when no specific inbox item is selected
- Selecting an inbox item highlights its topic placement inside the digest
- Remains a **light decision panel**, not a second reading surface
- In phase 1, this panel is derived on demand from topic metadata plus analyzed articles. It is not a separately persisted digest artifact.
- The derivation logic should live in a dedicated topic-summary service / renderer layer. The homepage controller consumes that view-model; it should not assemble topic guidance inline.
- When the inbox is empty, the right panel should reinforce the left-panel empty state instead of rendering a dead placeholder
- When articles exist but topic guidance is not ready yet, the right panel should show an explicit **partial state**:
  - confirm that the article was saved successfully
  - explain that topic guidance is still being prepared
  - keep the panel visually alive with lightweight skeletons or the most recent stable topic context, rather than going blank

#### Settings / Debug

- The homepage Settings drawer contains:
  - AI provider settings
  - Connection state
  - `Test connection` should perform a minimal model call, not just an endpoint reachability check, so `Ready` means the configured `base_url + api_key + model_id` can actually execute a request
  - A failed connection state should degrade only the AI layer. Save/capture remain available; only AI analysis and topic assignment are blocked until configuration is fixed.
  - A lightweight debug surface for recent jobs, last error reason, current AI host, and retry actions
  - In V1, these jobs are article-scoped pipeline records rather than a generic multi-job queue, so the surface should primarily list recent articles with their current pipeline stage, last error reason, current AI host, and retry actions
- This lives in a right-side drawer opened from the header, not a modal and not a separate options page

---

## Capture Workflow

Capture is entirely manual in V1.

1. User opens `Now`.
2. User clicks `Save for later` on a tab inside `Open now`.
3. The extension checks whether the tab already maps to an existing saved article by `canonical_url` or normalized URL.
4. If a strict duplicate already exists, the extension shows `Already saved`, updates `last_saved_at`, and does not create a second article record.
5. On that same-URL dedupe path:
   - if the existing article is already fully usable (`processing_state = assigned`), the system only refreshes the timestamp
   - if the existing article is still incomplete or failed (`queued`, `capturing`, `captured`, `analyzing`, `analyzed`, `assigning`, `capture_failed`, `analysis_failed`, or `assignment_failed`), the system re-queues or retries the existing pipeline job rather than creating a new article
6. Otherwise the extension immediately creates a local inbox record.
7. The background jobs layer asynchronously captures the article content with `Defuddle` via a content script injected into the source tab.
8. The source tab stays open while capture is running. After capture succeeds, the UI may offer a close action or leave the tab for the user to close manually.
9. After capture succeeds, the background jobs layer runs article-level AI analysis when a valid provider is configured.
10. If analysis succeeds, the analyzed article is matched into an existing topic or seeds a new topic.
11. If AI is unavailable or analysis has not completed yet, the article remains unassigned and the UI shows a processing-aware fallback instead of forcing a fake topic.

The `Reading inbox (N)` badge in the mode switcher counts only articles with `lifecycle_state = active`. `read`, `archived`, and `deleted` items do not contribute to the backlog count, regardless of their processing state.

### Capture Execution Environment

- V1 runs `Defuddle` exclusively inside a content script injected into the source tab, so capture works against the real rendered DOM.
- Because capture depends on the live source-tab DOM, `Save for later` does not auto-close the tab at click time.
- Before injection, the extension checks `tab.discarded`. If the tab is discarded, the extension calls `chrome.tabs.reload` and waits for `status === 'complete'` before injecting.
- Pages that Chrome forbids content-script injection on (e.g. `chrome://`, the Chrome Web Store, `file://` unless enabled, the extension's own pages) are unsupported. On those pages the `Save for later` action is disabled with a tooltip explaining why.
- An `offscreen document` capture path is intentionally deferred to a future release. V1 prefers a clean failure with `Retry` over a second low-fidelity fallback that silently produces bad content.
- The background/service-worker jobs layer owns the end-to-end `capture -> analyze -> topic refresh` pipeline. The new-tab UI only enqueues work and renders state.

### Failure and Recovery

- The inbox item is created before capture runs.
- Failed capture does not delete the inbox item.
- Failed AI analysis does not delete captured content.
- Each failed stage can be retried independently via `Retry`.
- For `analysis_failed` and `assignment_failed`, `Retry` is still allowed even when the user has not opened Settings first. However, the system should do a fast local preflight of the current AI configuration. If the configuration is obviously missing or invalid, the retry should fail immediately and point the user back to Settings instead of making a doomed network request.
- Because the jobs runner lives inside a Manifest V3 service worker, any job can be interrupted if Chrome terminates the worker. On every extension startup and every worker wakeup, the jobs runner scans for jobs stuck in `capturing`, `analyzing`, or `assigning` beyond a timeout threshold and rolls them back to the last stable checkpoint so they can be retried automatically:
  - `capturing` → `queued`
  - `analyzing` → `captured`
  - `assigning` → `analyzed`
- Missing or broken AI provider settings do not block save/capture. The article can remain in a captured-but-unanalyzed, unassigned state until configuration is fixed and analysis is retried.
- Capture only auto-retries for transient failures such as reload races or temporary runtime messaging issues. Unsupported pages and hard parse failures surface as explicit failed states.
- If the source tab closes during capture, the pipeline continues only when a usable payload has already reached the background layer. Otherwise the capture fails with a retryable source-closed reason.

### Throughput Control

- The jobs runner enforces a small concurrency cap (`concurrency = 2` in V1) so that saving many tabs at once does not fan out into a burst of AI requests.
- Failed network calls to the AI provider use a simple exponential backoff before being marked `capture_failed` or `analysis_failed`, reducing 429/5xx storms against self-hosted OpenAI-compatible endpoints.

---

## Interaction State Coverage

| Feature | Loading | Empty | Error | Success | Partial |
|--------|---------|-------|-------|---------|---------|
| `Now > Open now` | Existing tab groups render progressively without blocking the rest of the page | If no tabs match a section, show a calm no-tabs state instead of a collapsed blank gap | If tab queries fail, surface a compact operational error instead of breaking the page shell | Grouped tabs and actions are immediately available | N/A |
| `Reading inbox` queue | Show rows/skeletons with clear processing labels while article records are loading | Guided first-run state with explanation, primary action back to `Now`, and one line explaining future topic grouping | Distinguish `capture failed` vs `analysis failed` at the row level, both with `Retry` | Rows show title, source, state, topic label, and recommended action | Rows may be available before digest guidance is ready |
| `Topic Digest` panel | Use light skeletons or warm loading placeholders rather than going blank | Reinforce the queue empty state instead of rendering a dead placeholder | Explain that topic guidance could not be prepared, while preserving any stable queue state | Show global topic overview by default, then selected-topic guidance after row selection | Explicitly state that content is saved and topic guidance is still being prepared; if AI is unavailable, explain that the article is saved but still unassigned |
| `Settings / Debug` drawer | Drawer opens immediately, then hydrates connection/debug details without freezing the page | Show helpful setup language if no AI provider is configured and no jobs exist yet | Show connection failures, invalid endpoint messaging, or last job error in plain language | Settings persist and debug rows reflect current system state | Connection may be ready while some jobs still show degraded states |

---

## User Journey & Emotional Arc

| Step | User Does | User Feels | Plan Specifies? |
|-----|------------|------------|-----------------|
| 1 | Opens a new tab into `Now` | Oriented, ready to act | Yes, `Now` is the operational workbench |
| 2 | Scans `Pinned` and `Open now` | In control of current work | Yes, `Pinned` is quiet and `Open now` remains primary |
| 3 | Saves a tab for later | Relief, if the save feels trustworthy | Yes, save is immediate and source tab stays open for correctness |
| 4 | Sees first successful save guidance | Curious, understands a new mode exists | Yes, a lightweight first-save onboarding moment is required |
| 5 | Enters `Reading inbox` | Calmer, ready to process backlog instead of juggling tabs | Yes, this mode is intentionally quieter and more editorial |
| 6 | Selects rows and reviews topic guidance | Better informed, less overwhelmed | Yes, left queue is primary and right digest is an interpretation layer |
| 7 | Marks items read, archives, deletes, retries | Confident that backlog is moving and state is under control | Yes, lifecycle states and retry/error language are explicit |

---

## Topic Model

### What a Topic Is

A topic is a **dynamic reading theme container** created from saved articles. It is not a static folder, and it is not a manual tag.

Each topic contains:

- Stable `title`
- `one_line_digest`
- `reading_question`
- `article_count`
- `key_articles`
- `overlap_groups`
- `suggested_reading_path`
- `related_topics`
- `last_updated`

### How Topics Are Created

Topics are created from seed articles.

1. A captured article is analyzed.
2. The system checks whether it clearly fits an existing topic.
3. If no strong match exists, a new topic is created from that article’s AI analysis.
4. Later articles can extend and refine the topic digest.

### Topic Assignment Rules

- Every article has exactly one `main_topic_id`.
- Every article may also carry `sub_angles`.
- Articles do not belong to multiple topics in V1.
- Cross-topic relationships are expressed through `related_topics`, not multi-membership.

### Duplicate Model

Two duplicate classes are tracked:

- `strict duplicate`
  - Same canonical URL or exact equivalent
- `overlap`
  - Different URL, highly similar content

Strict duplicates should not create new reading work. Overlap groups should help the user skip repetitive reading.

---

## Article Data Model

### Raw Capture Layer

- `id`
- `source_type`
- `source_ref`
- `url`
- `canonical_url`
- `title`
- `site_name`
- `author`
- `published_at`
- `saved_at`
- `last_saved_at`
- `markdown_content`
- `excerpt`
- `lead_image_url`
- `word_count`
- `language`

### Article Analysis Layer

- `summary_short`
- `main_topic_id`
- `main_topic_label`
- `sub_angles`
- `keywords`
- `reading_time_estimate`
- `content_type`
- `novelty_score`
- `actionability_score`
- `duplicate_candidates`

### Reading Decision Layer

- `recommended_action`
- `why_recommended`
- `best_reason_to_read`
- `best_reason_to_skip`

### Lifecycle Layer

- `lifecycle_state`
- `last_opened_at`

`lifecycle_state` is the user-facing disposition of the item:

- `active`
- `read`
- `archived`
- `deleted`

### Processing Layer

- `processing_state`
- `last_analyzed_at`

`processing_state` is owned by the background pipeline and tracks system progress independently from the user lifecycle:

- `queued`
- `capturing`
- `captured`
- `analyzing`
- `analyzed`
- `assigning`
- `assigned`
- `capture_failed`
- `analysis_failed`
- `assignment_failed`

Within the single pipeline job, article analysis and topic assignment should run as consecutive stages rather than one opaque step. In other words, phase 1 should be able to distinguish "the AI analysis completed" from "the article has actually been assigned into a topic" even though both still belong to the same article-scoped job.

For V1, the minimum UI-driving set is:

- `title`
- `site_name`
- `saved_at`
- `processing_state`
- `summary_short`
- `main_topic_label`
- `recommended_action`
- `lifecycle_state`

When AI is unavailable or analysis has not completed yet, `main_topic_id` and `main_topic_label` may be `null` in V1. The UI should treat this as an explicit "unassigned / awaiting analysis" state, not as corrupted data.

---

## Topic Digest Requirements

The digest must help the user decide what to read, not just summarize a topic.

Each digest should include:

- `title`
- `one_line_digest`
- `best_articles_to_read`
- `skippable_or_overlapping_articles`
- `suggested_reading_path`

Secondary fields that may appear when available:

- `why_it_matters`
- `key_differences`
- `related_topics`

In phase 1, these fields are rendered from stable topic metadata and the currently analyzed article set. They are not independently persisted or refreshed by a standalone digest job.
That derivation belongs in a dedicated service/renderer layer rather than inside repositories or homepage UI orchestration code.

---

## AI Provider Model

V1 supports one configuration type only:

- OpenAI-compatible API

Required fields:

- `base_url`
- `api_key`
- `model_id`

This single configured model is used for:

- Article analysis
- Topic decision/matching
- Topic digest generation

The configuration UI lives inside the main extension homepage, not a separate options page.

`base_url` may point to any OpenAI-compatible **`https://`** endpoint. Plain `http://` endpoints are out of scope for V1.

### Credential Storage and Handling

- The API key is persisted in `chrome.storage.local` in plaintext. Browser extensions have no truly secure at-rest storage — any encryption scheme ultimately needs the key in memory to issue requests, and all scripts inside the extension share that memory.
- The settings UI shows a clear notice next to the API key field: **"Stored in plaintext inside your browser profile. Do not use on shared machines."**
- The settings UI also shows a clear data-egress notice: **"Captured article content will be sent to the configured AI host for analysis."**
- Architecturally, the API key is only read by the background/jobs layer that issues AI requests. No content script ever receives or touches the key. This keeps the key out of the page context even if the extension later adds content scripts for capture or enrichment.
- A future release may offer an optional "lock" mode that encrypts the key with a WebCrypto-derived key held only in `chrome.storage.session`, unlocked by a user password on each session.

---

## Storage and State

### Primary Storage

- `IndexedDB` is the system of record for reading items, topics, and AI results.
- V1 starts clean in `IndexedDB`; legacy `chrome.storage.local.deferred` data is not migrated.

### Extension Settings

- Chrome extension local storage may still be used for lightweight settings and compatibility state, but not as the primary reading database.

### Article Lifecycle

- `active`
- `read`
- `archived`
- `deleted`

`read` and `archived` are both terminal for active-inbox purposes but semantically distinct. `read` means the user finished reading and chose to keep the record; `archived` means the user decided to skip or defer it without reading.
There is no separate `read_status` field in V1, the lifecycle state is the single source of truth.

### Processing Lifecycle

- `queued`
- `capturing`
- `captured`
- `analyzing`
- `analyzed`
- `assigning`
- `assigned`
- `capture_failed`
- `analysis_failed`
- `assignment_failed`

The article stores `lifecycle_state` and `processing_state` as two separate fields. User actions such as `Mark as read`, `Archive`, and `Delete` only mutate `lifecycle_state`. Background jobs such as capture, analysis, topic assignment, retry, and stuck-job rollback only mutate `processing_state`.
V1 also keeps a single pipeline job record per article. That job advances the article through capture, analysis, topic assignment, retry, and rollback. The system does not yet model multiple independent jobs per article.

### Action Definitions

#### Mark as read

- Moves an item from `active` to `read`
- Retains captured content, AI analysis, and topic membership
- Continues to count toward topic digests
- Leaves the default active backlog view and is only shown in an explicit read-status view/filter

#### Archive

- Removes an item from active inbox flow
- Retains captured content and AI analysis
- Keeps topic membership
- In phase 1 it does not create a visible archive browser; the item is preserved in data but hidden from the default queue and the `Active / Read` toggle

#### Delete

- Removes article content and analysis
- Removes the article from its topic
- Deletes the topic if it becomes empty
- Otherwise causes lightweight topic guidance to be re-derived from the remaining topic/article state
- In phase 1, delete is intentionally destructive and does not offer an undo flow; `Archive` is the non-destructive alternative
- Because there is no undo, phase 1 should require a lightweight confirmation before delete executes
- That confirmation should be inline or adjacent to the row action itself (for example `Delete? / Cancel`), not a central modal or browser-native blocking dialog

#### Retry

- Does not create a new item
- Resets the article to the last stable checkpoint for the failed stage, then re-runs the pipeline from there
- Uses the same checkpoint model as stuck-job recovery:
  - `capture_failed` → retry from `queued`
  - `analysis_failed` → retry from `captured`
  - `assignment_failed` → retry from `analyzed`
- For AI-dependent retries, the system may immediately bounce back to a failed state if local configuration preflight shows the current provider setup is missing or invalid; the row/debug surface should then direct the user to Settings

---

## V1 Technical Direction

- Keep the extension architecture simple and browser-native
- Introduce a small modular structure around:
  - homepage controller / UI state
  - storage repositories
  - capture orchestration
  - AI client
  - topic and digest engines
- `app.js` should shrink into a bootstrap entrypoint, not become the owner of new inbox logic
- Repository modules stay persistence-only. Pure business logic such as topic matching, AI response parsing, lifecycle state transitions, and digest generation lives in engine/service modules.
- Follow `DESIGN.md` for typography, color, elevation, and interaction styling whenever UI is added or revised
- Run Defuddle capture inside a content script injected into the source tab; never pull DOM into the service worker directly
- Do not auto-close the source tab at save time, capture must finish first because the live DOM is the capture source
- The jobs runner enforces `concurrency = 2` and uses exponential backoff on AI provider failures (429/5xx) before surfacing a retryable error to the user
- On every service worker startup, roll back jobs stuck in `capturing`, `analyzing`, or `assigning` to their last stable checkpoint rather than forcing the whole article back to `queued`
- In phase 1, lightweight topic guidance is derived at render time after article analysis and topic assignment, rather than refreshed by a standalone digest job
- Avoid heavy file-system integration
- Avoid provider-specific coupling
- Prefer explicit UI states over hidden background magic

### DESIGN.md Page-Level Mapping

- `Now`
  - Should feel like an active workbench on the warm paper system, using the editorial typography and calm warm surfaces from `DESIGN.md` without turning into a dashboard-card mosaic
  - `Pinned` should stay low-chrome and typographic, closer to a shortcut strip than a tile grid
  - `Open now` carries the densest information and the strongest operational affordances
- `Reading inbox`
  - Should lean more heavily into the editorial side of `DESIGN.md`: calmer spacing, clearer breathing room, and more visible text hierarchy
  - The left queue remains the visual anchor; the right digest reads like a warm editorial sidebar or margin note rather than a second workspace
  - Topic guidance should rely on hierarchy, typography, and restrained surfaces, not colorful cards or dashboard widgets
- `Settings / Debug`
  - Should inherit the same warm neutral surfaces and typography, but remain visually subordinate to the core product areas
  - Debug affordances should feel operational and minimal, not like a developer console bolted onto the page

### Responsive and Accessibility Intent

- `Reading inbox`
  - On narrower viewports or constrained extension widths, the layout should stop being two simultaneous columns
  - The queue stays primary, while the digest becomes a secondary view reached by selection or an explicit toggle
  - Avoid a naive stacked layout that turns the mode into a long scrolling document
- Keyboard and accessibility basics
  - All primary actions remain reachable without a mouse
  - Keyboard focus order should follow the visual hierarchy: mode switcher → primary content area → secondary panel → settings/debug surfaces
  - In narrow `Reading inbox` layouts, the queue/digest switch, row selection, retry/action controls, and Settings trigger must all be reachable and understandable from keyboard-only navigation
  - Section landmarks and labels should make `Now`, `Reading inbox`, and `Settings` distinguishable to assistive technology
  - Touch targets should stay comfortably tappable even when the extension is rendered in a narrow viewport

---

## Future Enhancements

Items intentionally deferred from V1, listed so later design rounds can pick them up without rediscovery:

- **Two-stage topic matching.** Use an embedding or keyword pre-filter to narrow candidate topics before sending the article to the LLM for topic selection. V1 accepts the naive "compare against all recent topics" cost; this is the first thing to optimize once topic count grows.
- **Markdown / clipboard export.** A lightweight "Copy as Markdown" action per article, and eventually a multi-article export, so users can move selected content into Obsidian. Without this, users risk treating Tab Out as a permanent library, which contradicts the product positioning.
- **Offscreen document as capture fallback.** Adds a secondary capture path for tabs the content script cannot reach (e.g. user closed the tab mid-save, renderer crashed). V1 deliberately ships without it to avoid dual-path complexity and the risk of low-fidelity fetch-based captures sneaking through.
- **Multi-topic membership.** Letting one article belong to multiple topics is intentionally deferred. V1 keeps a single stable topic per article to preserve digest clarity and reduce lifecycle complexity.
- **Pinned groups.** Multi-entry pinned collections (e.g. "Daily standup links") layered on top of V1's single-entry shortcuts.
- **Credential lock mode.** Optional WebCrypto-based encryption of the API key using a user-supplied master password, with the derived key held in `chrome.storage.session` so it clears on browser restart.
- **Full-library reclustering.** A manual "re-run topic matching across all articles" action for after large model or prompt changes.
- **Advanced search and filtering.** Structured filters over topic, content type, read state, and free-text search across captured Markdown.

---

## MVP Summary

V1 is successful if the user can:

1. Pin a few stable entry points for daily work.
2. Save an open tab into a durable reading inbox.
3. See capture/analyze progress for each saved item.
4. Get AI-generated topic grouping and reading guidance.
5. Archive or delete processed items without losing control of state.

The product should feel like a browser-native temporary reading workspace, not a bookmark manager and not a full note-taking system.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 9 proposals reviewed, 4 accepted, 3 deferred, 2 skipped |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | architecture locked around article-scoped pipeline jobs, checkpoint retry/rollback, lightweight derived topic summaries, and graceful AI degradation |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 6/10 → 9/10, 12 design decisions added |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0

**VERDICT:** CEO + DESIGN CLEARED — run `/plan-eng-review` before implementation.
