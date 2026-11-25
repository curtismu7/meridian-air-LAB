// MA5's Real read against a fake of the desktop console's listener: it resets any TLS handshake that does not
// name local.procyon.ai (so a bare IP or host.docker.internal connection is dropped) and answers the list only
// at /v1/agentaccesskeys (a trailing /default is read as a namespace/name lookup and refused with 401).
import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listKeys } from '../src/registry.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const SECRET_KEY = 'vk-this-value-must-never-leave-the-module';

function selfSigned() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ma-registry-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=local.procyon.ai', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem')], { stdio: 'ignore' });
  const out = { key: readFileSync(path.join(dir, 'k.pem')), cert: readFileSync(path.join(dir, 'c.pem')) };
  rmSync(dir, { recursive: true, force: true });
  return out;
}

async function withConsole(fn) {
  const seen = [];
  const server = https.createServer({ ...selfSigned(), SNICallback: (name, cb) => cb(null, undefined) }, (req, res) => {
    seen.push({ url: req.url, host: req.headers.host });
    const ok = req.url === `/api/${TENANT}/v1/agentaccesskeys?ObjectMeta.Namespace=default`;
    res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' });
    res.end(JSON.stringify(ok
      ? { AgentAccessKeys: [{ ObjectMeta: { Name: 'meridian-agent', Kind: 'AgentAccessKey' }, Spec: { Scopes: ['booking.read'], VirtualKey: SECRET_KEY, RealKey: SECRET_KEY, Revoked: false } }] }
      : { message: 'User is not authorized' }));
  });
  // Drop the connection at the TLS layer unless the client named local.procyon.ai.
  server.on('secureConnection', (s) => { if (s.servername !== 'local.procyon.ai') s.destroy(); });
  server.on('tlsClientError', () => {});
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { await fn(`https://127.0.0.1:${server.address().port}`, seen); } finally { await new Promise((r) => server.close(r)); }
}

test('MA5 registry read: names the console (SNI + Host) and uses the list path; key values are only ever a hash', async () => {
  await withConsole(async (base, seen) => {
    const keys = await listKeys({ base, tenant: TENANT });
    assert.equal(keys.length, 1);
    assert.equal(keys[0].name, 'meridian-agent');
    assert.match(keys[0].key, /^sha256 [0-9a-f]{8} \(hash only\)$/);
    assert.ok(!JSON.stringify(keys).includes(SECRET_KEY), 'the key value never leaves the module');
    assert.equal(seen[0].url, `/api/${TENANT}/v1/agentaccesskeys?ObjectMeta.Namespace=default`);
    assert.match(seen[0].host, /^local\.procyon\.ai:\d+$/);
  });
});

test('MA5 registry read: when every host fails, the first host\'s error is the one reported (the fallback must not mask it)', async () => {
  // Port 1 on loopback refuses; the fallback host (host.docker.internal) fails differently (or not at all on a Docker-less box).
  await assert.rejects(() => listKeys({ base: 'https://127.0.0.1:1', tenant: TENANT }), /ECONNREFUSED/);
});

test('MA5 registry read: a console that answers with an HTTP status is reported as that status, not as a connection error', async () => {
  await withConsole(async (base) => {
    await assert.rejects(() => listKeys({ base, tenant: '99999999-2222-3333-4444-555555555555' }), /answered HTTP 401/);
  });
});
