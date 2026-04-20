# Tab Out Reading Inbox Redesign

**Date:** 2026-04-20

**Status:** Approved design

**Summary:** Redesign `Reading inbox` from a topic-summary surface into a filter-first active reading queue. The page should help users narrow a backlog of saved tabs, reopen the right article quickly, and use lightweight labels for recall instead of detailed topic digests.

**Supersedes:** This design replaces the topic-first inbox model described in `docs/plans/2026-04-17-reading-inbox-design.md`.

---

## Product Positioning

`Reading inbox` is not a miniature reader, a knowledge base, or a topic explanation surface.
It is the browser-native place where users temporarily park pages they need to read later and then return to those pages with less friction.

The page has one primary job:

1. Help users narrow the active backlog quickly.
2. Help users reopen the right article quickly.

Labels exist to improve recall and filtering.
They do not exist to create an AI-generated summary experience.

---

## Product Principles

- Queue-first, not library-first.
- Filters should reduce decision time, not add conceptual overhead.
- The right side should show actionable article results, not topic explanation.
- AI should produce lightweight metadata that improves triage.
- If AI fails, the queue still works.
- `Read` and `Archived` should not dilute the `Active` inbox mental model.
- Phase 1 should stay intentionally narrow: filtering, ranking, and reopen actions.

---

## Core Decisions

### 1. Information Architecture

The page uses a two-column layout:

- Left: `Filters`
- Right: `Results`

The visual weight belongs to the right side.
The left side is a control rail, not a content rail.

### 2. Lifecycle Scope

Phase 1 defaults to `Active` items only.
`Read` and `Archived` remain separate views or later extensions, not part of the main active queue.

### 3. Result Priority

Default sorting is mixed:

- First by `priority_bucket`
- Then by `last_saved_at`

The active queue should feel like an inbox, but important items should not sink below newer noise.

### 4. Primary Action

The primary card action is `Open`.
The page exists to get users back into the saved page quickly.
`Mark read`, `Archive`, and `Delete` remain secondary actions.

### 5. Labels

Phase 1 uses system-generated labels only.
Users can view and filter by labels, but they cannot edit them yet.

### 6. Data Direction

Phase 1 is a hard replacement of the topic-first model:

- Keep old article records.
- Do not preserve or surface old topic summaries.
- Recompute article metadata for the new model.
- Stop treating topics as a first-class front-end concept.

---

## User Experience

### Left Column: Filters

The filter rail should stay compact and stable.
It should not expand into article detail, debug data, or long-form explanations.

Recommended sections:

- `Search`
  - Title and domain text search
- `Labels`
  - Multi-select chips or checkboxes
- `Source`
  - Domain or site filters
- `Time`
  - Today
  - Last 3 days
  - Last 7 days
  - Older
- `Status`
  - Ready
  - Processing
  - Failed
  - Unopened
  - Opened
- `Sort`
  - Default: priority first, recent second

Only filters with real matches in the current active dataset should be shown as selectable.

### Right Column: Results

The right side is a result list, not a detail view.

Recommended hierarchy:

- Result bar
  - Result count
  - Active filter chips
  - `Clear filters`
- Priority groups
  - `Read now`
  - `Worth keeping`
  - `Skim later`
- Article cards within each group

Priority groups are section breaks inside one result flow, not separate tabs.

### Card Density

Use medium-density cards.
They should provide enough context for decision-making without turning into editorial tiles.

Recommended card content:

- Title
- Site + saved time + optional reading time
- Label chips
- One-line `short_reason`
- Actions:
  - Primary: `Open`
  - Secondary: `Mark read`
  - Secondary: `Archive`
  - Weak / dangerous: `Delete`

---

## Metadata Model

Phase 1 should optimize metadata for triage rather than explanation.

### New primary fields

- `labels[]`
- `priority_bucket`
- `short_reason`

### Existing fields to continue using

- `site_name`
- `saved_at`
- `last_saved_at`
- `lifecycle_state`
- `processing_state`
- `reading_time_estimate`
- `content_type`
- `word_count`
- `last_opened_at`

### Deprecated front-end concepts

- `main_topic_id`
- `main_topic_label`
- `topics` store as an inbox dependency
- `one_line_digest`
- `reading_question`
- `related_topics`
- Topic summary panel rendering

Labels should stay lightweight and practical.
They should help users scan and filter, not explain the article's thesis.

---

## Data Migration Strategy

Phase 1 keeps existing article records but does not migrate old topic semantics.

Recommended migration behavior:

- Existing saved articles remain visible in the queue.
- Old topic-derived UI is removed.
- Articles without the new metadata model should be reprocessed for:
  - `labels[]`
  - `priority_bucket`
  - `short_reason`
- `topics` data is not translated into the new filter-first UI.

Migration should be lazy and non-blocking:

- Show the article immediately with baseline metadata.
- If new metadata is missing, render a degraded card.
- Refresh the card silently once the new metadata arrives.

---

## Empty, Error, and Transition States

### Empty states

- Empty active queue:
  - Tell the user they do not have anything in the queue right now.
  - Point them back to `Now` to save articles.
- Empty filtered results:
  - Tell the user no items match the current filters.
  - Offer `Clear filters`.
- Empty read or archive views:
  - Keep copy short and operational.

### Error and degraded states

AI failure must not make an article unusable.

Expected visible states:

- `Ready`
  - Full metadata available
- `Processing`
  - Basic article information visible
  - Labels or reason can show lightweight placeholders
- `Failed`
  - Article can still be opened
  - Retry remains available

### Transition behavior

During rollout, the inbox may contain a mix of:

- Fully processed items
- Reprocessing items
- Failed items

The visual system should keep those states consistent enough that the queue still feels reliable.

---

## Explicitly Out of Scope for Phase 1

- User-edited labels
- Global label management
- Topic clusters as a user-facing concept
- Topic overview or digest side panels
- Full-library search across active, read, and archived in one surface
- Dedicated history or knowledge-base workflows
- Heavy AI-generated summaries

---

## Success Criteria

The redesign is successful if:

1. Users immediately understand that the left side narrows the queue and the right side contains the articles to act on.
2. The first screen emphasizes article results instead of topic explanation.
3. Users can find a subset of saved items quickly through labels, source, and time filters.
4. Users can reopen the right article with minimal friction.
5. The queue remains usable when AI metadata is still processing or fails.
