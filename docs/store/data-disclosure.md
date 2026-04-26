# Tab Cat Store Data Disclosure

This file summarizes the recommended Chrome Web Store and Microsoft Edge Add-ons privacy disclosures for Tab Cat.

Author: charliec

## Product Purpose

Tab Cat replaces the browser new tab page with a local tab dashboard. It groups open tabs by domain, identifies duplicate tabs, supports tab cleanup actions, stores pinned shortcuts, and provides a local reading inbox for article-like pages. Optional AI analysis can be enabled by the user with their own OpenAI-compatible provider.

## Recommended Data Categories

### Web Browsing Activity

Disclose: Yes.

Why: Tab Cat reads open tab URLs, titles, favicons, tab IDs, and window IDs to group tabs, detect duplicates, jump to existing tabs, close selected tabs, and build the new tab dashboard.

Handling: Stored and processed locally unless included in user-exported backups or browser profile sync/backups.

### Website Content

Disclose: Yes.

Why: When a user saves an article-like tab for later, Tab Cat injects a local capture script into that selected page and extracts readable article text and metadata for the reading inbox.

Handling: Stored locally in IndexedDB. If the user configures an AI provider and runs analysis, captured article text may be sent directly to the configured provider host.

### Authentication Information

Disclose: Yes, if the store category includes user-entered API keys.

Why: Users may optionally save an AI provider API key in Tab Cat settings.

Handling: Stored locally in browser extension storage. Sent only to the configured AI provider host when testing the connection or running article analysis. Exported backups may include this credential.

### User Activity

Disclose: Yes, if the store form treats extension state and reading actions as user activity.

Why: Tab Cat stores reading item lifecycle states such as saved, read, archived, and processing status to power the reading inbox.

Handling: Stored locally in IndexedDB and browser extension storage.

### Personally Identifiable Information

Disclose: No, unless future versions intentionally collect profile information such as name, email address, phone number, or account identifiers.

Current behavior: Tab Cat has no account system and does not intentionally collect identity profile fields. Page content or URLs saved by the user may incidentally contain personal information, so the privacy policy should still explain that saved website content can be sensitive.

### Location

Disclose: No.

Current behavior: Tab Cat does not request browser geolocation or intentionally collect precise location.

### Financial and Payment Information

Disclose: No.

Current behavior: Tab Cat has no payment flow and does not intentionally collect payment information.

### Health Information

Disclose: No.

Current behavior: Tab Cat does not intentionally collect health information. User-saved pages may incidentally contain sensitive content, but the extension does not categorize or request health data as a product feature.

### Personal Communications

Disclose: No for intentional collection.

Current behavior: Tab Cat may show or save URLs and titles from sites the user has open. It does not intentionally collect messages, email bodies, chats, or communication content as a dedicated feature.

## Data Use Statements

Use these statements when completing store privacy forms:

- Tab Cat does not sell user data.
- Tab Cat does not use user data for advertising.
- Tab Cat does not use user data for creditworthiness, lending, or eligibility decisions.
- Tab Cat does not transfer data to a Tab Cat-owned server.
- Optional AI analysis sends captured article content directly from the browser to the user-configured OpenAI-compatible provider.
- Core features work without configuring an AI provider.
- Data is stored locally in the browser profile using extension storage and IndexedDB.

## Permission Justifications

### `tabs`

Required to read open tab titles and URLs, group tabs by domain, detect duplicates, focus existing tabs, and close tabs only when the user clicks cleanup actions.

### `storage`

Required to store local settings, pinned shortcuts, reading inbox state, legacy saved-tab data, AI settings, and import/export state.

### `scripting`

Required to inject Tab Cat's packaged capture content script into a user-selected page when the user saves that page for later.

### `activeTab`

Review before submission. If unused, remove it before packaging. If kept, justify it only if a feature requires temporary access to the active tab after user interaction.

### `<all_urls>` Host Access

Required because users can save article-like pages from arbitrary normal web URLs. Tab Cat blocks unsupported browser-internal pages such as `chrome://`, extension pages, Chrome Web Store pages, and local `file://` pages.

## Remote Code Disclosure

Tab Cat does not execute remotely hosted JavaScript as extension code. Runtime scripts are packaged inside the extension.

Optional AI requests are network requests to the user-configured provider API and are not used to download executable extension code.

## Edge Add-ons Personal Information Answer

Recommended answer: Yes.

Reason: Tab Cat accesses browsing data and can capture website content selected by the user. If the user configures AI, it can transmit captured article content and an API key to the user-configured provider. A privacy policy URL should be supplied.
