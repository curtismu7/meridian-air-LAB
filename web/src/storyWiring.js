// Story wiring: the lab's own glue between the shared Story engine (web/src/story/, vendored) and this page. It turns the script (storyScript.js) into
// engine steps and gives the engine a `host` that reads and drives the page: the composer, the prompt dropdown, the run events. It never edits the page's
// own markup; it clicks the page's own buttons with script-made events (isTrusted is false, so Play for me is not mistaken for the viewer's own input).
//
// The page (App.jsx) announces runs with ma:run-start and ma:run-end ({ ok }): ok is false only when the request itself failed. A question the gateway
// blocks completes normally (the block is in the trace), so it is a run that ended ok.

import { STEPS } from './storyScript.js';

const text = (el) => (el && el.textContent ? el.textContent.trim() : '');

/** The first sentence, never cut mid-word (the video's first_sentence). */
export function firstSentence(s, limit = 150) {
  let t = String(s || '').trim().split('\n')[0] || '';
  const cut = t.indexOf('. ');
  if (cut > 0) t = t.slice(0, cut + 1);
  if (t.length <= limit) return t;
  const head = t.slice(0, limit);
  const sp = head.lastIndexOf(' ');
  return `${sp > 0 ? head.slice(0, sp) : head}...`;
}

export function createHost({ win = window, doc = document, mode = () => 'mock', settleMs = 500 } = {}) {
  const runs = { starts: 0, ends: 0, lastOk: true };
  const waiters = new Set();   // each is (ok, reason) => void
  const timers = new Set();
  const watchers = new Set();  // onRun subscribers: told when a run starts or ends, so the bar can say whose turn it is
  const onStart = () => { runs.starts += 1; watchers.forEach((f) => f()); };
  const onEnd = (e) => {
    runs.ends += 1; runs.lastOk = e.detail ? e.detail.ok !== false : true;
    for (const w of [...waiters]) w(runs.lastOk);
    watchers.forEach((f) => f());
  };
  // A Reset empties the page: a step waiting for a run is told so (and the run's own end, which follows, finds nobody waiting).
  const onReset = () => { for (const w of [...waiters]) w(false, 'The page was reset. Press Next to carry on, or Exit.'); };
  win.addEventListener('ma:run-start', onStart);
  win.addEventListener('ma:run-end', onEnd);
  win.addEventListener('ma:reset', onReset);

  const q = (sel) => doc.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (el) => { if (!el || el.disabled) throw new Error('the button is not available'); el.click(); };

  return {
    mode,
    query: q,
    mark: () => ({ starts: runs.starts, ends: runs.ends }),
    runStarted: (m) => runs.starts > m.starts,
    runInFlight: () => runs.starts > runs.ends,
    onRun: (cb) => { watchers.add(cb); return () => watchers.delete(cb); },
    waitForRun(m, timeoutMs) {
      // m is null on the first run-done step (the engine records its marker when a prompt step is presented, after the wait began): a null marker means
      // no run has been counted for this step yet, so any run end settles it.
      const base = m || { starts: 0, ends: 0 };
      return new Promise((resolve) => {
        const finish = (r) => { clearTimeout(t); timers.delete(t); waiters.delete(check); resolve(r); };
        const done = (ok, reason) => finish(ok ? { ok: true } : { ok: false, reason: reason || 'The run failed. Press Next to carry on, or Exit.' });
        const check = (ok, reason) => { if (reason || runs.ends > base.ends) done(ok, reason); };
        const t = setTimeout(() => finish({ ok: false, reason: 'The run did not finish in time. Press Next to carry on, or Exit.' }), timeoutMs);
        timers.add(t);
        if (runs.ends > base.ends) { done(runs.lastOk); return; }
        waiters.add(check);
      });
    },
    prefill(step) {
      if (!step.prompt || !step.prompt.text) return;
      const input = q('[data-testid="composer-input"]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set;
      setter.call(input, step.prompt.text);
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    },
    send(step) {
      if (step.prompt && step.prompt.press) { click(q(step.prompt.press)); return; }
      click(q('[data-testid="composer-send"]'));
    },
    switchTab() { /* the lab keeps everything on one page: the chat column and the evidence column are always in view */ },
    assetUrl: () => null,   // no screenshot ships; a slide is text-only
    dispose() { win.removeEventListener('ma:run-start', onStart); win.removeEventListener('ma:run-end', onEnd); win.removeEventListener('ma:reset', onReset); timers.forEach(clearTimeout); timers.clear(); waiters.clear(); watchers.clear(); },
    _sleep: sleep, _settleMs: settleMs,
  };
}

// ---- finding what a bubble points at
const lastOf = (doc, sel) => { const all = doc.querySelectorAll(sel); return all.length ? all[all.length - 1] : null; };

function targetFor(doc, t) {
  if (!t) return null;
  if (typeof t === 'string') return t;
  if (t.last) {
    return () => lastOf(doc, t.last) || (t.fallback ? lastOf(doc, t.fallback) : null);
  }
  if (t.selector) {
    return () => { const e = doc.querySelector(t.selector); return e && !(t.unless && e.classList.contains(t.unless)) ? e : null; };
  }
  return null;
}

// ---- the live fact lines a bubble shows (what the video's take read from the page)
function linesFor(doc, step) {
  const reply = () => { const e = lastOf(doc, '[data-testid="turn"]'); return e && text(e.querySelector('[data-testid="turn-reply"]')); };
  switch (step.lines) {
    case 'reply1': return () => { const t = reply(); return t ? [firstSentence(t)] : []; };
    case 'hops': return () => { const e = doc.querySelector('[data-testid="evidence-count"]'); const m = text(e).match(/(\d+) hops/); return m ? [`${m[1]} hops, all on the record`] : []; };
    default: return undefined;
  }
}

// Steps left out of the walk-through. None now.
export const NOT_YET = [];

/** The script as engine steps. `captions` is /api/captions. */
export function buildSteps({ captions, host, doc = document, win = window, script = STEPS, notYet = NOT_YET }) {
  return script.filter((s) => !notYet.includes(s.key)).map((s) => {
    const step = { key: s.key, type: s.type, trigger: s.trigger, modes: s.modes, sampleKey: s.sampleKey, prefer: s.prefer, place: s.place, fixedSecs: s.fixedSecs, frameTimeoutMs: s.frameTimeoutMs };
    if (s.prompt) step.prompt = s.prompt;
    if (s.type === 'bubble') {
      step.target = targetFor(doc, s.target);
      const lines = linesFor(doc, s);
      if (lines) step.lines = lines;
    }
    return step;
  });
}
