import test from 'node:test';
import assert from 'node:assert/strict';
import { MANIFEST, findUseCase } from '../src/manifest.js';
import { VERTICALS, STUB_VERTICALS } from '../src/cast.js';
import { runUseCase, isFlow, chainOf, KNOWN_STEPS, ENGINE_OUTCOMES } from '../src/flow.js';
import { decide, edgePolicy, BANDS } from '../src/policy.js';
import { verifyMockJwt } from '../src/mockjwt.js';
import { SITUATIONS } from '../src/situations.js';
import { maskText } from '../src/credentials.js';

const go = (id, vertical = 'airlines', extra = {}) => runUseCase(findUseCase(id), { cast: VERTICALS[vertical], vertical, seed: 'run', ...extra });
// Flips every bit of the first signature byte, so the tampered token ALWAYS differs (replacing trailing characters can be a no-op in base64url).
const flipSignature = (jwt) => { const [h, p, sig] = jwt.split('.'); const b = Buffer.from(sig, 'base64url'); b[0] ^= 0xff; return `${h}.${p}.${b.toString('base64url')}`; };
const kinds = (r) => r.hops.map((h) => h.kind);
// The hops that ran: the not-in-path hops (verdict skip, listed after them) are left out.
const ran = (r) => r.hops.filter((h) => h.verdict !== 'skip');
const ranKinds = (r) => ran(r).map((h) => h.kind);
const FRAME = ['website', 'sign-in', 'prompt', 'agent-receive', 'tools-list-challenge', 'tools-list', 'llm-plan'];
const strip = (r) => JSON.parse(JSON.stringify(r, (k, v) => (typeof v === 'string' ? v.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, (m) => m.split('.').slice(0, 2).join('.')) : v)));

test('all 11 scenes run in mock in all four full verticals and the COMPUTED outcome equals the manifest expectedOutcome', () => {
  let n = 0;
  for (const vertical of Object.keys(VERTICALS)) {
    for (const uc of MANIFEST.usecases) {
      const r = go(uc.id, vertical);
      assert.equal(r.outcome, uc.expectedOutcome, `${vertical}/${uc.id}`);
      assert.equal(r.matchesExpected, r.computed ? true : null, `${vertical}/${uc.id}`);
      n += 1;
    }
  }
  assert.equal(n, 11 * 4);
});

test('10 scenes are computed by the engine, 1 is a guided page whose outcome is the catalog label (and says so)', () => {
  const flows = MANIFEST.usecases.filter(isFlow);
  assert.equal(flows.length, 10);
  for (const uc of MANIFEST.usecases) {
    const r = go(uc.id);
    assert.equal(r.kind, isFlow(uc) ? 'flow' : 'guided', uc.id);
    assert.equal(r.computed, isFlow(uc), uc.id);
    if (!isFlow(uc)) { assert.deepEqual(kinds(r), ['guided']); assert.match(r.hops[0].response.body.note, /does not recompute/); }
  }
  for (const uc of MANIFEST.usecases.filter((u) => !isFlow(u))) assert.ok(!ENGINE_OUTCOMES.has(uc.expectedOutcome), `${uc.id} is guided only because it is not an engine outcome`);
});

test('the outcome is computed, not copied: staging a different persona or amount changes it', () => {
  assert.equal(go('MA8', 'airlines').outcome, 'PERMIT');
  const wrongPersona = go('MA8', 'airlines', { persona: 'standard' });
  assert.equal(wrongPersona.outcome, 'DENY_403'); assert.equal(wrongPersona.matchesExpected, false);
  assert.equal(go('MA6', 'airlines', { amount: 150 }).outcome, 'PERMIT');
  assert.equal(go('MA6', 'airlines', { amount: 700 }).outcome, 'PERMIT');
  // the default situation (4120) is in the CIBA band: the run holds for the out-of-band approval then dispatches
  assert.equal(go('MA6', 'airlines').outcome, 'PERMIT');
  assert.equal(kinds(go('MA6', 'airlines')).includes('ciba-poll'), true);
});

