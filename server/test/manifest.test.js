import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MANIFEST, TRACKS, NEEDS, OPENS, findUseCase, validateManifest, loadManifest } from '../src/manifest.js';

const RAW = fs.readFileSync(new URL('../../data/usecases.json', import.meta.url), 'utf8');
const FIELDS = ['id', 'track', 'title', 'buyerStory', 'pingOneSolution', 'trigger', 'expectedOutcome', 'evidence', 'maturity', 'productRoles', 'primaryTool', 'needs', 'flag', 'opens', 'linkOut'].sort();

test('all 11 scenes are present: the track counts match the generator, and every one is checked by name', () => {
  assert.equal(MANIFEST.usecases.length, 11);
  assert.deepEqual(TRACKS, { foundations: 2, controls: 2, a2a: 1, nhi: 2, hitl: 1, attacks: 1, demo: 2 });
  for (const [t, n] of Object.entries(TRACKS)) assert.equal(MANIFEST.usecases.filter((u) => u.track === t).length, n, t);
  assert.equal(new Set(MANIFEST.usecases.map((u) => u.id)).size, 11);
  for (const id of ['MA1', 'MA2', 'MA3', 'MA4', 'MA5', 'MA6', 'MA7', 'MA8', 'MA9', 'MA10', 'MA11']) assert.ok(findUseCase(id), id);
});

test('a missing scene, a short track or a duplicate id fails validation (the count test has teeth)', () => {
  const m = structuredClone(MANIFEST);
  m.usecases = m.usecases.filter((u) => u.id !== 'MA1');
  assert.match(validateManifest(m).join(), /expected 11 scenes/);
  assert.match(validateManifest(m).join(), /track foundations should have 2/);
  const dup = structuredClone(MANIFEST); dup.usecases[1].id = dup.usecases[0].id;
  assert.match(validateManifest(dup).join(), /duplicate id/);
  const bad = structuredClone(MANIFEST); bad.usecases[0].opens = 'sideways'; bad.usecases[1].needs = ['wifi'];
  assert.match(validateManifest(bad).join(), /opens out of range[^]*needs out of range/);
});

test('each scene has exactly the fifteen fields, and nothing else', () => {
  for (const u of MANIFEST.usecases) assert.deepEqual(Object.keys(u).sort(), FIELDS, u.id);
  for (const gone of ['codeRefs', 'owasp', 'whatToSay', 'whatLong', 'businessValue', 'perVertical', 'useCaseId', 'advanced', 'match']) assert.ok(!RAW.includes(`"${gone}"`), gone);
});

test('the lab-added fields are in range and labelled', () => {
  for (const u of MANIFEST.usecases) {
    assert.ok(u.needs.every((n) => NEEDS.includes(n)), u.id);
    assert.ok(OPENS.includes(u.opens), u.id);
    assert.equal(u.flag, u.maturity.startsWith('flag:') ? u.maturity.slice(5) : null, u.id);
    assert.ok(u.linkOut === null || typeof u.linkOut === 'string', u.id);
  }
  const flags = MANIFEST.usecases.filter((u) => u.flag).map((u) => u.flag);
  assert.deepEqual(flags, ['ciba_enabled']);
  assert.equal(findUseCase('MA7').needs.includes('gw'), true);
  assert.equal(findUseCase('MA4').needs.includes('a2a'), true);
});

test('the source is recorded: the generator script, no absolute path', () => {
  const s = MANIFEST.source;
  assert.equal(s.file, 'scripts/gen-scenes.mjs');
  assert.ok(!/\/Users\/|\/home\//.test(RAW));
});

test('the committed JSON holds no identifier from another project: counted, never printed', () => {
  const patterns = {
    url: /https?:\/\/(?!.*(example|invalid))[a-z0-9.-]+/gi,
    host: /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|cloud|app|ai|co|us)\b/gi,
  };
  for (const [name, re] of Object.entries(patterns)) {
    const hits = [...RAW.matchAll(re)].map((m) => m[0]);
    assert.equal(hits.length, 0, `${name}: ${hits.length} hits (first: ${hits[0] ?? '—'})`);
  }
});
