# Script: AirGuard Airlines — the Agentic Trust Control Plane in one demo (mock-first cut)

Written first, per the video standards (2026-11-23). This is the SAMPLE cut: the whole tour recorded against the lab's mock engine, labelled SAMPLE, reviewed for wording and pacing before any live Real-mode take. The Real cut(s) follow once the sample is approved, one per profile (monitor / laptop).

- **Format:** silent screen capture with numbered captions and full-screen slides, light theme. Opens and closes with a slide. No slide held longer than 10 seconds (owner standard).
- **Scenes (the catalog's 11, grouped as the lab groups them):** Foundations (MA1 book, MA2 LLM virtual keys), Controls (MA3 sensitive data, MA7 prompt-injection denial), A2A (MA4 partner agent), Federated Identity / NHI (MA5 agent badge, MA10 credential broker), Human approval (MA6 CIBA refund), Attacks (MA7, MA8 over-sharing), Evidence (MA9 landscape query, MA11 SIEM match).
- **Audience:** a colleague who knows what an AI agent is but has not seen PingOne Privilege, AI Guard or the gateway.
- **One idea:** every agent action crosses a policy point that knows who is acting, on whose behalf, and what the action touches — and the same control plane signs in, screens data, approves humans, and proves it afterwards.

## Sources

| Tag | Source | What the script takes from it |
|---|---|---|
| **CATALOG** | This repo: `data/usecases.json`, `data/handoff.json`, `docs/use-case-routing.md` (2026-11-23) | The 11 scenes, their titles, expected outcomes, evidence chains and routes; the lab's own track grouping. |
| **LAB** | This repo's README and `server/src/flow.js`, `server/src/realGate.js` | What the mock engine produces (every hop, token and decision, offline, signed with the public mock key); which scenes run Real and why the others do not. |
| **PRIV** | Ping Identity docs, PingOne Privilege: <https://docs.pingidentity.com/privilege/> | Custodian; key scopes (LLM / MCP / A2A); the credential ends at the gateway, which injects what the target needs; AI Guard on MCP, A2A and LLM traffic; every call auditable. |
| **RFC** | RFC 6749 §4.4; RFC 8693 §4.1; RFC 9728 §5.1 (as read for the A2A video, 2026-11-22) | Client credentials; the `act` actor claim; protected-resource metadata. Cited only where the mock run shows the shape. |
| **LIVE** | The mock-mode run of every scene in this lab (2026-11-23) | The captions' claims are what the mock engine actually produces: 14 hops for MA10, the PERMIT/DENY verdicts per scene. |

**Claims the mock cut may not make:** nothing may say "live", "real" or "your tenant" except the SAMPLE wording that labels the cut as simulated. The opening slide says the demo family has a Real mode; the closing slide says which scenes gate Real (10 of 11) without claiming this video showed them.

**Checks before recording (the script is only true if the run is):**

1. The lab is in Mock mode and `/api/health` says ready; the take refuses to run if Real is on.
2. Each scene's run completes with its catalog `expectedOutcome` (MA1 PERMIT, MA3 DENY_403, MA6 STEP_UP, MA7 DENY_403, MA8 PERMIT_THEN_DENY, MA9 GUIDED_DEMO…).
3. The WHAT TO TYPE chips show the catalog trigger text verbatim; the evidence summary shows the scene id and hop count.
4. No tenant id, hostname beyond the lab's own, or token value is on screen; the mock tokens are the lab's public-key tokens by design.

**Deliberately not in the video:** the Real-mode sign-in, the owner's PingOne environment, the AWS partner agent, the Privilege console, and any claim that this cut touched a live server.

## Scenes (slides full screen; captions numbered bubbles)

| # | On screen | What the viewer reads (gist; exact words in captions.md) | Source |
|---|---|---|---|
| Open | Slide | Agents act on their own now. Two ways to let them: give each agent the keys, or put a trust plane between them. This lab: the trust plane. Sample cut (simulated). | CATALOG; PRIV |
| 1 | Sign-in + New chat | The traveler signs in (mock persona). The agent acts as her. | CATALOG |
| 2 | MA1 chip + run | "Book me a seat to Denver": the agent books through one front door; every hop is on screen. | CATALOG; LAB |
| 3 | Evidence: sequence | The hop chain: browser → IdP → agent → gateway → tool. Each hop labelled. | LAB |
| 4 | MA2 run | The copilot picks a brain: the LLM key is a virtual key the broker mints; the agent never holds the real one. | PRIV |
| 5 | MA7 run + denial | "Ignore your instructions": the gateway refuses; a 403 with a policy reason, not a leaked itinerary. | PRIV (AI Guard) |
| 6 | MA5 run + badge | "Show me crew-agent-7's identity": the badge — name, scopes, custodian, expiry — never the key value. | PRIV |
| 7 | MA6 run + approval | The $4,120 refund: the approval goes to a human (CIBA); the agent waits. | PRIV; RFC 6749 |
| 8 | MA4 run | A partner agent across the trust boundary: the delegated chain is presented, the gateway decides. | RFC 8693 §4.1 |
| 9 | MA9 run + go-deeper | "Prove your AI is safe": evidence is a byproduct of enforcement — a query, not an essay. | PRIV |
| Close | Slide | What the run showed: one control plane for sign-in, screening, approval, identity and proof. 10 of 11 scenes gate Real; this cut is the simulated rehearsal. | CATALOG; LAB |
