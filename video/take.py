#!/usr/bin/env python3
"""The Meridian Air mock-first take, on the shared Story code: opens the lab (default http://127.0.0.1:7832), walks the video's scene tour (take.py's
SCENES) with numbered captions drawn by the shared overlay and held for the shared formulas, and the two full-screen slides. SAMPLE=1 is the default cut
the standards require first (a SAMPLE pill on screen, mock only); REHEARSE=1 runs it fast with no recording; HEADLESS_REAL=1 records the Real-mode cut
(sign-in included, refuses without it).

Usage: python3 take.py <work_dir>
  work_dir gets: sample.mp4 (SAMPLE=1) or take.mp4 (HEADLESS_REAL=1), take.log, result.json
Two cuts (owner, 2026-11-25), both on the Movie reel page (it reads easier than the sequence diagram):
  CUT=overview (default)  the scene tour: intro slide, the hop list, the reel
  CUT=detail              the walk-through: per scene, click every reel frame, scroll to its detail and explain it, with the fields that matter highlighted
                          (output detail.mp4 / detail-sample.mp4; SCENES_ONLY=MA1,MA4 limits it)
"""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright
import captions, onscreen_mask
from story_bridge import overlay_script, slide_payload as _slide_payload, hold_bubble, hold_slide as _hold_slide

OPENING_SLIDE = CLOSING_SLIDE = STEPS = SLIDES = None   # filled in main() from the lab's /api/captions (the one shared parser)
MASK_SCRIPT = None   # the on-screen masking script, built in main() from the lab's .env

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
CUT = os.environ.get("CUT", "overview")
if CUT not in ("overview", "detail"): raise SystemExit(f"take.py: CUT must be overview or detail, not {CUT!r}")
DETAIL = CUT == "detail"
OUT = WORK / (("detail" if DETAIL else "take") + ".mp4" if HEADLESS_REAL else ("detail-sample.mp4" if DETAIL else "sample.mp4"))
SCENES = ["MA1", "MA2", "MA3", "MA4", "MA5", "MA6", "MA7", "MA8", "MA9", "MA10", "MA11"]   # the full catalog, one intro slide before each (owner, 2026-11-25)
if os.environ.get("SCENES_ONLY"): SCENES = [u.strip() for u in os.environ["SCENES_ONLY"].split(",") if u.strip() in SCENES]
TOTAL = None   # set in main(): sign-in + 2 captions per scene (hops, reel) (overview cut)

def log(*a):
    WORK.mkdir(parents=True, exist_ok=True)
    with (WORK / "take.log").open("a") as f:
        print(*a, file=f, flush=True)

def public_images(slides, rules, assets):
    """Every image any slide of this take can show, mapped to its OCR-checked redacted copy. Refuses before recording."""
    return {s["image"]: onscreen_mask.public_image(s["image"], assets, rules) for s in slides if s and s.get("image")}

def slide_payload(cfg, assets, images):
    """captions.py's flat slide -> the shared overlay's shape (story_bridge.slide_payload).
    A masked take shows only the redacted copy that main() checked; an image it did not check is never shown."""
    if cfg.get("image") and images is not None:
        cfg = {**cfg, "image": images.get(cfg["image"])}   # None (no image) if somehow unchecked: fail safe, without stopping the recorder
    return _slide_payload(cfg, assets)

def clip_window(first, last, delay=0.05, tail=0.8):
    """Where to cut the recorded video (seconds from the start of the page's own recording): from just after the first slide is drawn, so the first page
    of the video is the title (rule 29), to just after the closing slide has been held. A take with no slide is left whole. Returns {'start': s, 'end': s or None}."""
    if first is None: return {"start": 0.0, "end": None}
    start = first + delay   # the slide is painted within a frame of being drawn: the video never shows the page underneath
    return {"start": round(start, 2), "end": round(last + tail, 2) if last is not None else None}

