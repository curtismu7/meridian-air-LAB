#!/usr/bin/env python3
"""The Meridian Air mock-first take, on the shared Story code: opens the lab (default http://127.0.0.1:7832), walks the video's scene tour (take.py's
SCENES) with numbered captions drawn by the shared overlay and held for the shared formulas, and the two full-screen slides. SAMPLE=1 is the default cut
the standards require first (a SAMPLE pill on screen, mock only); REHEARSE=1 runs it fast with no recording; HEADLESS_REAL=1 records the Real-mode cut
(sign-in included, refuses without it).

Usage: python3 take.py <work_dir>
  work_dir gets: sample.mp4 (SAMPLE=1) or take.mp4 (HEADLESS_REAL=1), take.log, result.json
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
OUT = WORK / ("take.mp4" if HEADLESS_REAL else "sample.mp4")
SCENES = ["MA1", "MA2", "MA7", "MA5", "MA6", "MA4", "MA9"]   # the sample's tour order
TOTAL = 2 + len(SCENES)   # sign-in, the scenes, one closing hop-line

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
    global OPENING_SLIDE, CLOSING_SLIDE, STEPS, SLIDES
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
        page.wait_for_timeout(1500)
        mode = page.evaluate("fetch('/api/info').then(r => r.json()).then(j => j.source)")
        log("lab mode:", mode)
        if HEADLESS_REAL and mode != "real":
            raise RuntimeError("HEADLESS_REAL needs Real mode; switch it in the UI first")
        if SAMPLE and not HEADLESS_REAL and mode == "real":
            page.select_option('[data-testid="mode-select"]', "mock"); page.wait_for_timeout(800)
            log("switched to mock for the sample cut")
        count = {"n": 0}
        shots = os.environ.get("REHEARSE_SHOTS")

        def snap(name):
            if REHEARSE and shots:
                page.wait_for_timeout(300); Path(shots).mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(Path(shots) / f"{name}.png"))

        def bubble(key, target=None, lines=None, secs=None, prefer=None):
            """One numbered caption, drawn by the shared overlay and held for the shared formula."""
            count["n"] += 1
            st = STEPS[key]
            page.evaluate("o => window.__cm.cap(o)", dict(n=count["n"], total=TOTAL, title=st["title"], text=st["text"], target=target, lines=lines, prefer=prefer))
            snap(f"step-{count['n']:02d}-{key}")
            page.wait_for_timeout(int((secs if secs is not None else hold_bubble(page, st["text"], lines)) * 1000 * (0.04 if REHEARSE else 1)))
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

        def run_scene(uc, key, wait_s=25):
            # The prompt picker is a <select> (wtt-select, options wtt-opt-<uc>) since the dropdown
            # replaced the chip wall (2026-11-23): select by value, it fires onSay and resets itself.
            page.select_option('[data-testid="wtt-select"]', uc)
            # The evidence column (and its count line) lives on the Agent detail tab; the chat tab is the
            # default view, so bring the evidence into view before waiting for the run to start.
            if page.locator('[data-testid="evidence-count"]').count() == 0:
                page.evaluate("() => { const t = document.querySelector('[data-testid=\"nav-agent\"]'); if (t) t.click(); }")
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
        if HEADLESS_REAL:
            page.click('[data-testid="sign-in"]')
            page.wait_for_timeout(800)
            page.click('button:has-text("Sign in")')
            page.wait_for_selector("text=Signed in", timeout=30000)
        bubble("signin", target='[data-testid="mode-select"]', prefer="below")
        for uc in SCENES:
            run_scene(uc, uc.lower())
        bubble("hops", target='[data-testid="evidence-count"]', prefer="below")
        show_slide(CLOSING_SLIDE, name="closing")
        page.wait_for_timeout(200 if REHEARSE else 1500)
        if MASK_SCRIPT:   # a public video: no real value may have been on the page at ANY point of this take
            try: leaks = page.evaluate("() => window.__onscreenMaskLeaks ? window.__onscreenMaskLeaks() : -1")
            except Exception: leaks = -1
            result["mask_leaks"] = leaks; log("on-screen mask check: leaks =", leaks)
            if leaks != 0: result["ok"] = False; log("WARNING: real values reached the page (or the mask did not load): do not publish this take")
        result["ok"] = True
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
