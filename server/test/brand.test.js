// The airline is AirGuard Airlines (owner, 2026-11-28; it was Meridian Air). Brand text only: the repo, shelf id, /meridian-air/ route, schema ids and the
// SIEM marker prefix keep "meridian-air" until the repo-rename step, and "Meridian Air LAB" is the lab's own name (README title, shelf name, PingOne app names).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DEFAULT_CAST, VERTICALS } from '../src/cast.js';
import { get, post, W, withServer } from './helpers.js';

const root = join(import.meta.dirname, '..', '..');
const RETIRED = /Meridian Air(?! LAB)/i;
// Everything a viewer can read, minus the SIEM marker (`meridian-air-<12 hex>`, a search key for evidence already written).
const readable = (v) => JSON.stringify(v).replace(/meridian-air-[0-9a-f]{12}/g, '');

test('brand: the default cast is AirGuard Airlines, host airguard, and no retired name is in any pack', () => {
  assert.equal(DEFAULT_CAST.castBrand, 'AirGuard Airlines');
  assert.equal(DEFAULT_CAST.castHost, 'airguard');
  for (const [id, c] of Object.entries(VERTICALS)) assert.ok(!RETIRED.test(Object.values(c).join(' ')) && !/meridian/i.test(c.castHost), id);
});

test('brand: nothing the default run shows or says (health, story, captions, use cases, prompts, all 11 scenes) names Meridian Air', async () => {
  await withServer(async (url) => {
    const seen = {};
    for (const p of ['/api/health', '/api/story', '/api/captions', '/api/usecases', '/api/prompts']) {
      const r = await get(url, p); assert.equal(r.status, 200, p); seen[p] = await r.json();
    }
    assert.equal(seen['/api/health'].demo.name, 'AirGuard Airlines — Privilege in One Demo');
    assert.equal(seen['/api/story'].cast.castBrand, 'AirGuard Airlines');
    assert.equal(seen['/api/captions'].opening?.header ?? seen['/api/captions'].captions?.opening?.header, 'AirGuard Airlines: agents on a trust plane');
    for (let i = 1; i <= 11; i += 1) {
      const r = await post(url, `/api/run/MA${i}`, {}, W(`brand-${i}`)); assert.equal(r.status, 200, `MA${i}`);
      seen[`MA${i}`] = await r.json();
    }
    for (const [k, v] of Object.entries(seen)) assert.ok(!/meridian air|meridian-air\.|meridian-air-app/i.test(readable(v)), `${k} still names the retired airline (brand or host)`);
    assert.match(readable(seen['MA1']), /airguard/);
  });
});

test('brand: the shipped text a viewer reads (page title, scenes, talk track, captions, README, CLAUDE.md) says AirGuard Airlines, not Meridian Air', () => {
  for (const f of ['web/index.html', 'web/src/App.jsx', 'server/src/data.js', 'data/usecases.json', 'docs/talk-track.md', 'video/captions.md', 'video/SCRIPT.md', 'README.md', 'CLAUDE.md']) {
    const t = readFileSync(join(root, f), 'utf8');
    assert.ok(!RETIRED.test(t), `${f} names the retired airline`);
  }
  assert.match(readFileSync(join(root, 'web/index.html'), 'utf8'), /<title>AirGuard Airlines — Privilege in One Demo<\/title>/);
});
