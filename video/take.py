#!/usr/bin/env python3
"""The Meridian Air mock-first take: headless Playwright against the lab (default http://127.0.0.1:7832), the
scene tour in Mock mode with numbered captions and the two full-screen slides. SAMPLE=1 is the default cut the
standards require first (a SAMPLE pill on screen, mock only); REHEARSE=1 runs it fast with no recording;
HEADLESS_REAL=1 records the Real-mode cut (sign-in included, refuses without it).

Usage: python3 take.py <work_dir>
  work_dir gets: sample.mp4 (SAMPLE=1) or take.mp4 (HEADLESS_REAL=1), take.log, result.json
"""
import json, os, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from captions import OPENING_SLIDE, CLOSING_SLIDE, STEPS, SLIDES

WORK = Path(sys.argv[1] if len(sys.argv) > 1 else "take-work").resolve()
REHEARSE = os.environ.get("REHEARSE") == "1"
SAMPLE = os.environ.get("SAMPLE", "1") == "1"   # the mock-first cut is the default per the standards
HEADLESS_REAL = os.environ.get("HEADLESS_REAL") == "1"
THEME = os.environ.get("THEME", "light")
APP = os.environ.get("APP_URL", "http://127.0.0.1:7832")
PROFILE_NAME = os.environ.get("PROFILE", "laptop")
PROFILES = {"monitor": dict(viewport=(1920, 1080), dsf=1, scale=1.3, font="L"),
            "laptop": dict(viewport=(1200, 779), dsf=2, scale=1.0, font="S")}
_prof = PROFILES[PROFILE_NAME]
VW, VH = (int(os.environ.get("VW", 0)) or _prof["viewport"][0]), (int(os.environ.get("VH", 0)) or _prof["viewport"][1])
SCALE = float(os.environ.get("SCALE", _prof["scale"]))
OUT = WORK / ("take.mp4" if HEADLESS_REAL else "sample.mp4")
SCENES = ["MA1", "MA2", "MA7", "MA5", "MA6", "MA4", "MA9"]   # the sample's tour order

def log(*a):
    WORK.mkdir(parents=True, exist_ok=True)
    with (WORK / "take.log").open("a") as f:
        print(*a, file=f, flush=True)

