// The gateway client's safe retry: the read-only setup calls (initialize, notifications/initialized, tools/list) are re-sent when the gateway gives no
// answer or a 502/503/504; a tools/call is never re-sent (a booking could be made twice); 401/403/428 are answers and are never retried.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatewaySession } from '../src/mcpClient.js';

const URL_ = 'http://127.0.0.1:9/mcp';
const rpcOk = (id, result = {}) => new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { status: 200, headers: { 'content-type': 'application/json' } });
// A fake gateway: `plan` is the list of answers for successive requests ('throw' = no answer, a number = that HTTP status, 'ok' = a JSON-RPC result).
function session(plan) {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    const message = JSON.parse(init.body); seen.push(message.method);
    const step = plan.length > 1 ? plan.shift() : plan[0];
    if (step === 'throw') throw new TypeError('fetch failed');
    if (step === 'ok') return rpcOk(message.id, message.method === 'tools/list' ? { tools: [{ name: 'get_flight_status' }] } : {});
    return new Response('', { status: step });
  };
  let n = 0;
  const gs = createGatewaySession({ url: URL_, token: 't', vertical: 'airlines', nextTraceparent: () => `00-${'a'.repeat(32)}-${(++n).toString(16).padStart(16, '0')}-01`, fetchImpl, retryPausesMs: [1, 1] });
  return { gs, seen };
}

test('initialize that gets no answer once is retried and then succeeds, and says it needed a second attempt', async () => {
  const { gs, seen } = session(['throw', 'ok']);
  const r = await gs.initialize();
  assert.equal(r.kind, 'ok'); assert.equal(r.attempts, 2); assert.deepEqual(seen, ['initialize', 'initialize']);
});

test('a 503 on tools/list is retried; an answer on the first try carries no attempts field', async () => {
  const a = session([503, 'ok']); const r = await a.gs.listTools();
  assert.equal(r.kind, 'ok'); assert.equal(r.attempts, 2);
  const b = session(['ok']); const first = await b.gs.initialize();
  assert.equal(first.kind, 'ok'); assert.equal('attempts' in first, false);
});

test('a gateway that never answers is tried three times, then reported unreachable', async () => {
  const { gs, seen } = session(['throw']);
  const r = await gs.initialize();
  assert.equal(r.kind, 'unreachable'); assert.equal(r.attempts, 3); assert.equal(seen.length, 3);
});

test('a tools/call is never re-sent, whatever the answer', async () => {
  for (const plan of [['throw', 'ok'], [503, 'ok'], [504, 'ok']]) {
    const { gs, seen } = session(plan);
    const r = await gs.callTool('book_airline_flight', { flight_number: 'UA502' });
    assert.equal(r.kind, 'unreachable'); assert.equal('attempts' in r, false); assert.deepEqual(seen, ['tools/call'], 'exactly one request');
  }
});

test('401, 403 and 428 are answers, not outages: no retry', async () => {
  for (const status of [401, 403, 428]) {
    const { gs, seen } = session([status, 'ok']);
    const r = await gs.initialize();
    assert.notEqual(r.kind, 'unreachable'); assert.equal(seen.length, 1, `HTTP ${status}`);
  }
});

test('no new attempt starts once the time budget is spent', async () => {
  const seen = [];
  const gs = createGatewaySession({ url: URL_, token: 't', vertical: 'airlines', nextTraceparent: () => `00-${'b'.repeat(32)}-${'1'.padStart(16, '0')}-01`, retryPausesMs: [1, 1], retryBudgetMs: 0,
    fetchImpl: async (_u, init) => { seen.push(JSON.parse(init.body).method); throw new TypeError('fetch failed'); } });
  const r = await gs.initialize();
  assert.equal(r.kind, 'unreachable'); assert.equal(seen.length, 1);
});
