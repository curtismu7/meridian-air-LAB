// Owner, 2026-11-09: keep the Agent to agent page (#page-a2a). It opens for the A2A use cases (UC2 runs here; Preview here on a hand-off) and shows the
// delegation hops of the run. These pins fail if a later change stops UC2 opening it or drops the two delegation hops it shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MANIFEST } from '../src/manifest.js';
import { VERTICALS } from '../src/cast.js';
import { runUseCase } from '../src/flow.js';
import { routeOf } from '../src/routes.js';

test('the A2A use cases open the Agent to agent page, and MA4 still runs the A2A delegation hops', () => {
  const opensA2a = MANIFEST.usecases.filter((u) => u.opens === 'a2a').map((u) => u.id).sort();
  assert.deepEqual(opensA2a, ['MA4']);
  const uc = MANIFEST.usecases.find((u) => u.id === 'MA4');
  const run = runUseCase(uc, { cast: VERTICALS.airlines, vertical: 'airlines', seed: 'run' });
  assert.equal(run.outcome, 'PERMIT_THEN_DENY');
  assert.deepEqual(run.hops.filter((h) => h.kind.startsWith('a2a-')).map((h) => h.kind), ['a2a-agent-card', 'a2a-exchange-1', 'a2a-exchange-2', 'a2a-mismatch-probe', 'a2a-protocol-bearer', 'a2a-protocol-message']);
});

// The page opens only after a use case runs IN this app, so at least one A2A use case must not be a Hand off (or a Guide). Owner, 2026-11-09:
// the A2A scene runs here (route from data/handoff.json) to keep #page-a2a reachable from the chat.
test('at least one A2A use case runs here, so the Agent to agent page can open from the chat; MA4 is Here + go deeper', () => {
  const here = MANIFEST.usecases.filter((u) => u.opens === 'a2a' && ['Here', 'Here + go deeper'].includes(routeOf(u.id).route)).map((u) => u.id);
  assert.ok(here.length >= 1, 'no use case that opens the A2A page runs here');
  assert.deepEqual(routeOf('MA4'), { route: 'Here + go deeper', app: 'meridian-a2a-hop', basis: 'the A2A hop lab shows this flow deeper' });
});
