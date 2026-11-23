import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MANIFEST, findUseCase } from '../src/manifest.js';
import { HANDOFF, PROMPTS, ROUTE_KINDS, promptsFor, routeOf, validatePrompts, validateRoutes } from '../src/routes.js';
import { runUseCase } from '../src/flow.js';
import { loadCast, STUB_VERTICALS, VERTICALS } from '../src/cast.js';
import { get, withServer } from './helpers.js';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const raw = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
const count = (kind) => Object.values(HANDOFF.routes).filter((r) => r.route === kind).length;

test('handoff.json covers exactly the 11 catalog ids, one route each, in the owner counts (9 Here / 2 go deeper / 0 Hand off)', () => {
  const ids = MANIFEST.usecases.map((u) => u.id).sort();
  assert.equal(ids.length, 11);
  assert.deepEqual(Object.keys(HANDOFF.routes).sort(), ids);
  for (const r of Object.values(HANDOFF.routes)) assert.ok(ROUTE_KINDS.includes(r.route), r.route);
  assert.deepEqual([count('Here'), count('Here + go deeper'), count('Hand off'), count('Guide')], [9, 2, 0, 0]);
});

test('every Hand off and Here + go deeper row names an app; Here and Guide rows name none; app ids are plain ids', () => {
  for (const [id, r] of Object.entries(HANDOFF.routes)) {
    if (r.route === 'Hand off' || r.route === 'Here + go deeper') assert.match(String(r.app), /^[a-z0-9-]{2,40}$/, id);
    else assert.equal(r.app, null, id);
  }
  assert.deepEqual(routeOf('MA4'), { route: 'Here + go deeper', app: 'meridian-a2a-hop', basis: 'the A2A hop lab shows this flow deeper' });
  assert.deepEqual(routeOf('MA9'), { route: 'Here + go deeper', app: 'observability-lab', basis: 'the landscape query runs here against the live SIEM; the observability dashboard shows the whole stream deeper' });
  assert.equal(routeOf('__proto__').route, 'Here', 'an unknown id is never a key lookup on the object prototype');
});

test('the route validator refuses a missing id, an extra id, a Hand off without an app and an unknown route', () => {
  const good = raw('handoff.json');
  assert.deepEqual(validateRoutes(good), []);
  const drop = structuredClone(good); delete drop.routes.MA1; assert.match(validateRoutes(drop).join(), /MA1: no route/);
  const extra = structuredClone(good); extra.routes.MA999 = { route: 'Here', app: null, basis: null }; assert.match(validateRoutes(extra).join(), /MA999: not in the catalog/);
  const noApp = structuredClone(good); noApp.routes.MA4.app = null; assert.match(validateRoutes(noApp).join(), /MA4: Here \+ go deeper needs an app/);
  const bad = structuredClone(good); bad.routes.MA3.route = 'Elsewhere'; assert.match(validateRoutes(bad).join(), /MA3: route out of range/);
});

test('`also` is a second app on a Hand off row only; refused off any other route, when not an id, or when it repeats the app', () => {
  const good = raw('handoff.json');
  // No row in the shipped table is Hand off any more (MA9's landscape query runs here now); make one synthetic.
  const handoff = structuredClone(good); handoff.routes.MA9.route = 'Hand off'; handoff.routes.MA9.app = 'agentcore-pingone-demo';
  assert.deepEqual(validateRoutes(handoff), []);
  const also = structuredClone(handoff); also.routes.MA9.also = 'meridian-a2a-hop';
  assert.deepEqual(validateRoutes(also), []);
  assert.equal(also.routes.MA9.also, 'meridian-a2a-hop');
  const onHere = structuredClone(good); onHere.routes.MA1.also = 'agentcore-pingone-demo'; assert.match(validateRoutes(onHere).join(), /MA1: also is not a second app/);
  const onDeeper = structuredClone(good); onDeeper.routes.MA9.also = 'meridian-a2a-hop'; assert.match(validateRoutes(onDeeper).join(), /MA9: also is not a second app/);
  const notId = structuredClone(handoff); notId.routes.MA9.also = 'https://x.invalid/'; assert.match(validateRoutes(notId).join(), /MA9: also/);
  const same = structuredClone(handoff); same.routes.MA9.also = 'agentcore-pingone-demo'; assert.match(validateRoutes(same).join(), /MA9: also/);
});

test('airlines prompts are the catalog chip text verbatim', () => {
  for (const e of PROMPTS.verticals.airlines) {
    const uc = findUseCase(e.uc);
    assert.equal(uc.trigger.type, 'chip', e.uc);
    assert.equal(e.text, uc.trigger.text, e.uc);
  }
});

test('every shown prompt runs here or hands off; either way, in its vertical the engine (or Preview here) reaches the catalog outcome', () => {
  for (const [vertical, list] of Object.entries(PROMPTS.verticals)) {
    assert.ok(list.filter((e) => routeOf(e.uc).route !== 'Hand off').length >= 8, `${vertical}: at least eight prompts run here`);
    assert.ok(list.filter((e) => ['Hand off', 'Here + go deeper'].includes(routeOf(e.uc).route)).length >= 1, `${vertical}: at least one prompt goes deeper or hands off`);
    for (const e of list) {
      const uc = findUseCase(e.uc);
      assert.ok(['Here', 'Here + go deeper', 'Hand off'].includes(routeOf(uc.id).route), `${vertical} ${e.uc} runs here or hands off (never a guide)`);
      const r = runUseCase(uc, { cast: loadCast(null, vertical), vertical, seed: 'prompts' });
      if (r.kind === 'guided') continue; // a guided scene shows its own page; the lab does not recompute it (catalog label)
      assert.equal(r.kind, 'flow', `${vertical} ${e.uc}`);
      assert.equal(r.outcome, uc.expectedOutcome, `${vertical} ${e.uc}`);
      assert.equal(r.matchesExpected, true, `${vertical} ${e.uc}`);
      assert.ok(r.hops.length > 0 && r.hops.every((h) => h.title && h.narrative), `${vertical} ${e.uc} hops carry full detail`);
    }
  }
});

