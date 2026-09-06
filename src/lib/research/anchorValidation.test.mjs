import assert from"node:assert/strict";import test from"node:test";import{calculateAnchoredRange,generateResearchAnchors,normalizeResearchAnchor}from"./anchorValidation.ts";
const now=Date.parse("2026-09-05T12:00:00.000Z");
test("valid historical anchor is accepted",()=>assert.equal(normalizeResearchAnchor("2026-09-01",now),"2026-09-01T00:00:00.000Z"));
test("future anchor is rejected",()=>assert.equal(normalizeResearchAnchor("2027-01-01",now),null));
test("malformed anchor is rejected",()=>assert.equal(normalizeResearchAnchor("not-a-date",now),null));
test("anchored start and end range is correct",()=>assert.deepEqual(calculateAnchoredRange(30,"2026-09-01T00:00:00.000Z"),{start:"2026-08-02T00:00:00.000Z",end:"2026-09-01T00:00:00.000Z"}));
test("generated anchors never extend after the latest anchor",()=>assert.ok(generateResearchAnchors("2026-09-01T00:00:00.000Z").every(x=>Date.parse(x)<=Date.parse("2026-09-01T00:00:00.000Z"))));
test("equivalent anchor normalization is deterministic",()=>assert.equal(normalizeResearchAnchor("2026-09-01T03:59:00Z",now),normalizeResearchAnchor("2026-09-01T00:15:00Z",now)));
