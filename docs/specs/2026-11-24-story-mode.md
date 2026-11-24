# Story mode in meridian-air-LAB spec

**Status:** built   **Owner:** curtis

## Goal
Add the shared Story mode (guided walk-through with pop-up bubbles and slides) to meridian-air-LAB, per `AI-DEMO-Standalone/shared/story/ADDING-TO-A-LAB.md`. The viewer gets a Demo | Story toggle in the top menu; Story walks the lab's chat scenes in the same order as the recorded video (`video/take.py`), reading the same wording file (`video/captions.md`). Demo mode is byte-identical in behaviour when Story is off.

## Acceptance criteria
1. `node scripts/story-checkPin.mjs .` prints `story pin ok`; the vendored files under `web/src/story/` and `server/src/story/` match `shared/story` byte for byte at the pinned commit.
2. `GET /api/story` returns 200 with `{opening, closing, steps, slides, sourceSha256}`; a broken `video/captions.md` yields a 500 that names the wording problem and never a server path; an edit to the file shows on the next request without a restart.
3. `npm test` passes, including the new story tests: pin check, parity both ways, bubble order/counts read from `take.py` (10 numbered bubbles: signin + 8 scenes + hops), public-safe wording, the route tests, wiring tests.
4. The parity test fails when a caption key or a script step drifts (a real assertion, not a stub).
5. With Story off (Demo default), the page renders and behaves exactly as before; the served page does not mention Story.
6. Story runs in Mock with no network calls of its own and is labelled "Simulated"; runs announce `ma:run-start`/`ma:run-end` so run-done steps settle; the prompt step pre-fills the composer and the bar says "Your turn: press Send, then Next".
7. In a real browser (rule 9): Story walks from opening slide through the mock scenes to the closing slide at both 1920x1080 and 1800x1169; Esc exits cleanly; screenshots are read.

## Unhappy paths
- Story wording file missing/unreadable: 500 with a fixed message, no path.
- Run fails mid-story: the engine shows the failure message, never advances past it; a Reset tells the waiting step.
- `?story=1` on a stale build: lazy chunk load failure is caught by the story boundary, Demo mode survives.
- Prompt dropdown disabled mid-run: send() throws; Play stops with a message instead of stalling.
- Sign-in not possible (Real without sign-in): the signin step targets the mode select (as the video does), skipped if missing.

## Out of scope
- Re-recording the video on the shared code (runbook section 9) — a follow-up.
- Story in other labs; changes to `shared/story` itself; Real-mode walk beyond a smoke pass (Real is owner-only and was already walked via the dd-* audit).

## Protected / must not break
- The existing `/api/story` (vertical story data) is NOT reused: the new route must not collide. Decision: the lab's existing `GET /api/story?vertical=` keeps its name (it serves the cast story for the UI); the Story-mode wording route is `GET /api/captions` to avoid a breaking change to an existing endpoint and its tests.
- Vendored pins (`top-menu`, `standalone-ui.css`, `diagram-kit`, `gateway-trace`) untouched.
- The 11 scenes, generated data, and all existing 251+ web / 269 server tests stay green.
- Docker: `video/captions.md` copied into the image; `MA_` env naming rules respected (no new env vars needed).

## Verification plan
- `npm test` (server node --test + web vitest) on this Mac; heavy runs to the Air via `air-test` if needed.
- `node scripts/story-checkPin.mjs .`
- Browser check with the Playwright MCP tools against the running lab: walk Story in Mock at both sizes, read screenshots, test Esc and prompt send.
- PR waits for the owner's merge.
