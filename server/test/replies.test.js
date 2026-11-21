import test from 'node:test';
import assert from 'node:assert/strict';
import { MANIFEST, findUseCase } from '../src/manifest.js';
import { VERTICALS, PERSONAS, loadCast, toolFor, unfilled } from '../src/cast.js';
import { runUseCase } from '../src/flow.js';
import { REPLIES, proposalFor, replyFor, templateFor, valuesFor } from '../src/replies.js';
import { SITUATIONS } from '../src/situations.js';

const run = (id, vertical = 'airlines', persona = 'standard') => runUseCase(findUseCase(id), { cast: loadCast(null, vertical), vertical, persona, seed: 't' });
const kindBody = (r, kind) => r.hops.find((h) => h.kind === kind && h.verdict !== 'skip')?.response?.body;
const replyOf = (r) => kindBody(r, 'agent-reply')?.reply;

// Every tool a vertical can run: the catalog's primary tools swapped for the vertical's own (toolFor), plus the everyday read tool used when a
// use case names none.
const toolsOf = (cast) => new Set([cast.castReadTool, ...MANIFEST.usecases.filter((u) => u.primaryTool).map((u) => toolFor(cast, u.primaryTool))]);

test('every tool used by any vertical has a reply template, and every {{name}} in it is filled for both personas', () => {
  for (const [v, cast] of Object.entries(VERTICALS)) {
    for (const tool of toolsOf(cast)) {
      const t = templateFor(v, tool);
      assert.equal(typeof t, 'string', `${v} ${tool}: no reply template`);
      for (const persona of PERSONAS) {
        const values = valuesFor({ cast, vertical: v, persona, tool, amount: 600, args: {} });
        assert.deepEqual(unfilled(t, values), [], `${v} ${tool} ${persona}`);
        const said = replyFor({ cast, vertical: v, persona, tool, amount: 600 });
        assert.doesNotMatch(said, /mock result|\{\{|undefined|null/, `${v} ${tool} ${persona}: ${said}`);
        assert.ok(!said.includes(tool), `${v} ${tool}: the reply does not name the tool`);
      }
    }
    for (const t of Object.values(REPLIES.proposals[v] || {})) assert.deepEqual(unfilled(t, valuesFor({ cast, vertical: v, persona: 'standard' })), [], `${v} proposal`);
  }
  for (const t of [REPLIES.fallback, REPLIES.proposalFallback]) assert.deepEqual(unfilled(t, valuesFor({ cast: VERTICALS.airlines, vertical: 'airlines', persona: 'standard' })), []);
});

test('an unknown tool gets the generic sentence, never "mock result of <tool>"', () => {
  const said = replyFor({ cast: VERTICALS.airlines, vertical: 'airlines', persona: 'standard', tool: 'no_such_tool' });
  assert.equal(said, 'Done: I checked your booking and everything is in order.');
  assert.equal(proposalFor({ cast: VERTICALS.airlines, vertical: 'airlines', persona: 'standard', tool: 'no_such_tool' }), 'I have this request ready to go.');
  assert.equal(templateFor('banking', '__proto__'), null);
  assert.equal(templateFor('__proto__', 'get_account_balance'), null);
});

test('the engine replies read like a real agent, with lab-invented amounts, deterministic per vertical and persona', () => {
  // Reply selection: the manifest's primaryTool maps to a reply template; MA1 (booking__book-seat) has no direct template in banking, so it takes the closest.
  assert.match(replyOf(run('MA6')), /Refund of \$4,120 issued to the SkyMiles account/);
  assert.match(replyOf(run('MA10')), /Refund|Pipeline|booking/);
  assert.match(replyOf(run('MA1')), /Seat 12A on MER 114 is confirmed/);
  assert.equal(replyOf(run('MA1')), replyOf(run('MA1')), 'repeats exactly');
});

test('a held transfer says what the agent is ready to do with the amount; the refusal text is unchanged', () => {
  // MA6 with a premium persona still CIBAs; the held path shows the proposal. MA3 denies on rate limit.
  const held = run('MA3');
  assert.equal(held.outcome, 'DENY_429');
  assert.equal(replyOf(held), undefined, 'a refused run has no agent reply');
  const denied = run('MA7');
  assert.equal(denied.outcome, 'DENY');
  assert.match(kindBody(denied, 'tool-refused').reason, /aiguard/);
});

test('no run in any full vertical or persona says "mock result of" or leaves a {{name}} in a reply, proposal or tool result', () => {
  for (const v of Object.keys(VERTICALS)) for (const persona of PERSONAS) for (const uc of MANIFEST.usecases) {
    const r = runUseCase(uc, { cast: loadCast(null, v), vertical: v, persona, seed: 't' });
    for (const h of r.hops) {
      const s = JSON.stringify(h.response?.body ?? '');
      assert.doesNotMatch(s, /mock result of|\{\{/, `${v} ${persona} ${uc.id} ${h.kind}`);
    }
  }
});
