// Story mode (shared pattern: AI-DEMO-Standalone shared/story/ADDING-TO-A-LAB.md). The wording lives in video/captions.md, the ONE file the recorded video
// and the live Story both read. The shared parser is vendored plain JS (server/src/story/, pinned by web/src/story/story.sha256); this file is the lab's
// own glue: it reads the file (again whenever it changes), parses it, and answers GET /api/captions. (GET /api/story is the lab's vertical cast story, so
// the wording route takes the other name.) Nothing here makes a network call.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { test } from 'node:test';

import { CAPTIONS_PATH, captionsResponse, loadCaptions, resetCaptionsCache } from '../src/story-captions.js';
import { parity } from '../src/story/captions.js';
import { checkPin } from '../../scripts/story-checkPin.mjs';
import { STEPS, STORY_ONLY, VIDEO_ONLY, scriptKeys } from '../../web/src/storyScript.js';

const root = join(import.meta.dirname, '..', '..');

test('story: the vendored Story files match their pin (an edited copy fails CI)', () => {
  assert.deepEqual(checkPin(root), []);
});

test('story: every caption key has a step in the script and every step has wording (the parity test)', () => {
  assert.deepEqual(parity(loadCaptions(), scriptKeys(), { allowUnused: VIDEO_ONLY }), []);
});

test('story: the parity check really fails when the wording and the script drift', () => {
  const captions = loadCaptions();
  const missingWording = { ...captions, steps: Object.fromEntries(Object.entries(captions.steps).filter(([k]) => k !== 'ma1')) };
  assert.deepEqual(parity(missingWording, scriptKeys(), { allowUnused: VIDEO_ONLY }), ['the demo has step "ma1" but captions.md does not']);
  const extra = { ...scriptKeys(), steps: [...scriptKeys().steps, 'brand_new'] };
  assert.deepEqual(parity(captions, extra, { allowUnused: VIDEO_ONLY }), ['the demo has step "brand_new" but captions.md does not']);
});

test('story: the bubbles come in the same order as in take.py, and the scene order matches', () => {
  const video = readFileSync(join(root, 'video/take.py'), 'utf8');
  const m = video.match(/SCENES = \[([^\]]+)\]/);
  assert.ok(m, 'take.py declares SCENES');
  const scenes = m[1].split(',').map((s) => s.trim().replace(/["']/g, ''));
  // The script's scene bubbles, in the video's tour order.
  const sceneBubbles = STEPS.filter((s) => s.type === 'bubble' && /^ma\d+$/.test(s.key)).map((s) => s.key);
  assert.deepEqual(sceneBubbles, scenes.map((s) => s.toLowerCase()));
  assert.deepEqual(scenes, ['MA1', 'MA2', 'MA3', 'MA4', 'MA5', 'MA6', 'MA7', 'MA8', 'MA9', 'MA10', 'MA11']);
});

test('story (rule 29): the first page the viewer sees names the demo', () => {
  const captions = loadCaptions();
  assert.ok(captions.opening.header && captions.opening.header.length > 3, 'the Opening Slide has a header');
  assert.equal(captions.opening.header, 'Meridian Air: agents on a trust plane');
  const first = STEPS[0];
  assert.equal(first.type, 'slide');
  assert.equal(first.key, 'opening');
});

test('story: every step is well formed (a known trigger and type, Mock wording that exists, no twin keys)', () => {
  const captions = loadCaptions();
  const keys = STEPS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, 'no key twice');
  for (const s of STEPS) {
    assert.ok(['load', 'run-done', 'frame'].includes(s.trigger), `${s.key}: trigger`);
    assert.ok(['bubble', 'slide'].includes(s.type), `${s.key}: type`);
    if (s.sampleKey) assert.ok(captions.steps[s.sampleKey], `${s.key}: Mock wording "${s.sampleKey}" exists`);
    if (s.type === 'bubble') assert.ok(s.target, `${s.key}: a bubble has a target`);
  }
});

test('story: every scene prompt is the dropdown\'s own option, as take.py drives it', () => {
  const video = readFileSync(join(root, 'video/take.py'), 'utf8');
  assert.match(video, /select_option\('\[data-testid="wtt-select"\]', uc\)/, 'take.py runs the scenes through the prompt dropdown');
  for (const s of STEPS.filter((x) => /^ma\d+$/.test(x.key))) {
    assert.ok(s.prompt?.press === `[data-testid="wtt-opt-${s.key.toUpperCase()}"]`, `${s.key}: prompt press is its dropdown option`);
  }
});

test('story: every scene bubble has a sample_* Mock variant (a mock run never reads as a live one)', () => {
  const captions = loadCaptions();
  for (const s of STEPS.filter((x) => x.type === 'bubble' && !STORY_ONLY.includes(x.key) && x.key !== 'hops' && x.key !== 'signin')) {
    assert.ok(s.sampleKey, `${s.key}: sampleKey`);
  }
});

test('story: captions.md and the script are public-safe (no internal host, tenant id, key or screenshot data)', () => {
  const t = readFileSync(CAPTIONS_PATH, 'utf8') + readFileSync(join(root, 'web/src/storyScript.js'), 'utf8');
  assert.equal(/ping-devops|procyon|\.local\b|sk-ant|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t), false);
});

