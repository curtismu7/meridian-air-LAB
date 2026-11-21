# Meridian Air LAB

The Airline That Runs on Agents. One day at Meridian Air, told in 11 chat-first scenes: the passenger books through an MCP gateway, the copilot's LLM calls are routed and budgeted, a partner agent from AWS arrives over A2A, an attacker tries prompt injection, a $4,000 refund needs a human, and the auditor asks Elasticsearch for evidence. A simulation: a mock engine produces every token, hop and decision offline. An owner-only Real mode makes real calls to one PingOne environment.

Tier: Demo

Repo: https://github.com/curtismu7/meridian-air-LAB

Catalog: D24

## The scenes

| Scene | Title | What it shows |
| --- | --- | --- |
| MA1 | The passenger books | MCP through one entry point: the Privilege gateway, OAuth 2.1 + PKCE, tools/list filtered per caller (`booking__book-seat`). |
| MA2 | The copilot picks a brain | LLM routing with virtual keys: the gateway enforces allowed models, the credential broker injects the provider key, no OpenAI/Anthropic key ever sits in an app. |
| MA3 | The CFO sleeps at night | Cost control: per-key rate limits (60 req/min) and monthly LLM budgets; the batch job that would burn six figures is denied with a reason, not a silent timeout. |
| MA4 | A partner agent from AWS | A2A from Amazon Bedrock AgentCore: delegation across the trust boundary, RFC 8693 with the act claim. |
| MA5 | Every agent has a badge | The Agent Registry: agent badges and registry entries decide which tools an agent sees at all. |
| MA6 | The $4,000 refund | CIBA with PingID: a held write, a push approval on a phone, the refund completes only after the human says yes. |
| MA7 | The attack | AI Guard blocks prompt injection: hostile text in a passenger message, the gateway refuses, the trace shows the block. |
| MA8 | Gold data stays gold | Fine-grained authorization: policy decides per field and per amount, not per route. |
| MA9 | Govern and audit | Guided: the whole landscape — who owns what, which policy fired where. Not computed. |
| MA10 | Keys never touch the agents | The credential broker and the sensor: virtual keys in, provider keys injected JIT, key theft stops being an incident class. |
| MA11 | The auditor asks Elasticsearch | Audit evidence by marker: every decision carries a searchable marker and the evidence is queryable. |

## Run from a clone

Prerequisites: Node 26. Docker (OrbStack) only for the Docker form.

```
git clone https://github.com/curtismu7/meridian-air-LAB.git
cd meridian-air-LAB
npm ci
npm run build
npm run doctor
ALLOW_MOCK_SIGNIN=1 npm start
```

Open http://localhost:7832/ (the server serves the web app it built into `web/dist`; the API is under `/api`). `./scripts/run.sh` does the install, the doctor and the start in one go and sets `ALLOW_MOCK_SIGNIN=1`, which is your opt-in to the mock persona sign-in on this machine. Mock mode needs no setup, no account and no network. For web development run the server and then `npm run dev -w web` (Vite on 7834, `/api` proxied to the server).

Try it:

```
curl -s -X POST localhost:7832/api/run/MA1 -H 'content-type: application/json' -d '{"vertical":"airlines"}'
```

Docker (optional):

```
HOST_PORT=7834 docker compose up --build -d
```

Open http://127.0.0.1:7834/ (health at `/api/health`). The port is published on `127.0.0.1` only; the container runs as a non-root user, read-only, capabilities dropped. Use OrbStack, never Docker Desktop.

## Ports, and what to do if the port is taken

```
Ports: meridian-air-LAB listens on 7832 (set with PORT, default 7832).
Port range for this app: 7800-7999.

If the port is taken:
1. Find what is using it:
   lsof -iTCP:7832 -sTCP:LISTEN -n -P
2. If it is an old copy of this app, stop that process: kill <PID>.
3. If it is something else, stop it, or start this app on another port:
   PORT=<other port> npm start
4. Do not use 8080, 5173, 3000, 4000, 4400, 4510, 4600-4601, 18080, 19080 or 19090.
```

Other variable: `HOST_PORT` (Docker host port). Keep both inside 7800-7999.

## Mock and Real modes

