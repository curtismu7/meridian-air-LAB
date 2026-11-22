// MA11's SIEM evidence leg (siem.js): config guards, marker derivation, search shaping and the honest
// empty case. Every fetch is a fake; no test reaches a network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { siemConfig, markerFor, findEvidence, SIEM_INDEX } from '../src/siem.js';

// A fake-shaped key (matches siemConfig's shape check, gitleaks-allowlisted as a test fixture, not a credential).
const FAKE_KEY = 'test' + '-key-' + 'fixture'.repeat(4) + 'AA==';
const GOOD = { MA_SIEM_URL: 'http://127.0.0.1:9200', MA_SIEM_READ_APIKEY: FAKE_KEY };

test('siemConfig: unset means the leg is off; half-configured is refused by name', () => {
  assert.equal(siemConfig({}).ok, false);
  assert.match(siemConfig({}).problem, /not configured/);
  const half = siemConfig({ MA_SIEM_URL: 'http://127.0.0.1:9200' });
  assert.equal(half.ok, false);
  assert.match(half.problem, /MA_SIEM_READ_APIKEY is set but|MA_SIEM_URL is set but/);
  const half2 = siemConfig({ MA_SIEM_READ_APIKEY: GOOD.MA_SIEM_READ_APIKEY });
  assert.equal(half2.ok, false);
  assert.match(half2.problem, /MA_SIEM_URL is set but|MA_SIEM_READ_APIKEY is set but/);
});

test('siemConfig: loopback only, origin only, no credentials in the URL, key shape checked', () => {
  for (const [s, re] of [
    [{ MA_SIEM_URL: 'http://siem.example.com:9200', MA_SIEM_READ_APIKEY: GOOD.MA_SIEM_READ_APIKEY }, /not loopback/],
    [{ MA_SIEM_URL: 'http://127.0.0.1:9200/some/path', MA_SIEM_READ_APIKEY: GOOD.MA_SIEM_READ_APIKEY }, /origin only/],
    [{ MA_SIEM_URL: 'http://u:p@127.0.0.1:9200', MA_SIEM_READ_APIKEY: GOOD.MA_SIEM_READ_APIKEY }, /credentials or a query/],
    [{ MA_SIEM_URL: 'ftp://127.0.0.1:9200', MA_SIEM_READ_APIKEY: GOOD.MA_SIEM_READ_APIKEY }, /not http/],
    [{ MA_SIEM_URL: 'http://127.0.0.1:9200', MA_SIEM_READ_APIKEY: 'short' }, /API key/],
  ]) assert.match(siemConfig(s).problem, re);
  assert.equal(siemConfig(GOOD).ok, true);
  assert.equal(siemConfig(GOOD).base, 'http://127.0.0.1:9200');
});

test('markerFor: derived from the trace id, stable and per-run', () => {
  const m1 = markerFor('00-91388f3790148e417d62c8bd3991c66d-33991c66d0eeb5ad-01');
  assert.match(m1, /^meridian-air-[0-9a-f]{12}$/);
  assert.equal(m1, markerFor('00-91388f3790148e417d62c8bd3991c66d-33991c66d0eeb5ad-01'));
  assert.notEqual(m1, markerFor('00-ffffffffffffffffffffffffffffffff-ffffffffffffffff-01'));
});

function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error('unexpected extra fetch');
    if (r.throw) throw r.throw;
    return { status: r.status ?? 200, json: async () => r.json, headers: new Map() };
  };
  return { fetchImpl, calls };
}

const HIT = (id, src) => ({ _id: id, _index: SIEM_INDEX, _source: src });

test('findEvidence: one read-only search to the index with the ApiKey header; matched hits come back', async () => {
  const { fetchImpl, calls } = fakeFetch([{ json: { hits: { hits: [HIT('a', { event_type: 'policy-decision-log', Decision: 'permit' })] } } }]);
  const r = await findEvidence({ cfg: siemConfig(GOOD), marker: markerFor('00-91388f3790148e417d62c8bd3991c66d-33991c66d0eeb5ad-01'), from: Date.now() - 60_000, to: Date.now() + 60_000, fetchImpl });
  assert.equal(r.kind, 'ok');
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].source.Decision, 'permit');
  assert.equal(calls.length, 1);
  const c = calls[0];
  assert.equal(c.url, `${GOOD.MA_SIEM_URL}/${SIEM_INDEX}/_search`);
  assert.equal(c.init.method, 'POST');
  assert.match(c.init.headers.authorization, /^ApiKey /);
  assert.equal(c.init.redirect, 'manual');
  const body = JSON.parse(c.init.body);
  assert.match(JSON.stringify(body.query), /meridian-air-0091388f3790/);
  assert.ok(body.sort);
  assert.ok(body.size <= 20);
});

test('findEvidence: empty is honest — no matched, the time-window records are inferred and labelled', async () => {
  const { fetchImpl, calls } = fakeFetch([{ json: { hits: { hits: [] } } }, { json: { hits: { hits: [HIT('b', { event_type: 'proxy-audit-log' })] } } }]);
  const r = await findEvidence({ cfg: siemConfig(GOOD), marker: 'meridian-air-000000000000', from: Date.now() - 60_000, to: Date.now() + 60_000, fetchImpl });
  assert.equal(r.kind, 'empty');
  assert.equal(r.matched.length, 0);
  assert.equal(r.inferred.length, 1);
  assert.match(r.note, /no SIEM record carries this run's marker yet/);
  assert.match(r.note, /inferred/);
  assert.equal(calls.length, 2); // the marker query, then the time-window query
});

test('findEvidence: 401 and unreachable are named, never retried', async () => {
  const { fetchImpl } = fakeFetch([{ status: 401, json: { error: {} } }]);
  const r1 = await findEvidence({ cfg: siemConfig(GOOD), marker: 'm', fetchImpl });
  assert.equal(r1.kind, 'refused');
  assert.match(r1.note, /read key/);
  const { fetchImpl: f2 } = fakeFetch([{ throw: new Error('connect ECONNREFUSED') }]);
  const r2 = await findEvidence({ cfg: siemConfig(GOOD), marker: 'm', fetchImpl: f2 });
  assert.equal(r2.kind, 'unreachable');
});
