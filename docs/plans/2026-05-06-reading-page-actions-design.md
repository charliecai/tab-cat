# Reading Page Actions Design

## Goal

Let a reader finish an article on the original webpage and resolve the matching Reading inbox item without returning to Tab Out.

## Chosen Approach

Inject a small, design-system-aligned floating card into a webpage when the active tab URL matches a saved Reading inbox article. The card appears only for non-deleted, unread articles and offers two terminal actions:

- Mark read and close the current tab.
- Delete from Reading inbox and close the current tab.

A small dismiss button hides the card on the current page without changing article state.

## Architecture

The background service worker remains the authority for Reading inbox data. `TabOutActionController` gains helper functions that:

1. Query the active tab.
2. Find a matching article by canonical URL.
3. Inject the floating card through `chrome.scripting.executeScript`.
4. Handle messages from the injected page card for mark-read/delete actions.

`background.js` calls the injection check on tab activation/update/focus and handles quick-action messages. The injected UI sends `chrome.runtime.sendMessage` and asks the background to close the current tab after the article operation succeeds.

## Visual Design

The injected card follows `DESIGN.md`: Ivory/Parchment surfaces, warm borders, near-black text, Terracotta/near-black primary action, warm danger treatment, rounded corners, and a soft shadow. It is compact and fixed to the bottom-right so it does not compete with page content.

## Error Handling

- Unsupported or internal URLs skip injection.
- Restricted pages that reject script injection are ignored.
- Missing/deleted/read articles remove any stale card.
- Failed actions keep the page open and update the card status text.

## Testing

Action-controller specs cover:

- Injecting the quick action card for an unread saved article.
- Not injecting for read/deleted/missing articles.
- Marking a matched article read and closing the current tab.
- Deleting a matched article, deleting its related job, and closing the current tab.

Extension smoke QA should verify the actual runtime after implementation.
