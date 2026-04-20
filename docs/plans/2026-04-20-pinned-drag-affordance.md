# Pinned Drag Affordance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the pinned-card drag handle to a left-edge floating affordance so pinned titles reclaim horizontal space without losing drag discoverability.

**Architecture:** Keep the existing pinned drag event model and `data-drag-handle` contract intact. Update the pinned card DOM and CSS only, then verify the new structure through the browser-backed app specs that already exercise pinned drag behavior.

**Tech Stack:** Chrome extension, HTML, CSS, JavaScript, browser spec runner

---

### Task 1: Lock the new pinned-card affordance in tests

**Files:**
- Modify: `extension/dev/spec-app.js`
- Test: `extension/dev/spec-app-runner.html`

**Step 1: Write the failing test**

Add assertions to the existing pinned drag spec for:
- `.pinned-card` using `position: relative`
- `.pinned-drag-handle` using `position: absolute`

**Step 2: Run test to verify it fails**

Run the app spec runner in a real browser and confirm the pinned drag spec fails because the current layout still uses an in-flow drag column.

**Step 3: Write minimal implementation**

Adjust the pinned card markup and CSS so the handle floats on the left edge without affecting the content grid.

**Step 4: Run test to verify it passes**

Re-run the same app spec runner and confirm the pinned drag spec passes.

**Step 5: Commit**

```bash
git add docs/plans/2026-04-20-pinned-drag-affordance.md extension/dev/spec-app.js extension/lib/homepage-controller.js extension/style.css
git commit -m "feat: float pinned drag handle affordance"
```

### Task 2: Preserve the current pinned interactions

**Files:**
- Modify: `extension/lib/homepage-controller.js`
- Modify: `extension/style.css`
- Test: `extension/dev/spec-app.js`

**Step 1: Keep the drag handle contract**

Retain the existing drag handle button, `data-drag-handle`, and accessibility label so drag arming still works.

**Step 2: Rework the layout minimally**

Convert the card to a two-column layout for content plus menu, then anchor the handle as an overlay on the left edge.

**Step 3: Verify hover and drag states still read correctly**

Keep the existing hover, focus, and dragging affordances, but restyle them for the new floating handle.

**Step 4: Run the full related spec surface**

Run the app specs, then the library specs, and confirm there are no regressions in pinned rendering or drag behavior.

**Step 5: Commit**

```bash
git add extension/dev/spec-app.js extension/lib/homepage-controller.js extension/style.css
git commit -m "feat: reclaim pinned title space with floating drag affordance"
```