OVERLAY = r"""
(() => {
  if (window.__cm) return;
  const S = window.__cmScale || 1; const px = (n) => Math.round(n * S) + 'px';
  const css = `
  .cm-hl{position:fixed;z-index:2147483644;border:3px solid #ff3b57;border-radius:10px;box-shadow:0 0 0 9999px rgba(8,10,13,.28);pointer-events:none;transition:all .25s}
  .cm-bub{box-sizing:border-box;position:fixed;z-index:2147483645;width:${px(470)};background:#f7f8fc;color:#14202e;border:3px solid #e3002b;border-radius:20px;padding:${px(14)} ${px(20)} ${px(14)} ${px(64)};font:${px(18)}/1.4 system-ui,sans-serif;box-shadow:0 14px 36px rgba(0,0,0,.55)}
  .cm-bub .n{position:absolute;left:${px(14)};top:${px(14)};width:${px(36)};height:${px(36)};border-radius:50%;background:#e3002b;color:#fff;font:700 ${px(19)}/${px(36)} system-ui;text-align:center}
  .cm-bub h3{margin:0 0 4px;font-size:${px(19)};color:#14202e !important;font-weight:800}
  .cm-bub p{margin:0;color:#233044}
  .cm-bub ul{margin:8px 0 0;padding:0;list-style:none}
  .cm-bub li{margin:6px 0;padding:6px 9px;background:#e8ebf3;border-radius:6px;font:${px(15)}/1.5 ui-monospace,Menlo,monospace;color:#051727;font-weight:600;word-break:break-word;overflow-wrap:anywhere}
  .cm-bub .of{position:absolute;right:14px;top:10px;font-size:${px(12)};color:#5b667a}
  .cm-tail{position:absolute;width:22px;height:22px;background:#f7f8fc;border:3px solid #e3002b;transform:rotate(45deg)}
  .cm-pill{position:fixed;right:14px;bottom:12px;z-index:2147483646;background:#1d232b;color:#f2f4f7;border:1px solid #3a4350;border-radius:999px;padding:4px 14px;font:700 13px system-ui,sans-serif;pointer-events:none}
  .cm-slide{box-sizing:border-box;position:fixed;z-index:2147483647;inset:0;display:flex;align-items:center;justify-content:center;background:#051727;font:17px/1.5 system-ui,sans-serif;padding:24px}
  .cm-slide .card{zoom:${S};box-sizing:border-box;width:min(1100px,calc(94vw / ${S}));max-height:calc(92vh / ${S});overflow-y:auto;background:#0f2236;color:#f2f4f7;border:3px solid #e3002b;border-radius:24px;padding:32px 40px;box-shadow:0 24px 60px rgba(0,0,0,.6)}
  .cm-slide h1{margin:0 0 10px;font-size:32px;font-weight:800;color:#fff}
  .cm-slide .lead{margin:0 0 20px;color:#c7d0dc;font-size:19px}
  .cm-slide .cols{display:grid;grid-template-columns:1fr 1fr;gap:28px}
  @media (max-width:760px){ .cm-slide .cols{grid-template-columns:1fr} }
  .cm-slide .card.withimg{width:min(1400px,calc(98vw / ${S}))}
  .cm-slide .card.withimg h1{font-size:28px;margin-bottom:6px}.cm-slide .card.withimg .lead{margin-bottom:12px}
  .cm-slide .split{display:grid;grid-template-columns:1.25fr 1fr;gap:26px;align-items:start;margin-bottom:6px}
  .cm-slide .split img{width:100%;border-radius:10px;border:1px solid #2a3b52;background:#fff}
  .cm-slide .col h2{margin:0 0 8px;font-size:19px;color:#8fbcff}
  .cm-slide .col.colb h2{color:#ffb4a8}
  .cm-slide .col ul{margin:0;padding-left:20px}
  .cm-slide .col li{margin:7px 0;font-size:18px}
  .cm-slide .verdict{margin:22px 0 0;padding-top:16px;border-top:1px solid #2a3b52;font-weight:700;color:#fff;font-size:18px}
  .reel-backdrop{justify-content:flex-start !important;padding-left:20px !important}
  .reel-dialog{width:min(${Math.round(880 * S)}px,100%) !important}`;
  const root = () => document.documentElement;
  const ensure = () => { if (!root() || document.getElementById('cm-style')) return; const st = document.createElement('style'); st.id = 'cm-style'; st.textContent = css; root().appendChild(st);
    const pill = document.createElement('div'); pill.className = 'cm-pill'; pill.textContent = window.__pillText || ''; if (!window.__pillText) pill.style.display = 'none'; root().appendChild(pill); };
  document.addEventListener('DOMContentLoaded', ensure); ensure();
  const els = []; const clear = () => { while (els.length) els.pop().remove(); };
  setInterval(() => { document.querySelectorAll('.aws__card dt').forEach((dt) => { if (dt.textContent === 'protocolVersion') { dt.style.display = 'none'; if (dt.nextElementSibling) dt.nextElementSibling.style.display = 'none'; } }); }, 250);
  window.__authUrl = null; 
  window.__cm = { clear, slide(o) {
    ensure(); clear();
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<h1></h1><p class="lead"></p><div class="cols">
      <div class="col cola"><h2></h2><ul></ul></div>
      <div class="col colb"><h2></h2><ul></ul></div></div><p class="verdict"></p>`;
    card.querySelector('h1').textContent = o.title;
    card.querySelector('.lead').textContent = o.lead;
    card.querySelector('.cola h2').textContent = o.cola.h;
    card.querySelector('.cola ul').append(...o.cola.lines.map((l) => { const li = document.createElement('li'); li.textContent = l; return li; }));
    card.querySelector('.colb h2').textContent = o.colb.h;
    card.querySelector('.colb ul').append(...o.colb.lines.map((l) => { const li = document.createElement('li'); li.textContent = l; return li; }));
    card.querySelector('.verdict').textContent = o.verdict;
    if (o.image) { card.classList.add('withimg'); const split = document.createElement('div'); split.className = 'split'; const im = document.createElement('img'); im.src = o.image; im.alt = 'Screenshot of the Privilege console'; const cols = card.querySelector('.cols'); if (o.wide) { split.style.gridTemplateColumns = '1fr'; cols.parentNode.insertBefore(split, cols); split.append(im); } else { cols.style.gridTemplateColumns = '1fr'; cols.parentNode.insertBefore(split, cols); split.append(im, cols); } }
    // Belt and suspenders on top of the CSS max-height: an explicit pixel value computed from the real
    // viewport, so this never depends on vh units resolving the way a particular Chromium build expects.
    card.style.maxHeight = Math.round(innerHeight * 0.88 / S) + 'px';
    const wrap = document.createElement('div'); wrap.className = 'cm-slide'; wrap.append(card);
    root().appendChild(wrap); els.push(wrap);
  }, cap(o) {
    ensure(); clear();
    const vw = innerWidth, vh = innerHeight, W = Math.round(470 * S), GAP = 26, M = 12;
    const t = o.target ? document.querySelector(o.target) : null;
    // Scroll the target's own panel so it is on screen before measuring it: otherwise a sidebar field, a reel
    // frame or a step-detail row that has scrolled out of view gets highlighted in the wrong place, or the
    // viewer never actually sees what the caption is pointing at.
    if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = t ? t.getBoundingClientRect() : null;
    if (r) { const h = document.createElement('div'); h.className = 'cm-hl'; h.style.cssText = `left:${r.left-5}px;top:${r.top-5}px;width:${r.width+10}px;height:${r.height+10}px`; root().appendChild(h); els.push(h); }
    const b = document.createElement('div'); b.className = 'cm-bub';
    b.innerHTML = `<span class="n"></span><span class="of"></span><h3></h3><p></p>` + (o.lines ? '<ul>' + o.lines.map(() => '<li></li>').join('') + '</ul>' : '');
    b.querySelector('.n').textContent = o.n; b.querySelector('.of').textContent = o.n + ' of ' + o.total;
    b.querySelector('h3').textContent = o.title; b.querySelector('p').textContent = o.text;
    (o.lines || []).forEach((l, i) => { b.querySelectorAll('li')[i].textContent = l; });
    b.style.visibility = 'hidden'; root().appendChild(b); els.push(b);
    const H = b.getBoundingClientRect().height;
    let left, top, side = null;
    if (o.place === 'bl') { left = M + 8; top = vh - H - 24; }
    else if (!r) { left = (vw - W) / 2; top = vh - H - 40; }
    else {
      const fits = { right: r.right + GAP + W + M <= vw, left: r.left - GAP - W >= M, below: r.bottom + GAP + H + M <= vh, above: r.top - GAP - H >= M };
      const order = o.prefer ? [o.prefer, 'right', 'left', 'below', 'above'] : ['right', 'left', 'below', 'above'];
      side = order.find((s) => fits[s]) || (vw - r.right > r.left ? 'right' : 'left');
      if (side === 'right') { left = r.right + GAP; top = r.top + r.height / 2 - H / 2; }
      else if (side === 'left') { left = r.left - GAP - W; top = r.top + r.height / 2 - H / 2; }
      else if (side === 'below') { left = r.left + r.width / 2 - W / 2; top = r.bottom + GAP; }
      else { left = r.left + r.width / 2 - W / 2; top = r.top - GAP - H; }
    }
    left = Math.max(M, Math.min(vw - W - M, left)); top = Math.max(M, Math.min(vh - H - M, top));
    b.style.left = left + 'px'; b.style.top = top + 'px'; b.style.visibility = 'visible';
    if (r && side && o.place !== 'bl') {
      const tail = document.createElement('div'); tail.className = 'cm-tail';
      const cx = Math.max(left + 26, Math.min(left + W - 26, r.left + r.width / 2)), cy = Math.max(top + 26, Math.min(top + H - 26, r.top + r.height / 2));
      if (side === 'right') { tail.style.left = '-13px'; tail.style.top = (cy - top - 11) + 'px'; tail.style.borderRight = 'none'; tail.style.borderTop = 'none'; }
      if (side === 'left') { tail.style.right = '-13px'; tail.style.top = (cy - top - 11) + 'px'; tail.style.borderLeft = 'none'; tail.style.borderBottom = 'none'; }
      if (side === 'below') { tail.style.top = '-13px'; tail.style.left = (cx - left - 11) + 'px'; tail.style.borderBottom = 'none'; tail.style.borderRight = 'none'; }
      if (side === 'above') { tail.style.bottom = '-13px'; tail.style.left = (cx - left - 11) + 'px'; tail.style.borderTop = 'none'; tail.style.borderLeft = 'none'; }
      b.appendChild(tail);
    }
  } };
})();
"""

