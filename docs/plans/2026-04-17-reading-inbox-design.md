# Tab Out Reading Inbox Design

**Date:** 2026-04-17

**Summary:** Reposition Tab Out from a tab overview extension into an AI-assisted reading inbox. The extension remains a pure Chrome extension, introduces `IndexedDB` as the primary storage layer for captured reading items, and adds a second homepage mode for backlog processing.

---

## Product Positioning

Tab Out is no longer only a dashboard for currently open tabs. It becomes a lightweight browser-native reading inbox with two clear jobs:

1. Prevent important reading tabs from being lost.
2. Reduce reading backlog with AI-assisted clustering, deduplication, and reading guidance.

The extension is **not** the user’s permanent knowledge base. It is a temporary processing layer before the user moves selected content into Obsidian or another notes tool.

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

## Scope Decisions

### Included in V1

- Dual homepage modes: `Now` and `Reading inbox`
- `Pinned` single-entry shortcuts with manual management
- Manual `Save for later` capture from `Open now`
- `IndexedDB` as primary storage for captured articles and topics
- `Defuddle-only` content capture into Markdown
- OpenAI-compatible AI settings:
  - `base_url`
  - `api_key`
  - `model_id`
- Article-level AI analysis
- Topic creation, topic assignment, and topic digest generation
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
- Topic manual editing tools
- Pinned groups
- Action-based pinned entries
- Full-library reclustering
- Advanced search and filtering

---

## Homepage Structure

The homepage exposes both modes through a single top-level mode switcher. The `Reading inbox` entry in the switcher shows a live count of active (unread, non-archived) items — e.g. `Reading inbox (12)` — so users who are working in `Now` still notice when their backlog grows. The badge updates as items are saved, read, archived, or deleted.

### Mode 1: Now

`Now` is for immediate action and current context.

#### Pinned

- Single-entry shortcuts only
- Fully manual management
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

### Mode 2: Reading inbox

`Reading inbox` is for backlog processing.

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

#### Right panel: Topic Digest

- Wider than the left panel
- Shows topic-level guidance rather than article details
- Default view shows topic-level understanding
- Selecting an inbox item highlights its topic placement inside the digest

---

## Capture Workflow

Capture is entirely manual in V1.

1. User opens `Now`.
2. User clicks `Save for later` on a tab inside `Open now`.
3. The extension immediately creates a local inbox record.
4. The extension asynchronously captures the article content with `Defuddle` via a content script injected into the source tab.
5. The source tab stays open while capture is running. After capture succeeds, the UI may offer a close action or leave the tab for the user to close manually.
6. After capture succeeds, the extension runs article-level AI analysis.
7. The analyzed article is matched into an existing topic or seeds a new topic.
8. The topic digest is created or refreshed.

### Capture Execution Environment

- V1 runs `Defuddle` exclusively inside a content script injected into the source tab, so capture works against the real rendered DOM.
- Because capture depends on the live source-tab DOM, `Save for later` does not auto-close the tab at click time.
- Before injection, the extension checks `tab.discarded`. If the tab is discarded, the extension calls `chrome.tabs.reload` and waits for `status === 'complete'` before injecting.
- Pages that Chrome forbids content-script injection on (e.g. `chrome://`, the Chrome Web Store, `file://` unless enabled, the extension's own pages) are unsupported. On those pages the `Save for later` action is disabled with a tooltip explaining why.
- An `offscreen document` capture path is intentionally deferred to a future release. V1 prefers a clean failure with `Retry` over a second low-fidelity fallback that silently produces bad content.

### Failure and Recovery

- The inbox item is created before capture runs.
- Failed capture does not delete the inbox item.
- Failed AI analysis does not delete captured content.
- Each failed stage can be retried independently via `Retry`.
- Because the jobs runner lives inside a Manifest V3 service worker, any job can be interrupted if Chrome terminates the worker. On every extension startup and every worker wakeup, the jobs runner scans for jobs stuck in `capturing` or `analyzing` beyond a timeout threshold and rolls them back to `queued` so they can be retried automatically.

### Throughput Control

- The jobs runner enforces a small concurrency cap (`concurrency = 2` in V1) so that saving many tabs at once does not fan out into a burst of AI requests.
- Failed network calls to the AI provider use a simple exponential backoff before being marked `capture_failed` or `analyze_failed`, reducing 429/5xx storms against self-hosted OpenAI-compatible endpoints.

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
- `url`
- `canonical_url`
- `title`
- `site_name`
- `author`
- `published_at`
- `saved_at`
- `markdown_content`
- `excerpt`
- `lead_image_url`
- `word_count`
- `language`
- `capture_status`

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

- `inbox_status`
- `last_analyzed_at`
- `last_opened_at`

For V1, the minimum UI-driving set is:

- `title`
- `site_name`
- `saved_at`
- `capture_status`
- `summary_short`
- `main_topic_label`
- `recommended_action`
- `inbox_status`

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

### Credential Storage and Handling

- The API key is persisted in `chrome.storage.local` in plaintext. Browser extensions have no truly secure at-rest storage — any encryption scheme ultimately needs the key in memory to issue requests, and all scripts inside the extension share that memory.
- The settings UI shows a clear notice next to the API key field: **"Stored in plaintext inside your browser profile. Do not use on shared machines."**
- Architecturally, the API key is only read by the background/jobs layer that issues AI requests. No content script ever receives or touches the key. This keeps the key out of the page context even if the extension later adds content scripts for capture or enrichment.
- A future release may offer an optional "lock" mode that encrypts the key with a WebCrypto-derived key held only in `chrome.storage.session`, unlocked by a user password on each session.

---

## Storage and State

### Primary Storage

- `IndexedDB` is the system of record for reading items, topics, and AI results.

### Extension Settings

- Chrome extension local storage may still be used for lightweight settings and compatibility state, but not as the primary reading database.

### Article Lifecycle

- `active`
- `read`
- `archived`
- `deleted`

`read` and `archived` are both terminal for active-inbox purposes but semantically distinct. `read` means the user finished reading and chose to keep the record; `archived` means the user decided to skip or defer it without reading.
There is no separate `read_status` field in V1, the lifecycle state is the single source of truth.

### Action Definitions

#### Mark as read

- Moves an item from `active` to `read`
- Retains captured content, AI analysis, and topic membership
- Continues to count toward topic digests but is visually de-emphasized in the inbox

#### Archive

- Removes an item from active inbox flow
- Retains captured content and AI analysis
- Keeps topic membership

#### Delete

- Removes article content and analysis
- Removes the article from its topic
- Deletes the topic if it becomes empty
- Otherwise triggers a digest refresh

#### Retry

- Re-runs the failed capture or analysis stage without recreating the item

---

## V1 Technical Direction

- Keep the extension architecture simple and browser-native
- Introduce a small modular structure around:
  - storage
  - capture
  - AI client
  - topic engine
- Follow `DESIGN.md` for typography, color, elevation, and interaction styling whenever UI is added or revised
- Run Defuddle capture inside a content script injected into the source tab; never pull DOM into the service worker directly
- Do not auto-close the source tab at save time, capture must finish first because the live DOM is the capture source
- The jobs runner enforces `concurrency = 2` and uses exponential backoff on AI provider failures (429/5xx) before surfacing a retryable error to the user
- On every service worker startup, roll back jobs stuck in `capturing` or `analyzing` beyond a timeout to `queued`
- Avoid heavy file-system integration
- Avoid provider-specific coupling
- Prefer explicit UI states over hidden background magic

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
