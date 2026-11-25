# meridian-air-LAB

Demo-tier standalone lab: the airline story "The Airline That Runs on Agents" — 11 chat-first scenes (MA1-MA11), each started by a named agent, played as movie-reel hops. A fork of customer-agent-LAB with the catalog replaced; a mock engine produces every token, hop and decision offline, Real mode is owner-only.

## Run / test

- Run: `npm run build` once, then `./scripts/run.sh` (http://localhost:7832/) or `ALLOW_MOCK_SIGNIN=1 npm start`. Web dev: server, then `npm run dev -w web` (Vite 7834, `/api` proxied). E2E: `npm run e2e`.
- Test: `npm test` (server is `node --test test/*.test.js` — pass the glob exactly, never named files: node --test ignores it as a filter; web is vitest; scripts are `node --test scripts/*.test.mjs`). Preflight `npm run doctor`; reset `npm run reset`; smoke `npm run smoke`. Docker: `HOST_PORT=7834 docker compose up --build -d` (OrbStack, never Docker Desktop). Node 26 only. Ports 7800-7999 (app 7832, Docker 7834).

## Rules that bite

- **Vendored dirs are pinned, never hand-edit:** `web/src/styles/standalone-ui.css`, `web/src/top-menu/` (pins: `web/src/top-menu/top-menu.sha256`, `top-menu.css.sha256`), `web/src/diagram-kit/`, `web/src/gateway-trace/` (pin `server/gateway-trace.sha256`). Re-vendor from AI-DEMO-Standalone `shared/` and regenerate the pin, or the conformance rule-22 gate and repo tests fail.
- **The setup sidebar is the shared `Rail`** (`web/src/rail/`, vendored from `AI-DEMO-Standalone/shared/rail/`; change the canonical copy, then re-vendor, never edit here). It opens collapsed (`defaultCollapsed`, storage key `ma.setup`: "1" collapsed, "0" expanded, absent = the default), toggle `data-testid="rail-toggle"` (the old `sidebar-toggle` is gone). Browser tests and recordings that drive the sidebar's picker must expand it first or seed `ma.setup` = "0".
- **`MA_` env names** (not `CAL_`): `MA_LAB_MODE`, `MA_BRAIN_URL`, `MA_ALLOW_LIVE`, `MA_USER_*`/`MA_AGENT_*`, `MA_GATEWAY_*`, `MA_DEMO_USERNAME`, plus the shared `PINGONE_*`. Compose passes an exact name list; a test bans `env_file` and secret-like names in the compose file. `.env` is per-app, git-ignored.
- **The 11 scenes are generated:** edit `scripts/gen-scenes.mjs`, then run `node scripts/gen-scenes.mjs`. Never hand-edit `data/usecases.json`. Scene ids are MA1-MA11; a new scene goes through gen-scenes and its tests.
- **Tests:** server 292 pass on Node 26. Web tests are vitest, not jest — do not mix the expect signatures.
- No emojis; no AI attribution lines anywhere (`.githooks` and CI enforce it).
- **Never-repeat (MA4/MA5 Real, 2026-11-25):** a Real hop that fails leaves the agent-reply hop `not-run`, which the UI shows as "+1 not in this run" — that blemish means the Real call is failing, not that a hop is missing. Read the run's reply text first. Two causes so far: (1) the lab container resolves the shared lab proxy host (MA_A2A_URL) to its own loopback (compose `extra_hosts` points it at the host); (2) the desktop console resets TLS unless the client sends SNI/Host `local.procyon.ai`, and lists keys at `/v1/agentaccesskeys?ObjectMeta.Namespace=default` (`/agentaccesskeys/default` is a 401). `registry.js` swallows the first host's error when it falls back, so debug with a direct request.
- **Test the lab from your own worktree on its own port** (`HOST_PORT=7852 docker compose -p ma-wt-<name> up -d --build`): the shared `meridian-air-lab` compose project gets recreated by other sessions from other checkouts, and take.py's captions check then fails.
- **Gateway retries (2026-11-25):** the SE gateway sometimes gives no answer under load (seen only while recording). `mcpClient.js` retries ONLY the read-only setup calls (initialize, notifications/initialized, tools/list); a `tools/call` is never re-sent (double booking). A retried answer carries `attempts`. Do not widen `RETRYABLE_METHODS` to tool calls.
