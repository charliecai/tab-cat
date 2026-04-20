# Settings Drawer Outside Click Close

**Date:** 2026-04-21

**Status:** Approved design

**Summary:** Let the settings drawer close when users click anywhere outside the drawer, while preserving the current close button and drawer visuals.

---

## Product Decision

Use document-level outside click dismissal for the existing right-side settings drawer.

When the drawer is open:

- Clicking inside the drawer keeps it open.
- Clicking the settings trigger keeps the current toggle behavior.
- Clicking anywhere else on the page closes the drawer.

This applies consistently on desktop and narrow/mobile layouts.

## Why This Approach

- It matches the existing drawer UI without adding a new backdrop layer.
- It is the smallest behavior change and keeps the current visual design intact.
- It avoids turning settings into a heavier modal interaction.

## Interaction Rules

### Open state

- `data-action="toggle-settings"` still opens the drawer.
- The drawer remains open during form interaction, scrolling, and button clicks inside the panel.

### Dismissal

- `data-action="close-settings"` still closes the drawer.
- Any click target outside `#settingsDrawer` closes the drawer if it is open.
- Clicking the toggle button does not double-close or fight the outside-click logic.

## Technical Plan

- Keep the change in `extension/lib/homepage-controller.js`, where `toggleSettings()` and the settings click wiring already live.
- Add a small `isSettingsOpen()` helper so the outside-click branch stays explicit and testable.
- Cover the behavior with a controller spec in `extension/dev/spec-homepage-controller.js`.

## Non-Goals

- No backdrop overlay.
- No visual restyling.
- No keyboard behavior changes beyond the current implementation.