test('story: captionsResponse serves the parsed wording, and a broken file is a 500 that names the problem (never a crash or a path)', () => {
  const ok = captionsResponse();
  assert.equal(ok.status, 200);
  assert.ok(ok.body.opening.title && ok.body.steps.ma1);
  assert.equal(ok.body.sourceSha256, createHash('sha256').update(readFileSync(CAPTIONS_PATH)).digest('hex'), 'the wording says which bytes it came from');
  const dir = mkdtempSync(join(tmpdir(), 'story-'));
  const bad = join(dir, 'captions.md');
  writeFileSync(bad, '# Step: x\n\n## Title\nonly a title\n');
  const broken = captionsResponse(bad);
  assert.equal(broken.status, 500);
  assert.match(broken.body.error, /^Story wording could not be read: captions\.md: step "x" needs both a "## Title" and a "## Text" section$/);
  const missing = captionsResponse(join(dir, 'missing.md'));
  assert.equal(missing.status, 500);
  assert.equal(missing.body.error, 'Story wording could not be read: the wording file is missing or unreadable.');
  assert.equal(JSON.stringify(missing.body).includes(dir), false, 'the 500 never carries a server path');
  resetCaptionsCache();
});

test('story: a fix to captions.md shows without a restart (the wording is read again when the file changes)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'story-'));
  const file = join(dir, 'captions.md');
  const slide = (t) => `# Opening Slide\n\n## Header\nh\n\n## Title\n${t}\n\n## Lead\nl\n\n## Column A: a\n- x\n\n## Column B: b\n- y\n\n## Verdict\nv\n\n---\n\n`;
  const doc = (t) => slide(t) + slide('c').replace('# Opening Slide', '# Closing Slide');
  writeFileSync(file, doc('first'));
  assert.equal(loadCaptions(file).opening.title, 'first');
  writeFileSync(file, doc('second'));
  utimesSync(file, new Date(), new Date(Date.now() + 5000));
  assert.equal(loadCaptions(file).opening.title, 'second');
});

test('story: an edit that keeps the same timestamp still shows, and the served hash always matches the served wording (one read)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'story-'));
  const file = join(dir, 'captions.md');
  const slide = (t) => `# Opening Slide\n\n## Header\nh\n\n## Title\n${t}\n\n## Lead\nl\n\n## Column A: a\n- x\n\n## Column B: b\n- y\n\n## Verdict\nv\n\n---\n\n`;
  const doc = (t) => slide(t) + slide('c').replace('# Opening Slide', '# Closing Slide');
  writeFileSync(file, doc('first')); const when = new Date(Date.now() - 60_000); utimesSync(file, when, when);
  const a = captionsResponse(file).body;
  assert.equal(a.opening.title, 'first'); assert.equal(a.sourceSha256, createHash('sha256').update(readFileSync(file)).digest('hex'));
  writeFileSync(file, doc('other')); utimesSync(file, when, when);            // new bytes, the very same timestamp
  const b = captionsResponse(file).body;
  assert.equal(b.opening.title, 'other'); assert.notEqual(b.sourceSha256, a.sourceSha256);
});

test('story: no console screenshot is tracked in video/ (the repo is public)', () => {
  let tracked = null;
  try { tracked = execFileSync('git', ['ls-files', '--', 'video/assets', '*.jpg', '*.jpeg', '*.png'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { /* no git here: nothing to check */ }
  if (tracked) assert.deepEqual(tracked, []);
});

test('story: the running server answers GET /api/captions with the wording; /api/story (the cast story) is unchanged', async () => {
  const { withServer, get } = await import('./helpers.js');
  await withServer(async (url) => {
    const r = await get(url, '/api/captions');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const body = await r.json();
    assert.ok(body.opening.title && body.steps.ma1 && body.sourceSha256);
    const s = await (await get(url, '/api/story?vertical=retail')).json();
    assert.equal(s.cast.castBrand, 'Northwind Retail');   // the lab's own cast story route untouched
  });
});
