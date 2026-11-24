# Meridian Air video (standalone lab): one tour of the trust plane, mock cut first

Follows the demo family's video standards: `AI-DEMO-Standalone/shared/story/VIDEO.md`.
Order of work: `SCRIPT.md` (sources first) -> `captions.md` (wording) -> **sample** -> review -> live take.

One part: sign-in (mock persona), then scenes MA1, MA2, MA7, MA5, MA6, MA4, MA9 via the WHAT-TO-TYPE dropdown, opening and closing with a slide.

    # sample: mock stand-ins, headless, labelled SAMPLE (no tenant, no gateway, no IdP)
    PORT=7845 ALLOW_MOCK_SIGNIN=1 node server/src/index.js        # from the repo root (mock lab)
    APP_URL=http://127.0.0.1:7845 SAMPLE=1 python3 video/take.py /tmp/ma-sample   # -> sample.mp4

    # rehearsal (fast, no video; REHEARSE_SHOTS=dir keeps a still per caption and slide)
    APP_URL=http://127.0.0.1:7845 REHEARSE=1 SAMPLE=1 REHEARSE_SHOTS=/tmp/ma-shots python3 video/take.py /tmp/ma-rehearse

    # live take (the lab in Real mode with the LIVE route): exact-size headless recording is the default
    HEADLESS_REAL=1 APP_URL=http://127.0.0.1:7832 PROFILE=monitor python3 video/take.py <dir>   # 1920x1080, app text L
    HEADLESS_REAL=1 APP_URL=http://127.0.0.1:7832 PROFILE=laptop  python3 video/take.py <dir>   # 1800x1169, app text S

**The video uses the live Story's own code (2026-11-24).** `take.py` has no copy of the pop-up code, the hold formulas or the wording parser: the pop-ups and slides are the vendored `web/src/story/overlay.js`, the holds are `web/src/story/hold.js` (Normal speed is what the video always did), and the wording is whatever the running lab serves at `GET /api/captions` (the shared Story parser reading `captions.md`; this lab's `GET /api/story` is its cast story, so the video wording uses a different route). `story_bridge.py` turns the vendored modules into classic scripts for the browser; `video/test_story_bridge.py` (run by `node --test test/videoBridge.test.js` / `npm test`) fails if take.py grows its own copy. So the lab must be running (it always had to be), and to change a pop-up or a hold you change `shared/story` in AI-DEMO-Standalone and re-vendor. A rehearsal of this version gave stills matching the previous take.py's apart from random workspace ids in the evidence-count text (8 of 11 stills differ only there); the old-vs-new bubble frame differs in 0.5% of pixels.

Needs node (with the repo's `node_modules`), python3 with playwright and pillow, ffmpeg, and tesseract (`brew install tesseract`). `out/` and `assets/` are gitignored. This lab's scenes show no real tenant data in the mock cut, so no `assets/` console screenshots or `.redacted.jpg` pairs are needed; if a Real cut ever puts a hostname, client id or policy name on screen, follow the masking rules in the A2A lab's `video/README.md` and `onscreen_mask.py`'s leak checks (already wired into `take.py`).

The first page of a published video is its title (rule 29). `take.py` cuts each headless recording to start just before the first slide is drawn, and to stop just after the closing slide has been held; the window is in `result.json` as `clip`. So the app page the recording opens on is not in the video. The take refuses to claim success (`result.json`) unless all 7 scene runs completed with their expected evidence lines and the on-screen mask found no leaks; sign-in uses the lab's mock sign-in (`ALLOW_MOCK_SIGNIN=1` must be set, and the lab must be in Mock mode unless `HEADLESS_REAL=1`).
