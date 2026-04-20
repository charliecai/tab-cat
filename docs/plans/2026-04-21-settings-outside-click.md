# Settings Drawer Outside Click Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the settings drawer when users click outside it, without changing the current drawer layout or explicit close button.

**Architecture:** Keep the existing settings drawer ownership in `extension/lib/homepage-controller.js`. Add a small open-state helper and outside-click branch to the existing document click listener, then verify the new behavior with a focused controller spec.

**Tech Stack:** Chrome extension, JavaScript, HTML, browser spec runner

---

### Task 1: Lock outside-click dismissal in a controller spec

**Files:**
- Modify: `extension/dev/spec-homepage-controller.js`
- Test: `extension/dev/spec-runner.html`

**Step 1: Write the failing test**

Add a spec that:

- mounts a settings trigger, drawer, and outside element
- opens the drawer through the existing trigger
- clicks outside the drawer
- expects `aria-hidden="true"` on the drawer after the outside click

**Step 2: Run test to verify it fails**

Run the library spec runner and confirm the new spec fails because outside clicks currently do nothing.

**Step 3: Write minimal implementation**

Add an outside-click branch to the settings click handler in `extension/lib/homepage-controller.js`.

**Step 4: Run test to verify it passes**

Re-run the same spec runner and confirm the new test passes.

**Step 5: Commit**

```bash
git add extension/dev/spec-homepage-controller.js extension/lib/homepage-controller.js
git commit -m "fix: close settings drawer on outside click"
```

### Task 2: Verify existing settings interactions stay intact

**Files:**
- Modify: `extension/lib/homepage-controller.js`
- Test: `extension/dev/spec-homepage-controller.js`

**Step 1: Preserve the current close button path**

Keep `data-action="close-settings"` working exactly as before.

**Step 2: Preserve the current toggle path**

Make sure clicking `data-action="toggle-settings"` still toggles open/close and is not treated as an outside click.

**Step 3: Run related specs**

Run the library spec runner, then the app spec runner, and confirm there are no regressions.

**Step 4: Commit**

```bash
git add extension/dev/spec-homepage-controller.js extension/lib/homepage-controller.js
git commit -m "fix: preserve settings drawer interactions"
```
