import test from 'node:test'; import assert from 'node:assert/strict'; import { validateEmail, validateSignUp } from './validation.ts'; import { getSupabaseConfig } from '../supabase/config.ts';
test('guest mode is available without Supabase variables',()=>assert.equal(getSupabaseConfig({}),null));
test('signup validation requires matching password and valid fields',()=>{const e=validateSignUp({displayName:'',email:'bad',password:'x',confirmPassword:'y'}); assert.ok(e.displayName&&e.email&&e.password&&e.confirmPassword)});
test('valid email accepted',()=>assert.equal(validateEmail('user@example.com'),true));