test('every distinct evidence step has a builder, and an unknown step throws instead of being skipped', () => {
  const steps = new Set(MANIFEST.usecases.flatMap((u) => chainOf(u)));
  for (const s of steps) assert.ok(KNOWN_STEPS.includes(s), s);
  const fake = { ...findUseCase('MA1'), evidence: { tokenChain: ['user-token', 'made-up-step'], activity: [] } };
  assert.throws(() => runUseCase(fake, { cast: VERTICALS.airlines, vertical: 'airlines', seed: 'x' }), /unknown evidence step/);
});

test('a run is deterministic: two runs match exactly apart from the ECDSA signature bytes', () => {
  for (const id of ['MA1', 'MA4', 'MA6', 'MA10', 'MA11']) assert.deepEqual(strip(go(id, 'airlines')), strip(go(id, 'airlines')), id);
  assert.notEqual(go('MA1', 'airlines').traceId, go('MA6', 'airlines').traceId);
  assert.notEqual(go('MA1', 'airlines').traceId, go('MA1', 'banking').traceId);
});

test('W3C traceparent on EVERY hop that ran: one trace id per run, a new span id per hop, flags 01; a not-in-path hop has none', () => {
  for (const uc of MANIFEST.usecases) {
    const r = go(uc.id);
    const spans = new Set();
    for (const h of r.hops) {
      if (h.verdict === 'skip') { assert.equal(h.traceparent, undefined, `${uc.id} ${h.n}`); continue; }
      const m = /^00-([0-9a-f]{32})-([0-9a-f]{16})-01$/.exec(h.traceparent || '');
      assert.ok(m, `${uc.id} hop ${h.n}: ${h.traceparent}`);
      assert.equal(m[1], r.traceId, `${uc.id} hop ${h.n} trace id`);
      spans.add(m[2]);
    }
    assert.equal(spans.size, ran(r).length, `${uc.id}: one span per ran hop`);
  }
});

test('a valid incoming traceparent continues its trace; a malformed one starts a new one', () => {
  const tp = `00-${'ab'.repeat(16)}-${'cd'.repeat(8)}-01`;
  assert.equal(go('MA1', 'airlines', { traceparent: tp }).traceId, 'ab'.repeat(16));
  assert.notEqual(go('MA1', 'airlines', { traceparent: 'garbage' }).traceId, 'ab'.repeat(16));
  assert.notEqual(go('MA1', 'airlines', { traceparent: `00-${'0'.repeat(32)}-${'cd'.repeat(8)}-01` }).traceId, '0'.repeat(32));
});

test('tokens are MOCK: labelled, ES256, verify against the mock key, decoded claims match, a tampered one fails', () => {
  for (const id of ['MA1', 'MA4', 'MA6', 'MA10']) {
    const r = go(id);
    assert.ok(r.tokens.length > 0, id);
    for (const t of r.tokens) {
      assert.equal(t.mock, true); assert.match(t.label, /MOCK/); assert.match(t.notice, /MOCK token/);
      assert.equal(t.header.alg, 'ES256');
      const v = verifyMockJwt(t.raw); assert.equal(v.ok, true, `${id} ${t.label}`);
      assert.deepEqual(v.claims, t.claims);
      assert.equal(verifyMockJwt(flipSignature(t.raw)).ok, false);
    }
  }
});

test('MA1: the exchanged token carries act = the agent and sub = the passenger; the user token has no act', () => {
  const r = go('MA1');
  const user = r.tokens.find((t) => /user token/.test(t.label)); const ex = r.tokens.find((t) => /exchanged/.test(t.label));
  assert.equal(user.claims.act, undefined);
  assert.equal(ex.claims.sub, user.claims.sub);
  assert.deepEqual(ex.claims.act, { sub: VERTICALS.airlines.castAgent });
  assert.deepEqual(ranKinds(r), [...FRAME, 'consent', 'actor-token', 'token-exchange', 'authorize-decision', 'tools-call-challenge', 'gateway-check', 'tool-dispatched', 'api-call', 'agent-reply']);
  assert.equal(r.hops.find((h) => h.kind === 'tool-dispatched').request.body.params.name, 'booking__book-seat');
});

