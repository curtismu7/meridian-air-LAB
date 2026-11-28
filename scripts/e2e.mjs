#!/usr/bin/env node
// Real-browser run of the AirGuard Airlines web UI against the real server, which serves the UI itself (server/src/index.js).
//
//   npm run build          (once; the server serves web/dist)
//   npm run e2e            starts three lab instances on E2E_PORT, +1, +2 (default 7860, any port in 7800-7997), drives them in Chromium, stops them
//   E2E_SHOTS=/some/dir    where screenshots go (default .data/e2e-screenshots, git-ignored)
//
// Rewritten for AirGuard Airlines (2026-11-27): the script this replaced was inherited from the customer lab (its use-case ids, its Run/Result controls, its
// pages) and had never passed here. This one drives the chat-first UI as it is: the Chat page, the Agent detail page with the collapsed-by-default setup
// sidebar (the shared Rail) and the evidence column (Sequence and Movie reel), run history, the diagram, the talk track, the hosted build, and full Real
// against the fakes (sign-in through the modal, a Real run, a gateway DENY, back to Mock).
//
// Uses the Chromium the installed Playwright resolves (`npx playwright install chromium` if it is missing). No real tenant, no SE and no outbound request:
// every instance is on loopback, the fakes are on loopback, and any request to another origin fails the run. Exit 0 only when every check passes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AGENT_CLIENT_SECRET, CLIENT_SECRET, DEMO_PASSWORD, DEMO_USERNAME, FAKE_TOKEN, USER_CLIENT_SECRET, fullSettingsFor, settingsFor, startFakePingOne } from '../server/test/fakePingone.js';
import { REAL_KEYS } from '../server/src/settings.js';
import { startFakeGateway } from '../server/test/fakeGateway.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.env.E2E_SHOTS || path.join(root, '.data', 'e2e-screenshots');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
let failures = 0; let checks = 0;
const check = (ok, what) => { checks += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures += 1; };

const port = Number(process.env.E2E_PORT) || 7860;
if (port < 7800 || port + 2 > 7999) { console.error('E2E_PORT must leave room for three ports inside 7800-7999 (the lab port range)'); process.exit(2); }
const base = `http://127.0.0.1:${port}`;
const hostedBase = `http://127.0.0.1:${port + 1}`;
const fullBase = `http://127.0.0.1:${port + 2}`;
if (!fs.existsSync(path.join(root, 'web', 'dist', 'index.html'))) { console.error('Run `npm run build` first.'); process.exit(2); }

