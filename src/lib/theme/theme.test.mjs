import test from 'node:test'; import assert from 'node:assert/strict'; import { DEFAULT_THEME, isThemePreference, resolveTheme } from './theme.ts';
test('default theme is dark',()=>assert.equal(DEFAULT_THEME,'dark'));
test('system resolves from preference',()=>{assert.equal(resolveTheme('system',true),'dark');assert.equal(resolveTheme('system',false),'light')});
test('invalid theme rejected',()=>assert.equal(isThemePreference('neon'),false));