def hold(text, extra=0.0):
    return max(5.0, len(text.split()) * 0.30 + 2.2) + extra

def slide_payload(cfg):
    """captions.py's flat shape -> the JS slide() function's shape. Edit captions.md, not this."""
    image = None
    if cfg.get("image"):
        raw = (Path(__file__).parent / "assets" / cfg["image"]).read_bytes()
        image = "data:image/jpeg;base64," + base64.b64encode(raw).decode()
    return dict(image=image, title=cfg["title"], lead=cfg["lead"],
                cola=dict(h=cfg["col_a_heading"], lines=cfg["col_a_lines"]),
                colb=dict(h=cfg["col_b_heading"], lines=cfg["col_b_lines"]),
                verdict=cfg["verdict"], wide=bool(cfg.get("wide")))

def slide_hold_text(cfg):
    return " ".join([cfg["lead"], *cfg["col_a_lines"], *cfg["col_b_lines"], cfg["verdict"]])

def hold_slide(cfg, extra=0.0, cap=30.0):
    # Owner rule (2026-11-22): no slide is held longer than 10 seconds. The text in captions.md is trimmed to be skimmed in that time.
    return min(10.0, max(6.0, len(slide_hold_text(cfg).split()) * 0.25 + 3.0))

def first_sentence(s, limit=150):
    """A caption fact line: the text up to its first full stop, never cut mid-word."""
    s = (s or "").strip().split("\n")[0]
    cut = s.find(". ")
    s = s[:cut + 1] if cut > 0 else s
    return s if len(s) <= limit else s[:limit].rsplit(" ", 1)[0] + "..."



