// MA5's Real leg: the owner's Privilege Agent Registry, read live over the local console API
// (local.procyon.ai:8643, x-procyon-session-id — a correlation id, not a credential; the listener
// trusts loopback callers). MA5's badge then shows the REAL registry entries: agent name, scopes,
// custodian, expiry — with any key material truncated to a hash before it leaves this module
// (the console returns the VirtualKey unredacted; the lab never shows or logs it).
// Settings (OPTIONAL): MA_REGISTRY_URL (bare origin, default https://local.procyon.ai:8643),
// MA_REGISTRY_TENANT (the tenant UUID). The netguard allows the URL's host when configured.
import { liveSettingsFor } from './settings.js';
import crypto from 'node:crypto';
import https from 'node:https';

export const REGISTRY_DEFAULT_URL = 'https://local.procyon.ai:8643';

export function registryConfig(live = null) {
  const s = live ?? liveSettingsFor();
  const base = (s.MA_REGISTRY_URL || REGISTRY_DEFAULT_URL).replace(/\/$/, '');
  const tenant = s.MA_REGISTRY_TENANT || '';
  try { new URL(base); } catch { return { ok: false, problem: 'MA_REGISTRY_URL is not a URL' }; }
  if (tenant && !/^[0-9a-f-]{36}$/i.test(tenant)) return { ok: false, problem: 'MA_REGISTRY_TENANT is not a UUID' };
  return { ok: Boolean(tenant), base, tenant, problem: tenant ? null : 'MA_REGISTRY_TENANT is not set (the tenant UUID the local console serves)' };
}

export const registryConfigured = (live = null) => registryConfig(live).ok;

const hash8 = (t) => (t ? `sha256 ${crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 8)} (hash only)` : null);

// The badge fields for one key, with the key value reduced to a hash (write-only in spirit).
function badge(entry) {
  const sp = entry.Spec ?? {};
  const scopes = [];
  const raw = sp.Scopes?.Elems ?? sp.Scopes ?? [];
  for (const s of Array.isArray(raw) ? raw : []) {
    if (typeof s === 'string') scopes.push(s);
    else if (s?.Name) scopes.push(s.Name);
    else if (s?.Value?.Name) scopes.push(s.Value.Name);
  }
  return {
    name: entry.ObjectMeta?.Name ?? null,
    kind: entry.ObjectMeta?.Kind ?? 'AgentAccessKey',
    scopes,
    custodian: sp.CustodianRef?.Name ?? sp.UserRef?.Name ?? null,
    revoked: sp.Revoked === true,
    expiresAt: sp.NotAfter ?? null,
    key: hash8(sp.VirtualKey),
    updatedAt: entry.ObjectMeta?.ModificationTimestamp ?? entry.ObjectMeta?.CreationTimestamp ?? null,
  };
}

// The local console presents a self-signed certificate (the desktop agent's own). TLS verification is
// relaxed for THIS host only, and only when the owner has explicitly pointed MA_REGISTRY_URL at it —
// never globally. (The alternative is shipping the agent's CA, which the owner does not publish.)
// The console resets the TLS handshake unless the client names it: a connection by IP or by
// host.docker.internal (no SNI it knows) is dropped. So the lab connects to the reachable host and
// presents the console's own name (local.procyon.ai) as SNI and Host.
const CONSOLE_NAME = new URL(REGISTRY_DEFAULT_URL).hostname;
const LOOPBACK_ALIASES = new Set(['127.0.0.1', 'localhost', 'host.docker.internal']);
function localGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const named = LOOPBACK_ALIASES.has(u.hostname) ? { servername: CONSOLE_NAME, host: `${CONSOLE_NAME}:${u.port || 443}` } : {};
    const req = https.request({ hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'GET',
      ...(named.servername ? { servername: named.servername } : {}),
      headers: { accept: 'application/json', ...(named.host ? { host: named.host } : {}), ...headers }, rejectUnauthorized: false, timeout: 15_000 }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(text); } catch { return {}; } })() }));
    });
    req.on('timeout', () => req.destroy(new Error('the Agent Registry did not answer within 15 s')));
    req.on('error', reject);
    req.end();
  });
}

// The local console listens on the Mac's loopback. A host run reaches it at 127.0.0.1; a Docker run at
// host.docker.internal. The configured base names ONE of them; the read tries the other as a fallback
// (same host family, the console's own certificate, no other host is ever tried).
const ALT_HOSTS = { 'host.docker.internal': '127.0.0.1', '127.0.0.1': 'host.docker.internal', 'localhost': 'host.docker.internal' };
const alternates = (base) => {
  const u = new URL(base);
  const alt = ALT_HOSTS[u.hostname];
  return alt ? [base, `${u.protocol}//${alt}:${u.port || (u.protocol === 'https:' ? 443 : 80)}`] : [base];
};

export async function listKeys({ base, tenant } = {}) {
  let last = null;
  for (const b of alternates(base)) {
    const session = crypto.randomUUID();
    let r;
    try { r = await localGet(`${b}/api/${tenant}/v1/agentaccesskeys?ObjectMeta.Namespace=default`, { 'x-procyon-session-id': session }); }
    catch (e) { last = e; continue; }
    const j = r.json;
    if (r.status === 200) return (j.AgentAccessKeys ?? []).map(badge);
    last = new Error(`the Agent Registry answered HTTP ${r.status}: ${typeof j === 'string' ? j.slice(0, 120) : (j.message ?? '')}`.trim());
  }
  throw (last ?? new Error('the Agent Registry was not reachable'));
}

