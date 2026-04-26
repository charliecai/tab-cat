# Tab Cat Privacy Policy

Effective date: April 26, 2026

Tab Cat is a browser extension by charliec. It replaces the new tab page with a local dashboard for managing open tabs, duplicate tabs, pinned shortcuts, and a reading inbox.

This policy explains what data Tab Cat handles, where it is stored, and when any data may leave your browser.

## Summary

Tab Cat is local-first. It does not require an account, does not operate a Tab Cat server, does not sell user data, and does not use user data for advertising.

Most data stays inside your browser profile using Chrome or Edge extension storage and IndexedDB. Article text only leaves your browser if you choose to configure an OpenAI-compatible AI provider and run article analysis.

## Data Tab Cat Handles

Tab Cat may handle the following data to provide its features:

- Open tab metadata, including tab titles, URLs, favicons, window IDs, and tab IDs.
- Saved reading items, including article URLs, titles, excerpts, captured article text, metadata, reading state, topic state, and processing state.
- Pinned shortcuts that you create, including title and URL.
- Duplicate-tab and grouping information derived from your currently open tabs.
- Extension settings, including display language, AI provider base URL, AI model ID, AI connection status, and optional API key.
- Local backup files that you export or import manually.

## How Data Is Used

Tab Cat uses this data to:

- Display your open tabs grouped by domain.
- Identify homepage-like tabs and duplicate tabs.
- Jump to, close, or clean up tabs when you click an action.
- Save selected article-like tabs into the reading inbox.
- Capture readable article content from pages you choose to save.
- Analyze saved article content if you configure and test an AI provider.
- Preserve your local settings, pinned shortcuts, reading items, and extension state.

## Local Storage

Tab Cat stores data locally in your browser profile using:

- `chrome.storage.local` for settings, legacy saved-tab data, and AI configuration.
- IndexedDB for reading inbox articles, topics, pinned entries, and background processing jobs.

Data stored this way remains on your device unless your browser account, browser profile, operating system, backup system, or another tool syncs or copies it outside the device.

## Optional AI Provider

AI analysis is optional.

If you configure an OpenAI-compatible provider in Tab Cat settings, Tab Cat sends requests directly from your browser to the HTTPS base URL you enter. These requests may include:

- The API key you entered.
- The configured model ID.
- Saved article text and article metadata needed for analysis.
- The prompt and request payload needed to produce structured article analysis.

Tab Cat does not proxy these requests through a Tab Cat server. The data is sent directly to the provider host you configured. Your use of that provider is subject to the provider's own privacy policy, security practices, retention rules, and terms.

If you do not configure an AI provider, Tab Cat's core tab dashboard, grouping, duplicate detection, pinned shortcuts, and local reading inbox features continue to work without sending article content to an AI provider.

## API Keys

If you save an AI API key, Tab Cat stores it in your browser profile using extension storage. The key is not encrypted by Tab Cat. Do not use this feature on shared or untrusted browser profiles.

Exported Tab Cat backup files may include AI settings and credentials. Treat exported backup files as sensitive.

## Permissions

Tab Cat requests browser permissions to provide its core features:

- `tabs`: read tab titles and URLs, focus existing tabs, and close tabs when you click cleanup actions.
- `storage`: save settings, pinned shortcuts, reading inbox state, and local extension data.
- `scripting`: inject the local capture script into a tab you save for later so readable article content can be extracted.
- Host access: allow the capture script to run on pages that you choose to save for later across normal web URLs.

Tab Cat does not use these permissions to track browsing for advertising or to sell data.

## Data Sharing

Tab Cat does not sell, rent, or share user data with advertisers or data brokers.

Data may be transmitted only in these cases:

- You configure an AI provider and run article analysis, in which case article content and related request data are sent directly to the provider host you entered.
- You manually export, copy, upload, sync, or otherwise share local backup files or browser profile data.
- Your browser, operating system, or third-party tools sync or back up extension data according to their own settings.

## Remote Code

Tab Cat is designed to run its extension code locally from the installed extension package. The optional AI provider feature sends data requests to the provider you configure, but it does not download remote JavaScript to execute extension functionality.

## Children's Privacy

Tab Cat is a general productivity tool and is not directed to children. Tab Cat does not knowingly collect personal information from children.

## Changes

This policy may be updated when Tab Cat changes how it handles data. Material changes should be reflected in the extension listing, repository documentation, or the public policy URL used for store submission.

## Contact

Author: charliec

For privacy questions, contact the author through the public support channel listed on the Tab Cat store listing or repository.