def main():
    WORK.mkdir(parents=True, exist_ok=True)
    result = {"ok": False}
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            tempfile.mkdtemp(prefix="meridian-take-"), headless=True,
            viewport={"width": VW, "height": VH}, device_scale_factor=_prof["dsf"], color_scheme="light",
            record_video_dir=str(WORK / "pw-video"),
            record_video_size={"width": VW, "height": VH})
        ctx.add_init_script("window.__cmScale = " + json.dumps(SCALE) + ";")
        ctx.add_init_script("window.__pillText = " + json.dumps("SAMPLE: simulated stand-in, not a live run" if SAMPLE and not HEADLESS_REAL else None) + ";")
        ctx.add_init_script(OVERLAY)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(APP + "/")
        page.wait_for_selector('[data-testid="mode-select"]')
        if page.locator('[data-testid="theme-select"]').count():
            page.select_option('[data-testid="theme-select"]', THEME)
        page.wait_for_timeout(1500)
        mode = page.evaluate("fetch('/api/info').then(r => r.json()).then(j => j.source)")
        log("lab mode:", mode)
        if HEADLESS_REAL and mode != "real":
            raise RuntimeError("HEADLESS_REAL needs Real mode; switch it in the UI first")
        if SAMPLE and not HEADLESS_REAL and mode == "real":
            page.select_option('[data-testid="mode-select"]', "mock"); page.wait_for_timeout(800)
            log("switched to mock for the sample cut")
        count = {"n": 0}
        TOTAL = 2 + len(SCENES)   # sign-in, the scenes, one closing hop-line

        def bubble(key, target=None, lines=None, secs=None, prefer=None):
            count["n"] += 1
            st = STEPS[key]
            page.evaluate("o => window.__cm.cap(o)", dict(n=count["n"], total=TOTAL, title=st["title"], text=st["text"], target=target, lines=lines, prefer=prefer))
            page.wait_for_timeout(int((secs if secs is not None else hold(st["text"] + " ".join(lines or []))) * 1000 * (0.04 if REHEARSE else 1)))
            page.evaluate("() => window.__cm.clear()")

        def show_slide(cfg, name="slide"):
            page.evaluate("o => window.__cm.slide(o)", slide_payload(cfg))
            page.wait_for_timeout(int(hold_slide(cfg) * 1000 * (0.04 if REHEARSE else 1)))
            page.evaluate("() => window.__cm.clear()")

        def run_scene(uc, key, wait_s=25):
            # The prompt picker is a <select> (wtt-select, options wtt-opt-<uc>) since the dropdown
            # replaced the chip wall (2026-11-23): select by value, it fires onSay and resets itself.
            page.select_option('[data-testid="wtt-select"]', uc)
            deadline = time.time() + (wait_s * 0.2 if REHEARSE else wait_s)
            while time.time() < deadline:
                if "nothing run yet" not in page.inner_text('[data-testid="evidence-count"]'):
                    break
                page.wait_for_timeout(400)
            else:
                raise RuntimeError(f"{uc}: the run never started")
            page.wait_for_timeout(int((wait_s if not REHEARSE else 0.5) * 1000))
            ev = page.inner_text('[data-testid="evidence-count"]').strip()
            log(f"{uc}: evidence={ev!r}")
            result[f"{uc}_evidence"] = ev
            bubble(key, target='[data-testid="evidence-count"]', prefer="left")

        show_slide(OPENING_SLIDE, name="slide-opening")
        page.evaluate("() => window.__cm.clear()")
        if HEADLESS_REAL:
            page.click('[data-testid="sign-in"]')
            page.wait_for_timeout(800)
            page.click('button:has-text("Sign in")')
            page.wait_for_selector("text=Signed in", timeout=30000)
        bubble("signin", target='[data-testid="mode-select"]', prefer="below")
        for uc in SCENES:
            run_scene(uc, uc.lower())
        bubble("hops", target='[data-testid="evidence-count"]', prefer="below")
        page.evaluate("() => window.__cm.clear()")
        show_slide(CLOSING_SLIDE, name="slide-closing")
        page.wait_for_timeout(200 if REHEARSE else 1500)
        result["ok"] = True
        video = page.video
        ctx.close()
        if video:
            path = video.path()
            if path and Path(path).exists():
                Path(path).replace(OUT)
                log("video:", OUT)
        (WORK / "result.json").write_text(json.dumps(result, indent=1))
        log("result:", json.dumps(result))

if __name__ == "__main__":
    main()
