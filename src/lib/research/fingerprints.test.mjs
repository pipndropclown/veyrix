import assert from"node:assert/strict";import test from"node:test";import{fingerprintDataset,fingerprintResult}from"./researchIdentity.ts";
const a={timestamp:"2026-01-01T00:00:00.000Z",open:10,high:12,low:9,close:11,volume:2},b={timestamp:"2026-01-01T06:00:00.000Z",open:11,high:13,low:10,close:12,volume:3};
test("same candle dataset has same fingerprint",()=>assert.equal(fingerprintDataset([a,b]),fingerprintDataset([{...a},{...b}])));
test("candle change changes fingerprint",()=>assert.notEqual(fingerprintDataset([a,b]),fingerprintDataset([a,{...b,close:12.1}])));
test("dataset ordering is normalized deterministically",()=>assert.equal(fingerprintDataset([a,b]),fingerprintDataset([b,a])));
test("same result has same fingerprint",()=>assert.equal(fingerprintResult({b:2,a:1}),fingerprintResult({a:1,b:2})));
test("material result change changes fingerprint",()=>assert.notEqual(fingerprintResult({score:10}),fingerprintResult({score:11})));