// A port already held (a leftover server, another checkout's e2e) would answer the health checks and the run would test the wrong lab: refuse it.
const portFree = (p) => new Promise((resolve) => {
  const s = net.createServer(); s.once('error', () => resolve(false)); s.once('listening', () => s.close(() => resolve(true))); s.listen(p, '127.0.0.1');
});
for (let i = 0; i < 3; i++) if (!(await portFree(port + i))) { console.error(`Port ${port + i} is already in use. Find it with: lsof -nP -iTCP:${port + i} -sTCP:LISTEN . Stop it, or pick another E2E_PORT.`); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-e2e-'));
const noEnvFile = path.join(tmp, 'none.env'); fs.writeFileSync(noEnvFile, '', { mode: 0o600 });   // no PingOne settings: Real is disabled by the missing settings alone
const servers = [];
async function startLab(p, env) {
  const child = spawn(process.execPath, ['server/src/index.js'], { cwd: root, env, stdio: 'inherit' });
  servers.push(child);
  for (let i = 0; i < 160; i++) { try { if ((await fetch(`http://127.0.0.1:${p}/api/health`)).ok) return child; } catch { await sleep(250); } }
  throw new Error(`the lab on ${p} did not start`);
}
const cleanEnv = (extra) => { const e = { ...process.env, ALLOW_MOCK_SIGNIN: '1', ...extra }; for (const k of ['CALAB_BIND', 'MA_ALLOW_LIVE', 'MA_LAB_MODE', 'IDP', 'MA_LIVE_FROM_ENV', 'MA_LIVE_TEST_BASE', 'MA_BRAIN_URL', ...REAL_KEYS]) if (!(k in extra)) delete e[k]; return e; };

// Full Real runs against a fake PingOne (pi.flow, flows API, code, client credentials, token exchange with act) and a fake Agent Gateway (MCP), both on loopback.
const fullP1 = await startFakePingOne();
const fullGw = await startFakeGateway({ isDelegated: (tok) => fullP1.issued.delegated.has(tok) });
const fullFile = path.join(tmp, 'full.env');
fs.writeFileSync(fullFile, `${Object.entries({ ...settingsFor(), ...fullSettingsFor(fullGw.url) }).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, { mode: 0o600 });

let browser;
try {
  await startLab(port, cleanEnv({ PORT: String(port), MA_ENV_FILE: noEnvFile }));
  await startLab(port + 1, cleanEnv({ PORT: String(port + 1), MA_DEPLOY_MODE: 'hosted', MA_LAB_MODE: 'mock', IDP: 'mock' }));
  await startLab(port + 2, cleanEnv({ PORT: String(port + 2), MA_ENV_FILE: fullFile, MA_LIVE_TEST_BASE: fullP1.base }));
  fs.mkdirSync(shots, { recursive: true });
  const runtimeOf = async (b) => (await (await fetch(`${b}/api/health`)).json()).runtime;
  check((await runtimeOf(base)) === 'offline', 'health: the mock instance reports runtime offline');

  browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined });
  const VIEWPORTS = [[1280, 900, 'desktop'], [375, 800, 'phone']];

  // A page with the watchers every block needs: requests to another origin, page errors, console errors (the deliberate 403/409/501 refusals excepted).
  async function open(origin, { width, height, scheme }) {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await ctx.newPage();
    const seen = { external: [], errors: [] };
    page.on('request', (r) => { if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url())) seen.external.push(r.url()); });
    page.on('pageerror', (e) => seen.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/status of (403|409|501)/.test(m.text())) seen.errors.push(m.text()); });
    await page.goto(`${origin}/`);
    await page.getByTestId('mode-select').waitFor();
    return { ctx, page, seen, t: (id) => page.getByTestId(id), overflow: () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) };
  }
  // The chat's "what to type" prompt picker runs one scene; its answer lands in the conversation as a new turn (counted, so a reload or an earlier run cannot confuse it).
  const say = async (t, page, id) => {
    const before = await page.getByTestId('turn-answer').count();
    await t('wtt-select').selectOption(id);
    await page.waitForFunction((n) => document.querySelectorAll('[data-testid="turn-answer"]').length > n, before, { timeout: 30000 });
  };
  const lastAnswer = (page) => page.getByTestId('turn-answer').last().innerText();

  // ---- The mock instance: Chat, Agent detail (collapsed sidebar, evidence tabs), run history, diagram, talk track --------------------------------------------
  for (const [width, height, name] of VIEWPORTS) {
    for (const scheme of ['light', 'dark']) {
      const tag = `mock-${name}-${scheme}`;
      const { ctx, page, seen, t, overflow } = await open(base, { width, height, scheme });
      await t('wtt-select').waitFor();
      await page.waitForFunction(() => document.querySelector('[data-testid="banner"]').textContent.startsWith('SIMULATED, MOCK mode'), null, { timeout: 60000 }).catch(() => {});
      check((await t('banner').innerText()).startsWith('SIMULATED, MOCK mode'), `${tag}: the banner says SIMULATED, MOCK mode`);
      check((await t('mode').innerText()).includes('Mode: mock'), `${tag}: the header shows Mode: mock`);
      check(/^Workspace: w-[0-9a-f]{16}$/.test(await t('workspace').innerText()), `${tag}: the header shows the workspace id`);
      check((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === null, `${tag}: Auto theme sets no data-theme`);
      check((await t('mode-real').evaluate((o) => o.disabled)) === true, `${tag}: Real is disabled (no PingOne settings): the missing settings alone say so`);
      check((await overflow()) <= 0, `${tag}: the Chat page does not scroll sideways (${await overflow()} px)`);

      // Run MA1: the answer lands in the conversation with its verdict.
      await say(t, page, 'MA1');
      check((await lastAnswer(page)).includes('PERMIT'), `${tag}: MA1 answers PERMIT in the chat`);
      check((await t('turn-evidence').count()) >= 1, `${tag}: the answer links to its evidence`);

      // Agent detail: the setup sidebar (the shared Rail) opens COLLAPSED, expands on a click, and the choice is remembered.
      await t('nav-agent').click(); await t('evidence-count').waitFor();
      check((await t('evidence-count').innerText()).startsWith('MA1 · 16 hops'), `${tag}: the evidence column names the run (${(await t('evidence-count').innerText()).slice(0, 40)})`);
      check((await t('rail-toggle').getAttribute('aria-expanded')) === 'false', `${tag}: the setup sidebar is collapsed by default`);
      check((await t('uc-MA1').count()) === 1 && !(await t('uc-MA1').isVisible()), `${tag}: collapsed, its picker is not on screen`);
      check((await t('sidebar-toggle').count()) === 0, `${tag}: the old sidebar button is gone`);
      await t('rail-toggle').click();
      check((await t('rail-toggle').getAttribute('aria-expanded')) === 'true' && await t('uc-MA1').isVisible(), `${tag}: a click expands it and the scenes are listed`);
      check((await page.evaluate(() => localStorage.getItem('ma.setup'))) === '0', `${tag}: the choice is remembered (ma.setup = 0)`);
      await page.reload(); await t('mode-select').waitFor(); await t('nav-agent').click(); await t('rail-toggle').waitFor();
      check((await t('rail-toggle').getAttribute('aria-expanded')) === 'true', `${tag}: an explicit expand survives a reload`);
      await t('rail-toggle').click();
      check((await t('rail-toggle').getAttribute('aria-expanded')) === 'false' && (await page.evaluate(() => localStorage.getItem('ma.setup'))) === '1', `${tag}: and collapsing is remembered too`);
      check((await overflow()) <= 0, `${tag}: Agent detail does not scroll sideways (${await overflow()} px)`);

      // The evidence column: Sequence (no tile strip, no progress bar; the boxes on the diagram open the actor card) and Movie reel (frame -> step detail).
      if (!(await t('evidence-count').innerText()).startsWith('MA1')) await say(t, page, 'MA1');   // the reload cleared the workspace's view
      await t('evtab-sequence').click(); await t('sequence-view').waitFor();
      check((await page.locator('.sq-actors, .sq-prog').count()) === 0, `${tag}: the Sequence view has no actor-tile strip and no progress bar`);
      await t('actor-gateway').click();
      check(await t('actor-card').isVisible(), `${tag}: the Gateway box on the diagram opens its actor card`);
      await page.keyboard.press('Escape');
      await t('evtab-reel').click(); await t('movie-reel').waitFor();
      check((await page.locator('[data-testid^="frame-"]').count()) >= 5, `${tag}: the Movie reel shows one frame per hop`);
      await t('frame-3').click(); await t('step-detail').waitFor();
      check((await t('sdp-narrative').innerText()).trim().length > 10, `${tag}: a frame opens its step detail with what happened`);
      if (await t('sdp-notice').count()) check((await t('sdp-notice').textContent()).trim().startsWith('Look at'), `${tag}: the step detail points at the key fact ("Look at ...")`);

      // A refused scene, then the other pages.
      await t('nav-chat').click(); await say(t, page, 'MA3');
      check((await lastAnswer(page)).includes('DENY'), `${tag}: MA3 (the nightly batch) is denied by the rate limit`);
      await t('nav-runs').click(); await t('history').waitFor();
      check((await t('history-row').count()) >= 2, `${tag}: run history lists the runs (${await t('history-row').count()})`);
      await t('nav-diagram').click(); await page.locator('.react-flow__node').first().waitFor();
      check((await overflow()) <= 0, `${tag}: the diagram page does not scroll sideways`);
      await t('nav-talk').click(); await t('talk-track').waitFor();
      check((await overflow()) <= 0, `${tag}: the talk track does not scroll sideways`);
      if (tag === 'mock-desktop-light' || tag === 'mock-phone-dark') { await t('nav-agent').click(); await page.screenshot({ path: path.join(shots, `${tag}.png`), fullPage: false }); }
      check(seen.external.length === 0, `${tag}: the browser made no request to another origin (${seen.external.length})`);
      check(seen.errors.length === 0, `${tag}: no console error (${seen.errors.slice(0, 2).join(' | ')})`);
      await ctx.close();
    }
  }

  // ---- The hosted build: Real is disabled with a note (a click makes no /api/mode request, no error, the page stays Mock) -------------------------------------
  for (const [width, height, name] of VIEWPORTS) {
    for (const scheme of ['light', 'dark']) {
      const tag = `hosted-${name}-${scheme}`;
      const { ctx, page, seen, t, overflow } = await open(hostedBase, { width, height, scheme });
      const modeCalls = []; let watch = false;
      page.on('request', (r) => { if (watch && new URL(r.url()).pathname === '/api/mode') modeCalls.push(`${r.method()} ${r.url()}`); });
      await t('wtt-select').waitFor();
      await page.waitForFunction(() => document.querySelector('[data-testid="mode-real"]')?.disabled === true);
      check((await t('banner').innerText()).startsWith('HOSTED AND SIMULATED'), `${tag}: the banner says HOSTED AND SIMULATED`);
      check(await t('real-hosted-note').isVisible() && (await t('real-hosted-note').innerText()) === 'Mock only on the hosted copy. Run the lab locally for Real.', `${tag}: the note beside Real is shown`);
      watch = true;
      await t('mode-select').selectOption('real').catch(() => {});
      check((await t('mode-select').inputValue()) === 'mock', `${tag}: selecting Real is refused and the select stays on mock`);
      check(modeCalls.length === 0, `${tag}: selecting Real made no /api/mode request (${modeCalls.join(' | ')})`);
      check((await t('mode-msg').count()) === 0 && (await t('mode').innerText()).includes('Mode: mock'), `${tag}: no error shown and the page stays Mock`);
      check((await overflow()) <= 0, `${tag}: the shell bar with the note fits the ${width}px viewport`);
      check(seen.external.length === 0, `${tag}: the browser made no request to another origin (${seen.external.length})`);
      check(seen.errors.length === 0, `${tag}: no console error (${seen.errors.slice(0, 2).join(' | ')})`);
      await ctx.close();
    }
  }

  // ---- Full Real against the fakes: sign in through the modal (pi.flow), a Real run, a gateway DENY, then Mock ------------------------------------------------
  for (const [width, height, name, scheme] of [[1280, 900, 'desktop', 'light'], [375, 800, 'phone', 'dark']]) {
    const tag = `full-${name}-${scheme}`;
    fullGw.seen.length = 0; fullP1.seen.length = 0; fullGw.state.behaviour = 'ok';
    const { ctx, page, seen, t, overflow } = await open(fullBase, { width, height, scheme });
    await page.waitForFunction(() => document.querySelector('[data-testid="mode-real"]')?.disabled === false);
    await t('mode-select').selectOption('real');
    await page.waitForFunction(() => document.querySelector('[data-testid="mode"]').textContent.includes('real: sign-in, token exchange, Agent Gateway'));
    check(await t('sign-in').isVisible(), `${tag}: Real shows the Sign in button`);
    await t('sign-in').click(); await t('signin-dialog').waitFor();
    check((await t('signin-username').inputValue()) === DEMO_USERNAME && (await t('signin-username').getAttribute('readonly')) !== null, `${tag}: the Sign in modal has the username filled in, read-only`);
    check((await t('signin-password').getAttribute('type')) === 'password', `${tag}: the password field is a password field`);
    await t('signin-password').fill(DEMO_PASSWORD); await t('signin-submit').click();
    await page.getByText('Signed in', { exact: false }).first().waitFor({ timeout: 30000 });
    // The shared top menu centres the signed-in slot on the bar's top line; the nav tabs live there too, so nothing may overlap them.
    const overlap = await page.evaluate(() => {
      const slot = document.querySelector('.top-menu__signin-slot').getBoundingClientRect();
      return [...document.querySelectorAll('[data-testid="nav"] button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.left < slot.right && r.right > slot.left && r.top < slot.bottom && r.bottom > slot.top; }).map((b) => b.textContent.trim());
    });
    check(overlap.length === 0, `${tag}: the signed-in status does not sit on top of the nav tabs (${overlap.join(', ') || 'none'})`);
    await page.screenshot({ path: path.join(shots, `${tag}-header.png`), clip: { x: 0, y: 0, width, height: Math.min(260, height) } });
    check(fullP1.seen.some((c) => /authorize|flows/.test(c.url)) && fullP1.seen.some((c) => c.url.endsWith('/as/token')), `${tag}: the fake PingOne saw the pi.flow sign-in and the token call`);

    await say(t, page, 'MA2');
    check(/REAL/.test(await lastAnswer(page)), `${tag}: MA2 answers from a Real run (the verdict says REAL)`);
    check(fullGw.seen.some((c) => c.rpc?.method === 'initialize') && fullGw.seen.some((c) => c.rpc?.method === 'tools/call'), `${tag}: the fake gateway saw initialize and tools/call`);
    await t('nav-agent').click(); await t('evidence-count').waitFor();
    const count = await t('evidence-count').innerText();
    check(/^MA2 · 9 hops · REAL$/.test(count), `${tag}: the evidence column says "${count}" (nine hops, all Real)`);
    await t('hops-toggle').click();
    const labels = await page.locator('[data-testid="hop"] summary .hop__label').allTextContents();
    check(labels.length === 9 && !labels.some((l) => /\[REAL\]/.test(l)) && /Sign-in/.test(labels[0]), `${tag}: nine hops, none labelled [REAL] (a real hop is the normal case)`);
    check(!labels.some((l) => /\[masked/.test(l)), `${tag}: no hop label is blanked by the redaction filter`);
    const text = await page.locator('body').innerText();
    // (the decoded-token view shows a token's signature by design; the secrets, the password and the whole raw token must never appear)
    const leaked = Object.entries({ CLIENT_SECRET, USER_CLIENT_SECRET, AGENT_CLIENT_SECRET, DEMO_PASSWORD, FAKE_TOKEN }).filter(([, v]) => text.includes(v)).map(([k]) => k);
    check(leaked.length === 0, `${tag}: the page (all hops open) holds no secret, no password and no raw token (${leaked.join(', ') || 'none'})`);
    check((await overflow()) <= 0, `${tag}: the Real evidence does not scroll sideways (${await overflow()} px)`);
    if (tag === 'full-desktop-light') await page.screenshot({ path: path.join(shots, `${tag}.png`), fullPage: false });

    // The gateway DENIES the tool call: the chat says so and the evidence shows the refusal.
    fullGw.state.behaviour = 'deny';
    await t('nav-chat').click(); await say(t, page, 'MA2');
    check(/DENY|denied/i.test(await lastAnswer(page)), `${tag}: a gateway DENY is shown in the chat`);

    // Back to Mock without a restart.
    await t('mode-select').selectOption('mock');
    await page.waitForFunction(() => document.querySelector('[data-testid="mode"]').textContent.includes('Mode: mock'));
    const gwBefore = fullGw.seen.length;
    await t('nav-chat').click(); await say(t, page, 'MA1');
    check((await t('banner').getAttribute('data-state')) === 'mock' && fullGw.seen.length === gwBefore, `${tag}: back in Mock without a restart: a run makes no call to the gateway`);
    check(seen.external.length === 0, `${tag}: the browser made no request to another origin (${seen.external.length})`);
    check(seen.errors.length === 0, `${tag}: no console error (${seen.errors.slice(0, 2).join(' | ')})`);
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  for (const s of servers) s.kill();
  await fullP1.close(); await fullGw.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${checks - failures} of ${checks} checks passed`);
process.exit(failures ? 1 : 0);
