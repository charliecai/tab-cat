# Tab Cat Review Notes

Author: charliec

Use these notes when submitting Tab Cat to Chrome Web Store or Microsoft Edge Add-ons.

## Reviewer Summary

Tab Cat is a Manifest V3 new tab extension. It replaces the new tab page with a local dashboard for open tabs, grouped by domain. Users can focus existing tabs, close selected tabs, close duplicate tabs, pin shortcuts, and save article-like pages into a local reading inbox.

The extension has no account system and no Tab Cat server.

## How To Test

1. Install the extension from the submitted package.
2. Open several normal web pages, such as `https://example.com`, `https://www.iana.org/`, and `https://news.ycombinator.com/`.
3. Open a new tab. Tab Cat should appear as the new tab page.
4. Confirm the `Now` view groups open tabs by domain.
5. Click a tab title. The browser should focus that existing tab.
6. Open duplicate pages and return to Tab Cat. Duplicate indicators should appear where applicable.
7. Use a close action on a single tab or duplicate group and confirm only the selected tab cleanup action runs.
8. Save an article-like tab for later. The item should appear in `Reading inbox`.
9. Open `Reading inbox`. If AI is not configured, the saved article should show local saved state and fallback guidance.
10. Mark the saved item as read and verify it moves to the read state.
11. Open `Settings` and confirm AI provider settings and backup controls are visible.

## AI Feature Notes

AI analysis is optional. Reviewers do not need an AI account to test the core extension.

If no AI provider is configured, Tab Cat still supports:

- New tab dashboard.
- Domain grouping.
- Duplicate detection.
- Tab focus and cleanup actions.
- Pinned shortcuts.
- Local reading inbox.

If an AI provider is configured by the user, Tab Cat sends captured article text directly from the browser to the HTTPS OpenAI-compatible provider host entered by the user. Tab Cat does not proxy those requests through a Tab Cat server.

## Permission Explanations

### `tabs`

Used to read open tab titles and URLs, group tabs by domain, detect duplicates, focus existing tabs, and close tabs only after explicit user actions.

### `storage`

Used to store local settings, pinned shortcuts, reading inbox state, AI settings, and backup/import state.

### `scripting`

Used to inject Tab Cat's packaged capture content script into a user-selected tab when the user saves an article for later.

### `<all_urls>`

Used because users can save article-like pages from arbitrary normal web URLs. Tab Cat blocks unsupported browser-internal pages such as `chrome://`, extension pages, Chrome Web Store pages, and local `file://` pages.

### `activeTab`

This permission should be reviewed before submission. If unused in the final package, remove it. If kept, it should only support user-initiated active-tab workflows.

## Data Handling

Tab Cat stores core data locally in the browser profile using extension storage and IndexedDB. It does not sell user data, use user data for advertising, or send browsing data to a Tab Cat-owned server.

Optional AI analysis can transmit captured article content and the user-entered API key directly to the user's configured OpenAI-compatible provider. This behavior is disclosed in the privacy policy and in the Settings UI.

## Known Unsupported Pages

Tab Cat does not capture article content from browser-internal pages or protected pages, including:

- `chrome://` pages.
- Extension pages.
- Chrome Web Store pages.
- `file://` pages.

On unsupported pages, capture should fail gracefully or be disabled.
