'use strict';

const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

const providerIndex = html.indexOf('data-i18n="settings.provider.title"');
const languageIndex = html.indexOf('data-i18n="settings.language.title"');
const debugIndex = html.indexOf('data-i18n="section.debug"');
const actionsIndex = html.indexOf('data-action="test-ai-settings"');
const statusIndex = html.indexOf('id="settingsStatus"');
const languageSelectIndex = html.indexOf('id="settingsLanguagePreference"');
const languageStatusIndex = html.indexOf('id="languageStatus"');
const captureHelpIndex = html.indexOf('data-i18n="settings.provider.captureHelp"');

assert(providerIndex !== -1, 'Missing AI provider block');
assert(languageIndex !== -1, 'Missing language block');
assert(debugIndex !== -1, 'Missing debug block');
assert(providerIndex < languageIndex && languageIndex < debugIndex, 'Language block should sit between provider and debug blocks');
assert(providerIndex < actionsIndex && actionsIndex < languageIndex, 'Provider actions should remain inside the AI provider block');
assert(providerIndex < statusIndex && statusIndex < languageIndex, 'Provider status should remain inside the AI provider block');
assert(languageIndex < languageSelectIndex && languageSelectIndex < debugIndex, 'Language select should live inside the language block');
assert(languageIndex < languageStatusIndex && languageStatusIndex < debugIndex, 'Language status should live inside the language block');
assert(providerIndex < captureHelpIndex && captureHelpIndex < languageIndex, 'Provider capture help should remain inside the AI provider block');
assert(css.includes('.settings-field select'), 'Language select should use the settings field control styling');
assert(css.includes('appearance: none'), 'Language select should suppress browser-default select styling');
assert(css.includes('.settings-field select:focus'), 'Language select should have a focus style aligned with settings inputs');
assert(css.includes('#3898ec'), 'Language select focus should use the design-system focus blue');

console.log('PASS settings layout hierarchy');