- **Mock** (the default, and all this repo ships with): a pure, deterministic engine builds, for each scene, an ordered list of hops — sign-in as a persona, the agent's token, the Authorize decision, the gateway check, the tool dispatch or the refusal — each with its raw request, raw response and a W3C `traceparent`. Tokens are labelled MOCK, signed ES256 with a public mock key, shown raw with their decoded claims. No tenant, gateway, identity provider or network is touched; every URL in a hop is a `.example` host and is never sent.
- **Real** is owner-run, the smallest complete reading: the identity-provider-only path makes two real calls to one PingOne environment (its discovery document and the worker client's token) and nothing else. It was VERIFIED against a real PingOne environment by the owner on 2026-11-05; the full-Real gateway path is UNVERIFIED here until the owner re-checks it. The owner fills the `MA_*` settings in the app's own `.env` beside `docker-compose.yml` (see `.env.example`; `.env` is git-ignored and never committed): `PINGONE_ENVIRONMENT_ID`, `PINGONE_REGION`, `PINGONE_CLIENT_ID`/`PINGONE_CLIENT_SECRET` (identity provider only), or the full-Real set `MA_USER_CLIENT_ID/SECRET`, `MA_AGENT_CLIENT_ID/SECRET`, `MA_DEMO_USERNAME`, `MA_AGENT_GATEWAY_URL`, `MA_GATEWAY_AUDIENCE`, `MA_GATEWAY_SCOPE` (an optional `MA_AGENT_SCOPE`, default `agent:invoke`). With no settings Real is disabled and its tooltip names what to fill in; `MA_ALLOW_LIVE=0` turns it off even when configured. Real mode signs in as the demo user (pi.flow), mints the agent's token, runs the RFC 8693 token exchanges and calls the Agent Gateway over MCP. Nothing in Real mode ships in this repo's default state, and no agent ever runs it. Real works in Docker from the app's .env: the compose file takes each `MA_*`/`PINGONE_*` value by `${...}` substitution, never an env_file, so secrets are never copied into the process environment of anything else. When Real is not set up a run is refused with `live_not_configured`; when the lab's guards hold it is refused with `LIVE_REFUSED`. CI does not run conformance: the conformance suite needs a running lab and runs locally (`npm run ci:local` style), never as a green check with nothing behind it.

## Owner setup for full Real

Owner-run only, never run by an agent. In order:

1. `node scripts/owner/pingone-real-setup.mjs --apply` — creates or reuses the lab's PingOne sign-in and agent apps, grants the gateway scope, reports the sign-on policy and the `act` mappings, and writes only the `MA_*` names into this lab's `.env` (backup first, mode 600, secrets never printed).
2. `scripts/owner/p1az-add-actor.md` — the additive-only console checklist for the `HasValidActorChain` clause on the gateway resource.
3. `scripts/owner/agent-gateway-ingress.sh --apply` — an Ingress and Certificate for the Agent Gateway's `/mcp` and `/health`, diff by default, applied only with `--apply`.

## Not done

- The full-Real gateway path is UNVERIFIED on a real tenant; the owner re-runs `node scripts/owner/pingone-real-setup.mjs --apply` once and then exercises one scene in Real.
- The `agentcore-pingone-demo` hand-off (MA9) points at a lab whose Docker standalone is the governance/agentcore lab; verify the shelf id when the repo is published.
- The GitHub repo `curtismu7/meridian-air-LAB` is a placeholder name until the owner creates it; the Help link and the clone URL assume it.

## The brain: Scripted or llama.cpp (owner opt-in)

- **Scripted** (the default) matches your words to a prompt in the scene's What to type list. It is offline.
- **llama.cpp** asks a local model to pick ONE scene id from that same list; the server re-checks the id, so a made-up one is refused. The model never writes an answer.
- **Off unless the owner sets `MA_BRAIN_URL`**, which must be plain http on loopback or `host.docker.internal`, for example `MA_BRAIN_URL=http://127.0.0.1:8090 npm start`. With it unset the option reads "not configured" and the lab calls nothing. When the model cannot answer, Routing falls back to Scripted (or, in LLM only, says so and runs nothing).

## What is simulated

Everything in Mock — and Mock is the only mode this repo runs out of the box.

- **Every hop is computed from lab-invented inputs.** The amounts, the personas, the flight numbers, the refund total, the hostile passenger message, the rate-limit counters: all invented for the story, and labelled LAB-INVENTED where shown.
- **Tokens are mock.** ES256 with a public key that protects nothing, MOCK-labelled, never a real credential.
- **No real Ping product is called.** The gateway, Authorize, Privilege, PingID, AI Guard and Elasticsearch behaviours shown are this lab's model of what they do, written from their documented behaviour. Any claim about how a real product behaves is UNVERIFIED here.
- **The agent brain is a script**, not a model: the llama.cpp brain is an owner opt-in and only picks a scene id.
- **MA9 is guided, not computed**: it opens a stand-in walkthrough; the outcome shown is the scene's label, and the run reports `computed: false`.
- **Elasticsearch (MA11)** shows the shape of marker-based audit evidence from lab-generated runs; it does not run or connect to an Elasticsearch cluster.

## Tests

`npm test` runs the server tests (`node --test test/*.test.js`, a glob) and the script tests. The web tests are vitest (`npm test -w web`). `npm run e2e` drives the built app in a real Chromium on the E2E port. `npm run doctor` preflights; Reset (`npm run reset`) clears a workspace's runs (a restart clears them all too) and `npm run smoke` rounds it out.

## Troubleshooting

1. **Every run is 403 "Mock sign-in is off".** Start with `ALLOW_MOCK_SIGNIN=1` (`./scripts/run.sh` and Docker do).
2. **Port in use.** See the ports section above.
3. **The browser console shows 4xx.** Deliberate refusals keep their honest status codes (403, 404, 409, 429, 501).

## Ownership

Owner: the Ping demo-lab owner. Licence: MIT (see `LICENSE`). This lab is a fork of customer-agent-LAB with the catalog replaced by the 11 airline scenes (see CHANGELOG).