def main():
    global OPENING_SLIDE, CLOSING_SLIDE, STEPS, SLIDES, TOTAL
    WORK.mkdir(parents=True, exist_ok=True)
    result = {"ok": False}
    try:   # the wording, from the lab's /api/captions (the one shared parser), checked to be this checkout's captions.md
        OPENING_SLIDE, CLOSING_SLIDE, STEPS, SLIDES = captions.load(APP, Path(__file__).parent / "captions.md")
    except ValueError as e:
        log("cannot read the wording:", e); raise SystemExit(f"take.py: {e}")
    # Every take is masked (the sample too): real hosts from the lab's .env never reach the page.
    global MASK_SCRIPT
    env_file = Path(os.environ.get("MASK_ENV", str(Path.home() / "Development/meridian-air-LAB/.env")))
    try:
        rules = onscreen_mask.mask_rules(env_file)
    except (OSError, onscreen_mask.MaskConfigError) as e:
        log("no on-screen masks: refusing the take"); raise SystemExit(f"take.py: cannot build the on-screen masks from {env_file} ({type(e).__name__}): a public video must not show real hosts; set MASK_ENV to the lab's .env")
    MASK_SCRIPT = onscreen_mask.mask_script(rules)
    log("on-screen masks:", len(rules["pairs"]), "rules,", len(rules["detect"]), "leak detectors")
    ASSETS = Path(__file__).parent / "assets"
    images = public_images([OPENING_SLIDE, CLOSING_SLIDE, *SLIDES.values()], rules, ASSETS)
    log("slide images: redacted copies checked by OCR:", len(images))
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            tempfile.mkdtemp(prefix="meridian-take-"), headless=True,
            viewport={"width": VW, "height": VH}, device_scale_factor=_prof["dsf"], color_scheme="light",
            record_video_dir=str(WORK / "pw-video"),
            record_video_size={"width": VW, "height": VH})
        if MASK_SCRIPT: ctx.add_init_script(MASK_SCRIPT)   # first, so nothing real is ever drawn
        ctx.add_init_script("window.__cmScale = " + json.dumps(SCALE) + ";")
        ctx.add_init_script("window.__pillText = " + json.dumps("SAMPLE: simulated stand-in, not a live run" if SAMPLE and not HEADLESS_REAL else None) + ";")
        ctx.add_init_script(overlay_script())
        # The take's own bubble sizing (owner 2026-11-25): smaller caption bubbles than the shared overlay's default,
        # so more of the app shows through. Only width and font; placement logic still measures the drawn bubble.
        ctx.add_init_script("""
          document.addEventListener('DOMContentLoaded', () => {
            const S = window.__cmScale || 1; const st = document.createElement('style'); st.id = 'cm-take-style';
            st.textContent = `.story-bub{width:${Math.round(360 * S)}px !important;font:${Math.round(15 * S)}px/1.35 system-ui,sans-serif !important;padding:${Math.round(11 * S)}px ${Math.round(15 * S)}px ${Math.round(11 * S)}px ${Math.round(52 * S)}px !important}
              .story-bub .n{width:${Math.round(28 * S)}px;height:${Math.round(28 * S)}px;font:700 ${Math.round(15 * S)}px/${Math.round(28 * S)}px system-ui !important}
              .story-bub ul{margin:${Math.round(6 * S)}px 0 0 !important} .story-bub li{font-size:${Math.round(13 * S)}px !important}`;
            document.documentElement.appendChild(st);
          });
        """)
        if RECORD := (SAMPLE or HEADLESS_REAL) and not REHEARSE:   # the page's own video starts when the page is created: make it ours, so the clip window is measured from the same moment
            initial = list(ctx.pages); page = ctx.new_page(); clock0 = time.monotonic()
            for p in initial: p.close()
        else:
            page = ctx.pages[0] if ctx.pages else ctx.new_page(); clock0 = time.monotonic()
        clip = {"first": None, "last": None}   # seconds from clock0: when the first slide is drawn and when the closing slide has been held
        page.goto(APP + "/")
        page.wait_for_selector('[data-testid="mode-select"]')
        if page.locator('[data-testid="theme-select"]').count():
            page.select_option('[data-testid="theme-select"]', THEME)
        # The Agent detail tab first: the sidebar-toggle button lives there (the Chat tab has none).
        page.evaluate("() => { document.querySelector('[data-testid=\"nav-agent\"]')?.click(); }")
        page.wait_for_timeout(600)
        # Collapse the setup sidebar (owner, 2026-11-25): chat and evidence get the room before anything is recorded.
        if page.locator('[data-testid="sidebar-toggle"][aria-expanded="true"]').count():
            page.click('[data-testid="sidebar-toggle"]')
            page.wait_for_timeout(400)
            log("setup sidebar collapsed")
        # The evidence column shows the MOVIE REEL, never the sequence diagram (owner, 2026-11-25: the video uses the reel). It opens on Sequence, so switch it
        # once here; the choice holds for the whole take.
        if page.locator('[data-testid="evtab-reel"]').count():
            page.click('[data-testid="evtab-reel"]'); page.wait_for_timeout(400)
            log("evidence column on the movie reel")
        page.wait_for_timeout(1500)
        # the page's own mode (the badge): a headerless /api/info reports the DEFAULT workspace, not this page's
        page_mode = lambda: page.inner_text('[data-testid="mode-badge"]').strip().lower()
        mode = page_mode()
        log("lab mode:", mode)
        if HEADLESS_REAL and mode != "real":
            # through the UI: the button row (Sign in) is React state, an API-only switch leaves the page still in mock
            page.select_option('[data-testid="mode-select"]', "real"); page.wait_for_timeout(1200)
            mode = page_mode()
            log("switched to real for the real cut; mode:", mode)
        if HEADLESS_REAL and mode != "real":
            raise RuntimeError("HEADLESS_REAL needs Real mode; could not switch it")
        if SAMPLE and not HEADLESS_REAL and mode == "real":
            page.select_option('[data-testid="mode-select"]', "mock"); page.wait_for_timeout(800)
            log("switched to mock for the sample cut")
        count = {"n": 0}
        TOTAL = 1 + 2 * len(SCENES)   # captions only (slides are not counted): sign-in, then per scene the hop list and the reel
        shots = os.environ.get("REHEARSE_SHOTS")

        def snap(name):
            if REHEARSE and shots:
                page.wait_for_timeout(300); Path(shots).mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(Path(shots) / f"{name}.png"))

        def bubble(key, target=None, lines=None, secs=None, prefer=None):
            """One numbered caption, drawn by the shared overlay and held for the shared formula. {hops} in the wording is the page
            engine's live fill (Story mode); the video shows the hop lines beside the text instead, so the placeholder is dropped here."""
            st = STEPS[key]
            caption(st["title"], st["text"].replace(" {hops}", ""), target=target, lines=lines, secs=secs, prefer=prefer)

        def caption(title, text, target=None, lines=None, secs=None, prefer=None, n=None, total=None):
            """A caption with wording given here (the per-scene diagram shots), not from captions.md. n/total override the take's own count (the detail cut counts steps within a scene)."""
            count["n"] += 1
            page.evaluate("o => window.__cm.cap(o)", dict(n=n if n is not None else count["n"], total=total if total is not None else TOTAL, title=title, text=text, target=target, lines=lines, prefer=prefer))
            snap(f"step-{count['n']:02d}")
            page.wait_for_timeout(int((secs if secs is not None else hold_bubble(page, text, lines)) * 1000 * (0.04 if REHEARSE else 1)))
            page.evaluate("() => window.__cm.clear()")

        def show_slide(cfg, name="slide"):
            payload = slide_payload(cfg, ASSETS, images)
            if clip["first"] is None: clip["first"] = time.monotonic() - clock0
            page.evaluate("o => window.__cm.slide(o)", payload)
            snap(name)
            total_ms = int(_hold_slide(page, payload) * 1000 * (0.04 if REHEARSE else 1))   # the shared formula (no slide is held longer than 10 s)
            pre_ms = min(6000, int(total_ms * 0.45))
            page.wait_for_timeout(pre_ms)
            page.evaluate("() => window.__cm.scrollSlide()")   # the shared overlay scrolls a tall card to its verdict
            page.wait_for_timeout(max(0, total_ms - pre_ms))
            page.evaluate("() => window.__cm.clear()")
            if name == "closing": clip["last"] = time.monotonic() - clock0

        def walk_frames(uc):
            """The detail cut: click every frame of the reel and explain it (owner, 2026-11-25). No pop-up: the detail panel sits right under the reel, so the
            step is scrolled into view and the lab's own highlights do the pointing: the colored "Look at" line, then the warm-highlighted fields that matter.
            The words come from the page (the hop's own narrative, key fact and decision), so they always match what this run did."""
            frames = page.eval_on_selector_all('[data-testid^="frame-"]', "els => els.map(e => e.dataset.testid)")
            page.wait_for_timeout(600)
            for i, fid in enumerate(frames, 1):
                page.evaluate("() => window.scrollTo(0, 0)")
                page.click(f'[data-testid="{fid}"]')
                page.wait_for_selector('[data-testid="step-detail"]', timeout=10000)
                page.wait_for_timeout(500 if not REHEARSE else 50)
                # 1. Explain the step with the reel still in view (the selected frame is lit), pointing at "What happened".
                info = page.evaluate("""() => {
                    const q = (s) => document.querySelector(s); const t = (e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : '');
                    return { title: t(q('[data-testid="step-detail"] h3')), status: t(q('[data-testid="sdp-status"]')), narrative: t(q('[data-testid="sdp-narrative"]')), decision: t(q('[data-testid="decision"]')) };
                }""")
                head = f"{uc} · {info['title']}" + (f" ({info['status']})" if info["status"] and info["status"].lower() != "done" else "")
                caption(head, (info["narrative"] if len(info["narrative"]) <= 300 else info["narrative"][:300].rsplit(" ", 1)[0] + "…") or info["title"], target='[data-testid="sdp-narrative"]', prefer="below", n=i, total=len(frames))
                # 2. Then the field that matters. Open every collapsed field of the request and response so the values (grant type, scope, tool,
                #    arguments) are on screen, pick the most telling visible one (the tool and its arguments first, the bare status last) and scroll to it.
                hot = page.evaluate("""() => {
                    document.querySelectorAll('[data-testid="step-detail"] details:not([open])').forEach((d) => { d.open = true; });
                    const t = (e) => (e ? e.textContent.trim().replace(/\\s+/g, ' ') : '');
                    // The most telling field first: the decision, the tool and its arguments, the money and the pushed details, scope and grant;
                    // tokens, trace ids and the bare HTTP status last (they are on every hop and say little).
                    const rows = [...document.querySelectorAll('[data-testid="step-detail"] .jform__row[data-hot="true"]')].filter((r) => r.getClientRects().length > 0);
                    const leaf = (k) => k.split('.').pop();
                    const score = (r) => {
                        const k = t(r.querySelector('.jform__k')), v = t(r.querySelector('.jform__v')), l = leaf(k);
                        if (l === 'status') return 90;
                        if (/authorization|access_token|id_token|refresh_token|traceparent|secret/i.test(k) || v.length > 100) return 80;
                        if (l === 'decision') return 0; if (l === 'tool' || k.endsWith('params.name')) return 1; if (k.includes('arguments')) return 2;
                        if (l === 'amount' || l === 'authorization_details') return 3; if (l === 'scope' || l === 'grant_type') return 4; return 50;
                    };
                    rows.sort((a, b) => score(a) - score(b));
                    document.querySelectorAll('[data-cm-pick]').forEach((e) => e.removeAttribute('data-cm-pick'));
                    const r = rows[0];
                    if (!r) return null;
                    r.setAttribute('data-cm-pick', '1');
                    return { key: t(r.querySelector('.jform__k')), val: t(r.querySelector('.jform__v')) };
                }""")
                if info["decision"]:
                    page.evaluate("() => document.querySelector('[data-testid=\"decision\"]').scrollIntoView({ block: 'center' })")
                    page.wait_for_timeout(300 if not REHEARSE else 50)
                    caption(head, f"The decision: {info['decision'][:160]}", target='[data-testid="decision"]', prefer="left", secs=4, n=i, total=len(frames))
                elif hot:
                    val = hot["val"] if len(hot["val"]) <= 70 else hot["val"][:40] + "… (shortened)"
                    page.evaluate("() => document.querySelector('[data-cm-pick]').scrollIntoView({ block: 'center' })")
                    page.wait_for_timeout(300 if not REHEARSE else 50)
                    caption(head, f"Highlighted: {hot['key']}" + (f" = {val}" if val else "") + ". This is the field that matters in this step.",
                            target='[data-cm-pick]', prefer="left", secs=4, n=i, total=len(frames))
            page.evaluate("() => window.scrollTo(0, 0)")

        def run_scene(uc, key, wait_s=25):
            # The prompt picker is a <select> (wtt-select, options wtt-opt-<uc>) since the dropdown
            # replaced the chip wall (2026-11-23): select by value, it fires onSay and resets itself.
            page.select_option('[data-testid="wtt-select"]', uc)
            # The evidence column (and its count line) lives on the Agent detail tab; the chat tab is the
            # default view, so bring the evidence into view before waiting for the run to start.
            if page.locator('[data-testid="evidence-count"]').count() == 0:
                page.evaluate("() => { const t = document.querySelector('[data-testid=\"nav-agent\"]'); if (t) t.click(); }")
            # The count line names the run it shows ("MA3 · 9 hops · REAL"); before this scene's run lands it still shows the previous scene's (or "nothing run yet").
            # A real-mode run can take 5-10 s (MA7 once slower still), so allow up to 40 s, then a short settle: no fixed stretch of idle screen.
            deadline = time.time() + max(wait_s, 40)
            while time.time() < deadline:
                if page.inner_text('[data-testid="evidence-count"]').strip().startswith(uc + " "):
                    break
                page.wait_for_timeout(400)
            else:
                raise RuntimeError(f"{uc}: the run never started")
            page.wait_for_timeout(2000 if not REHEARSE else 300)
            ev = page.inner_text('[data-testid="evidence-count"]').strip()
            # A Real run that shows "+N not in this run" lost a hop to a transient failure (the SE gateway, or the registry, did not answer in time under
            # the recorder's load): run the scene again, up to twice, so the take shows a complete run. Mock always lists the hops it does not run, so
            # this is Real only. Every retry is logged and counted in result.json (a take that never recovers still records its blemish there).
            tries = 0
            while HEADLESS_REAL and " REAL" in ev and "not in this run" in ev and tries < 2:
                tries += 1
                log(f"{uc}: incomplete Real run ({ev!r}); retry {tries}")
                page.select_option('[data-testid="wtt-select"]', uc)
                page.wait_for_timeout(15000 if not REHEARSE else 500)   # the re-run shows the same text, so wait a window long enough for a Real run
                ev = page.inner_text('[data-testid="evidence-count"]').strip()
            if tries: result.setdefault("retries", {})[uc] = tries
            log(f"{uc}: evidence={ev!r}")
            result[f"{uc}_evidence"] = ev
            # The details the owner asked the video to show (2026-11-25): open every hop of this run so the
            # request/response JSON is on screen, then point the caption at the expanded hop list. The hop
            # labels come from the page, so the bubble names the tools this run actually used.
            if not DETAIL:
                page.evaluate("() => { const t = document.querySelector('[data-testid=\"hops-toggle\"]'); if (t && t.textContent.includes('Open all')) t.click(); }")
                page.wait_for_timeout(600)
                hops = page.eval_on_selector_all('[data-testid="hop"] summary .hop__label', "els => els.slice(0, 4).map(e => e.textContent.trim())")
                hop_lines = hops if hops else []
                if len(hops) > 4: hop_lines.append(f"... {len(hops)} hops in all")
                bubble(key, target='[data-testid="hops"]', lines=hop_lines or None, prefer="left")
            # The Movie reel page (owner, 2026-11-25: the reel is easier to follow than the sequence diagram, so the video
            # uses it). The page opens on the sequence tab; switch to the reel before anything is shown.
            page.click('[data-testid="full-sequence"]')
            page.wait_for_selector('[data-testid="page-sequence"]', timeout=15000)
            page.click('[data-testid="full-tab-reel"]')
            page.wait_for_selector('[data-testid="page-reel"]', timeout=15000)
            page.wait_for_timeout(1200)
            if DETAIL:
                walk_frames(uc)
            else:
                # A step the chat had selected would leave its detail open under the reel and hide behind the caption: show the reel alone.
                page.evaluate("() => { const b = document.querySelector('[aria-label=\"Close step detail\"]'); if (b) b.click(); }")
                page.wait_for_timeout(300)
                caption(f"{uc} · movie reel",
                        "One frame per hop of this run, left to right: who it ran on, what it did, the one fact that matters and the verdict. Click a frame for its detail.",
                        target='[data-testid="page-reel"] .fullpage__main', prefer="below", secs=6)
            page.click('[data-testid="back-to-chat"]')
            page.wait_for_selector('[data-testid="wtt-select"]', timeout=15000)

        show_slide(OPENING_SLIDE, name="slide-opening")
        if HEADLESS_REAL:
            page.click('[data-testid="sign-in"]')
            page.wait_for_selector('[data-testid="signin-password"]', timeout=10000)
            pw = os.environ.get("MA_VIDEO_PASSWORD")
            if not pw:
                raise RuntimeError("HEADLESS_REAL needs MA_VIDEO_PASSWORD in the environment (never committed)")
            page.fill('[data-testid="signin-password"]', pw)
            page.click('[data-testid="signin-submit"]')
            page.wait_for_selector("text=Signed in", timeout=30000)
        if not DETAIL: bubble("signin", target='[data-testid="mode-select"]', prefer="below")
        for uc in SCENES:
            slide = SLIDES.get(uc.lower())
            if slide:
                show_slide(slide, name=f"slide-{uc.lower()}")   # the intro: title, products used, the value (owner: a clear slide between use cases)
            run_scene(uc, uc.lower())
        show_slide(CLOSING_SLIDE, name="closing")
        page.wait_for_timeout(200 if REHEARSE else 1500)
        if MASK_SCRIPT:   # a public video: no real value may have been on the page at ANY point of this take
            try: leaks = page.evaluate("() => window.__onscreenMaskLeaks ? window.__onscreenMaskLeaks() : -1")
            except Exception: leaks = -1
            result["mask_leaks"] = leaks; log("on-screen mask check: leaks =", leaks)
            if leaks != 0: log("WARNING: real values reached the page (or the mask did not load): do not publish this take")
        blemished = [k[:-9] for k, v in result.items() if k.endswith("_evidence") and HEADLESS_REAL and " REAL" in v and "not in this run" in v]
        if blemished: log("WARNING: scenes that still show hops not run after the retries:", blemished); result["blemished"] = blemished
        result["ok"] = result.get("mask_leaks", 0) == 0 and not blemished   # a take that leaked, or still shows a failed hop, is never ok
        result["clip"] = clip_window(clip["first"], clip["last"]); log("clip window (s):", result["clip"])
        video = page.video
        ctx.close()
        if video:
            path = video.path()
            if path and Path(path).exists():
                out = WORK / ("sample-raw.mp4" if SAMPLE else "take-raw.mp4")
                Path(path).replace(out)
                w = result["clip"]; cut = ["-ss", str(w["start"])] + (["-t", str(round(w["end"] - w["start"], 2))] if w["end"] is not None else [])
                subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *cut, "-i", str(out), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", str(OUT)], check=True)
                out.unlink(missing_ok=True)
                log("video:", OUT)
        (WORK / "result.json").write_text(json.dumps(result, indent=1))
        log("result:", json.dumps(result))

if __name__ == "__main__":
    main()