test('healthcare and retail have their own wording for the same use cases as airlines, and no vertical repeats a prompt', () => {
  const ucs = (v) => PROMPTS.verticals[v].map((e) => e.uc).sort();
  assert.deepEqual(Object.keys(PROMPTS.verticals).sort(), Object.keys(VERTICALS).sort());
  assert.deepEqual(ucs('healthcare'), ucs('airlines'));
  assert.deepEqual(ucs('retail'), ucs('airlines'));
  assert.deepEqual(ucs('banking'), ucs('airlines'));
  for (const v of ['banking', 'healthcare', 'retail']) {
    const base = new Set(PROMPTS.verticals.airlines.map((e) => e.text));
    assert.ok(PROMPTS.verticals[v].filter((e) => base.has(e.text)).length === 0, `${v} is not the airlines text`);
  }
  const dup = structuredClone(raw('prompts.json')); dup.verticals.retail[1].text = dup.verticals.retail[0].text.toUpperCase();
  assert.match(validatePrompts(dup).join(), /retail: duplicate prompt/);
  const unknown = structuredClone(raw('prompts.json')); unknown.verticals.airlines[0].uc = 'MA999';
  assert.match(validatePrompts(unknown).join(), /airlines: unknown use case/);
});

test('GET /api/prompts gives the vertical prompts with title, outcome and route; a stub vertical has none; a bad vertical is 400 and not echoed', async () => {
  await withServer(async (url) => {
    const r = await get(url, '/api/prompts?vertical=healthcare'); const j = await r.json();
    assert.equal(r.status, 200); assert.equal(j.pack, 'full'); assert.equal(j.prompts.length, PROMPTS.verticals.healthcare.length);
    assert.deepEqual(j.prompts[0], promptsFor('healthcare')[0]);
    assert.deepEqual(Object.keys(j.prompts[0]).sort(), ['expectedOutcome', 'route', 'text', 'title', 'track', 'uc']);
    assert.equal((await (await get(url, '/api/prompts')).json()).vertical, 'airlines');
    const stub = Object.keys(STUB_VERTICALS)[0];
    const s = await (await get(url, `/api/prompts?vertical=${stub}`)).json();
    assert.equal(s.pack, 'stub'); assert.deepEqual(s.prompts, []);
    const bad = await get(url, '/api/prompts?vertical=%3Cscript%3E'); assert.equal(bad.status, 400); assert.ok(!(await bad.text()).includes('script'));
  });
});

test('GET /api/usecases carries each use case route', async () => {
  await withServer(async (url) => {
    const j = await (await get(url, '/api/usecases')).json();
    const all = j.tracks.flatMap((t) => t.usecases);
    assert.equal(all.length, 11);
    for (const u of all) assert.deepEqual(u.route, HANDOFF.routes[u.id], u.id);
  });
});

// docs/use-case-routing.md is the owner's routing table (copied unchanged); it is the source of truth for data/handoff.json. Every row must match.
const TABLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/use-case-routing.md');
function parseRoutingTable(md) {
  const rows = {};
  let cols = null;
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) { cols = null; continue; }
    const cells = line.slice(1, line.lastIndexOf('|')).split('|').map((c) => c.trim());
    if (cells[0] === 'MA') { cols = cells; continue; }
    if (!cols || /^-+$/.test(cells[0])) continue;
    const at = (name) => cells[cols.indexOf(name)];
    assert.ok(!Object.hasOwn(rows, cells[0]), `${cells[0]} appears twice in the routing table`);
    // "a / b" in the App column: app a, with b offered as a second choice (handoff.json `also`).
    const [app, also] = (at('App') || '').split(' / ');
    rows[cells[0]] = { route: at('Route'), app: app || null, basis: at('Basis') || null, ...(also ? { also } : {}) };
  }
  return rows;
}
const sameRoutes = (table, routes) => {
  const ids = Object.keys(table).sort();
  assert.deepEqual(Object.keys(routes).sort(), ids, 'the same ids');
  for (const id of ids) assert.deepEqual(routes[id], table[id], `${id}: handoff.json equals the routing table row (route, app, basis)`);
};

test('docs/use-case-routing.md: all 11 rows equal data/handoff.json (route, app, basis); swapping two rows in the data fails', () => {
  const table = parseRoutingTable(fs.readFileSync(TABLE, 'utf8'));
  assert.equal(Object.keys(table).length, 11);
  assert.deepEqual(Object.keys(table).sort(), MANIFEST.usecases.map((u) => u.id).sort());
  sameRoutes(table, raw('handoff.json').routes);
  // mutation: swap the routes of a Hand off row and a Here row
  const swapped = structuredClone(raw('handoff.json').routes);
  [swapped.MA1, swapped.MA9] = [swapped.MA9, swapped.MA1];
  assert.throws(() => sameRoutes(table, swapped), /MA1/);
  const moved = structuredClone(raw('handoff.json').routes); moved.MA9.app = 'meridian-a2a-hop';
  assert.throws(() => sameRoutes(table, moved), /MA9/);
});
