# Tab Out Reading Inbox Design

**Date:** 2026-04-17

**Summary:** Reposition Tab Out from a tab overview extension into an AI-assisted reading inbox. The extension remains a pure Chrome extension, keeps `IndexedDB` as the primary storage layer for captured reading items, and adds a second homepage mode for backlog processing.

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
4. The extension asynchronously captures the article content with `Defuddle`.
5. After capture succeeds, the extension runs article-level AI analysis.
6. The analyzed article is matched into an existing topic or seeds a new topic.
7. The topic digest is created or refreshed.

Important behavior:

- The item is created before capture runs.
- Failed capture does not delete the inbox item.
- Failed AI analysis does not delete captured content.
- Each failed stage can be retried independently.

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
- Articles do not belong to multiple topics.
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
- `read_status`
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
- `read_status`

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

---

## Storage and State

### Primary Storage

- `IndexedDB` is the system of record for reading items, topics, and AI results.

### Extension Settings

- Chrome extension local storage may still be used for lightweight settings and compatibility state, but not as the primary reading database.

### Article Lifecycle

- `active`
- `archived`
- `deleted`

### Action Definitions

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
- Avoid heavy file-system integration
- Avoid provider-specific coupling
- Prefer explicit UI states over hidden background magic

---

## MVP Summary

V1 is successful if the user can:

1. Pin a few stable entry points for daily work.
2. Save an open tab into a durable reading inbox.
3. See capture/analyze progress for each saved item.
4. Get AI-generated topic grouping and reading guidance.
5. Archive or delete processed items without losing control of state.

The product should feel like a browser-native temporary reading workspace, not a bookmark manager and not a full note-taking system.
