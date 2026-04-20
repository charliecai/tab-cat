test('TabOutI18n resolves auto preference from browser locale', () => {
  const i18n = globalThis.TabOutI18n;
  if (!i18n) throw new Error('TabOutI18n missing');

  assertEqual(i18n.resolveEffectiveLanguage('auto', 'zh-CN'), 'zh-CN');
  assertEqual(i18n.resolveEffectiveLanguage('auto', 'zh-TW'), 'zh-CN');
  assertEqual(i18n.resolveEffectiveLanguage('auto', 'en-US'), 'en');
});

test('TabOutI18n translates counts and falls back to English when a key is missing', () => {
  const i18n = globalThis.TabOutI18n;
  if (!i18n) throw new Error('TabOutI18n missing');

  i18n.setLanguagePreference('zh-CN', 'zh-CN');
  assertEqual(i18n.t('counts.domains', { count: 2 }), '2 个域名');
  assertEqual(i18n.t('spec.fallbackOnly'), 'English fallback only');
});

test('TabOutI18n exposes localized labels for language preference options', () => {
  const i18n = globalThis.TabOutI18n;
  if (!i18n) throw new Error('TabOutI18n missing');

  i18n.setLanguagePreference('en', 'en-US');
  assertEqual(i18n.t('settings.language.options.auto'), 'Follow browser');
  assertEqual(i18n.t('settings.language.options.en'), 'English');
  assertEqual(i18n.t('settings.language.options.zhCn'), '简体中文');

  i18n.setLanguagePreference('zh-CN', 'zh-CN');
  assertEqual(i18n.t('settings.language.options.auto'), '跟随浏览器');
  assertEqual(i18n.t('settings.language.options.en'), 'English');
  assertEqual(i18n.t('settings.language.options.zhCn'), '简体中文');
});
