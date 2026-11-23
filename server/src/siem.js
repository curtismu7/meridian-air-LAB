// MA11's Real SIEM leg: after a run, search the owner's Privilege SIEM Elasticsearch (index ping-siem-events-v2)
// for this run's evidence, matched by marker — never by guesswork. Read-only: one POST /<index>/_search per
// query, loopback origin only (the lab reaches the cluster through the owner's port-forward), redirects
// refused, answers capped, the key never returned or logged. The owner creates the read key
// (observability-LAB's scripts/make-read-key.sh pattern); the lab never mints one.
//   MA_SIEM_URL         the loopback origin, e.g. http://127.0.0.1:9200
//   MA_SIEM_READ_APIKEY the read-only API key (Authorization: ApiKey ...)
// Unset (all or none): MA11's Real path stays the honest refusal it has today.

import { isLoopbackHost } from './safety.js';

export const SIEM_INDEX = 'ping-siem-events-v2';
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 256 * 1024;

// The settings' presence check: all or none. Returns { ok, problem } in fixed words (never a value).
export const siemConfigured = (live) => siemConfig(live ?? {}).ok;

export function siemConfig(settings = {}) {
  const url = typeof settings.MA_SIEM_URL === 'string' ? settings.MA_SIEM_URL.trim() : '';
  const key = typeof settings.MA_SIEM_READ_APIKEY === 'string' ? settings.MA_SIEM_READ_APIKEY.trim() : '';
  if (!url && !key) return { ok: false, problem: 'not configured (MA_SIEM_URL and MA_SIEM_READ_APIKEY are unset)' };
  if (!url || !key) return { ok: false, problem: `half configured: ${!url ? 'MA_SIEM_URL' : 'MA_SIEM_READ_APIKEY'} is set but the other is not` };
  let u;
  try { u = new URL(url); } catch { return { ok: false, problem: 'MA_SIEM_URL is not a URL' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, problem: 'MA_SIEM_URL is not http(s)' };
  // Loopback, or host.docker.internal (the Mac, from Docker — the same exception the llama.cpp brain has; the owner's port-forward ends there either way).
  const host = u.hostname.toLowerCase();
  const loopbackish = isLoopbackHost(host) || host === 'host.docker.internal';
  if (!loopbackish) return { ok: false, problem: 'MA_SIEM_URL is not loopback (the lab reads the SIEM through the owner\'s port-forward only)' };
  if (u.username || u.password || u.search) return { ok: false, problem: 'MA_SIEM_URL carries credentials or a query' };
  if (u.pathname.replace(/\/+$/, '') !== '') return { ok: false, problem: 'MA_SIEM_URL must be the origin only (no path)' };
  if (!/^[\w-+=/]{20,}$/.test(key)) return { ok: false, problem: 'MA_SIEM_READ_APIKEY does not look like an Elasticsearch API key' };
  return { ok: true, base: u.origin, key };
}

// The run marker: the lab generates it per run (not the catalog's fixed audit-7f3c91ab — that one is
// the mock engine's prop). traceId is unique per run, so the marker is derived from it.
export function markerFor(traceId) {
  const bare = String(traceId || '').replace(/[^0-9a-f]/gi, '');
  return `meridian-air-${bare.slice(0, 12)}`;
}

// One query against the index. kind: 'policy-decision-log' | 'proxy-audit-log' | 'aiguard-log'.
async function search({ cfg, fetchImpl = (...a) => globalThis.fetch(...a), body, kind }) {
  let res;
  try {
    res = await fetchImpl(`${cfg.base}/${SIEM_INDEX}/_search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `ApiKey ${cfg.key}`, traceparent: body.__traceparent ?? undefined },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { kind: 'unreachable', note: e?.name === 'TimeoutError' ? 'the SIEM did not answer in time' : 'the SIEM is not reachable (is the port-forward running?)' };
  }
  if (res.status === 401 || res.status === 403) return { kind: 'refused', note: 'the SIEM refused the read key (401/403): check MA_SIEM_READ_APIKEY' };
  if (res.status >= 300) return { kind: 'refused', note: `the SIEM answered HTTP ${res.status}` };
  let json = null;
  try { json = await res.json(); } catch { return { kind: 'refused', note: 'the SIEM answered with something that is not JSON' }; }
  const hits = Array.isArray(json?.hits?.hits) ? json.hits.hits : [];
  return { kind: 'ok', hits: hits.slice(0, 20).map((h) => ({ id: String(h._id ?? ''), index: String(h._index ?? SIEM_INDEX), source: h._source ?? {} })) };
}

// The evidence search for one run: the marker in the message body (Data.RequestID or the marker string),
// plus the time-window neighbours that give the call its context (labelled inferred in the reply).
// marker: the run's marker. from/to: the run window (ISO strings or epoch ms — Date accepts both).
export async function findEvidence({ cfg, marker, from, to, fetchImpl }) {
  const must = [
    { query_string: { query: `*${JSON.stringify(marker).slice(1, -1)}*`, fields: ['Message', 'Data.RequestID', 'Data.Marker', 'Data.Reason'], default_operator: 'AND' } },
  ];
  const filter = [];
  if (from || to) filter.push({ range: { '@timestamp': { ...(from ? { gte: new Date(from).toISOString() } : {}), ...(to ? { lte: new Date(to).toISOString() } : {}) } } });
  const body = { query: { bool: { must, filter } }, sort: [{ '@timestamp': 'desc' }], size: 10, _source: true };
  const hit = await search({ cfg, fetchImpl, body, kind: 'marker' });
  if (hit.kind !== 'ok') return hit;
  if (!hit.hits.length) {
    // The marker is not in the index: say so honestly, and offer the time-window records anyway (inferred).
    const near = from || to ? await search({ cfg, fetchImpl, body: { query: { bool: { filter } }, sort: [{ '@timestamp': 'desc' }], size: 10, _source: true } }) : { kind: 'ok', hits: [] };
    if (near.kind !== 'ok') return near;
    return { kind: 'empty', matched: [], inferred: near.hits, note: 'no SIEM record carries this run\'s marker yet. The gateway streams asynchronously and the index lags the call; these are the records in the run\'s time window (inferred, not matched).' };
  }
  return { kind: 'ok', matched: hit.hits, inferred: [], note: null };
}