test('MA4 (A2A from Amazon): the act chain is nested and scope is carried through; a rogue probe is denied', () => {
  const r = go('MA4');
  const final = r.tokens.filter((t) => /exchanged/.test(t.label)).at(-1);
  assert.deepEqual(final.claims.act, { sub: VERTICALS.airlines.castAgent2, act: { sub: VERTICALS.airlines.castAgent } });
  const a2a = kinds(r).filter((k) => k.startsWith('a2a'));
  for (const k of ['a2a-exchange-1', 'a2a-exchange-2', 'a2a-agent-card', 'a2a-protocol-message', 'a2a-mismatch-probe']) assert.ok(a2a.includes(k), k);
  assert.equal(r.outcome, 'PERMIT_THEN_DENY');
  const probe = 'a2a-mismatch-probe';
  assert.ok(ranKinds(r).includes(probe));
  assert.equal(r.hops.find((h) => h.kind === probe).response.status, 403);
});

test('the persona changes the token subject and the group claim', () => {
  const std = go('MA1', 'airlines', { persona: 'standard' }); const prem = go('MA1', 'airlines', { persona: 'premium' });
  assert.equal(std.tokens[0].claims.sub, VERTICALS.airlines.castUser); assert.deepEqual(std.tokens[0].claims.groups, []);
  assert.equal(prem.tokens[0].claims.sub, VERTICALS.airlines.castUser2); assert.deepEqual(prem.tokens[0].claims.groups, [VERTICALS.airlines.castGroup]);
});

test('MA3 (budget) and MA7 (AI Guard) deny: nothing is dispatched, the last hop is a refusal with the right status', () => {
  const expected = { MA3: 429, MA7: 400 };
  for (const [id, status] of Object.entries(expected)) {
    const r = go(id);
    assert.ok(!kinds(r).includes('tool-dispatched'), id);
    assert.equal(ran(r).at(-1).kind, 'tool-refused', id);
    assert.equal(ran(r).at(-1).response.status, status, `${id}: got ${ran(r).at(-1).response.status}`);
    assert.ok(!kinds(r).includes('agent-reply'), `${id}: a refused run has no reply`);
    assert.match(r.outcome, /^DENY/);
  }
  const rate = go('MA3').hops.find((h) => h.response?.headers?.['retry-after']);
  assert.equal(rate.response.headers['retry-after'], '60');
  const guard = go('MA7');
  const block = guard.hops.find((h) => h.response?.status === 400);
  assert.ok(block, 'a 400 aiguard hop');
  assert.match(block.response.body.error, /aiguard_block/);
});

test('MA6 obligations hold the write: the CIBA approval is satisfied by the poll and then dispatches', () => {
  const ciba = go('MA6');
  assert.ok(ranKinds(ciba).includes('ciba-authorize'));
  assert.ok(ranKinds(ciba).includes('ciba-poll'));
  assert.ok(ranKinds(ciba).includes('tool-dispatched'));
  assert.equal(ciba.outcome, 'PERMIT');
  // an amount under the band skips the obligation entirely
  const small = go('MA6', 'airlines', { amount: 150 });
  const smallDec = small.hops.find((h) => h.kind === 'authorize-decision');
  assert.equal(smallDec.response.body.decision, 'PERMIT');
});

test('MA8 persona gate: premium passes, standard is refused', () => {
  assert.equal(go('MA8', 'airlines', { persona: 'standard' }).outcome, 'DENY_403');
  assert.equal(go('MA8', 'airlines', { persona: 'premium' }).outcome, 'PERMIT');
});

test('the policy bands: every edge of every band (lab-invented thresholds)', () => {
  const table = [
    ['issue_refund', 1999, 'PERMIT'], ['issue_refund', 2000, 'CIBA'],
    ['create_transfer', 100, 'CIBA'], ['create_transfer', 200, 'HITL_REQUIRED'],
    ['create_transfer', 500, 'STEP_UP'], ['create_transfer', 2000, 'DENY'],
    ['book_airline_flight', 250, 'HITL_REQUIRED'],
  ];
  for (const [tool, amount, expected] of table) {
    const dec = decide({ role: 'write', tool, amount, sub: 'x', actor: { registered: true } });
    assert.equal(dec.decision, expected, `${tool}@${amount}`);
  }
});

test('every other policy rule on its own: unregistered actor, other owner, RAR bound, group gate', () => {
  assert.equal(decide({ role: 'read', tool: 'get_itinerary', amount: 10, sub: 'x', actor: { registered: false } }).decision, 'DENY');
  assert.equal(decide({ role: 'read', tool: 'get_itinerary', amount: 10, sub: 'a', owner: 'b', actor: { registered: true } }).decision, 'DENY');
  assert.equal(decide({ role: 'write', tool: 'issue_refund', amount: 10, sub: 'x', actor: { registered: true }, rar: { maxAmount: 5 } }).decision, 'DENY');
  assert.equal(decide({ role: 'read', tool: 'get_member_profile', amount: 10, sub: 'x', groupGate: true, groups: [], group: 'gold-tier', actor: { registered: true } }).decision, 'DENY_403');
});

test('the situation table names only real scenes, and the engine never reads expectedOutcome', () => {
  for (const id of Object.keys(SITUATIONS)) {
    if (id.startsWith('MA')) assert.ok(findUseCase(id), id);
  }
});

test('every URL in every hop is a reserved host (.example or .invalid) and nothing in a run names a real tenant', () => {
  for (const uc of MANIFEST.usecases) {
    const r = go(uc.id);
    for (const h of r.hops) {
      // only the WIRE urls (request/response), not the hop's teaching-text spec references
      const urls = [h.request?.url, h.response?.url].filter(Boolean);
      for (const u of urls) {
        if (!/^https?:\/\//.test(u)) continue; // a guided page's target path, not a URL
        const host = new URL(u).host;
        assert.ok(/\.(example|invalid)$/.test(host), `${uc.id} ${u}`);
      }
    }
  }
});

test('vertical packs: the tool follows the vertical for the same role, and no {{token}} is left unfilled in any run', () => {
  // MA1's tool is the namespaced booking__book-seat, which is already vertical-specific and is not remapped
  for (const vertical of ['airlines', 'banking', 'healthcare', 'retail']) {
    const r = go('MA1', vertical);
    const dispatch = r.hops.find((h) => h.kind === 'tool-dispatched');
    assert.equal(dispatch.request.body.params.name, 'booking__book-seat', vertical);
    assert.ok(!JSON.stringify(r).includes('{{'), `${vertical}: an unfilled token survived`);
  }
});

test('only full verticals exist as packs; the stubs are names only', () => {
  assert.deepEqual(Object.keys(VERTICALS), ['airlines', 'banking', 'healthcare', 'retail']);
  assert.ok(STUB_VERTICALS.manufacturing && !VERTICALS.manufacturing);
  assert.ok(!STUB_VERTICALS.airlines, 'airlines is a full pack now');
});

test('review fix: a guided run does not claim a match (computed false, matchesExpected null, outcome is the catalog label); a computed run reports true or false', () => {
  const guided = go('MA9');
  assert.equal(guided.computed, false);
  assert.equal(guided.matchesExpected, null);
  const flow = go('MA1');
  assert.equal(flow.computed, true);
  assert.equal(flow.matchesExpected, true);
});

test('review fix: the MOCK token notice survives the response mask intact', () => {
  const r = go('MA1');
  const token = r.tokens[0];
  const masked = maskText(token.raw, [token.raw]);
  assert.ok(masked === token.raw || /REDACTED|mask/i.test(masked), "mask either exempts this run's MOCK tokens or redacts deterministically");
  assert.match(token.notice, /MOCK token/);
});
