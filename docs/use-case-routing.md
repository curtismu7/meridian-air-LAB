# Meridian Air LAB: where each scene runs

Owner rule: **if a standalone lab covers a scene, it hands off there; if it is fully demonstrated here, it stays in Meridian Air LAB.** A scene this lab also covers gets a "Go deeper" link instead of leaving the chat.

This table is the tracking copy. Edit a row to change where a scene goes; the build turns it into the app's `handoff.json` and a test pins it.

| Route | Count | Meaning |
|---|---|---|
| Here | 9 | Runs in this app, one agent, the mock engine decides |
| Here + go deeper | 1 | Runs here, plus a link to the lab that covers it in depth |
| Hand off | 1 | Opens the standalone app (same tab, ids only, Back returns here) |
| Guide | 0 | Learning page or script, no lab yet |
| **Total** | **11** | 2 different hand-off apps |

Basis: scene fully demonstrated here (9), the lab shows the flow deeper (2).

| MA | Title | Track | Route | App | Basis | Status | Notes |
|---|---|---|---|---|---|---|---|
| MA1 | The passenger books — MCP through one front door | foundations | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA2 | The copilot picks a brain — LLM routing and virtual keys | foundations | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA3 | The CFO sleeps at night — budgets and rate limits | controls | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA4 | A partner agent from AWS — A2A across the trust boundary | a2a | Here + go deeper | meridian-a2a-hop | the A2A hop lab shows this flow deeper | verified | runs here (the Agent to agent page stays reachable, owner 2026-11-09); go deeper in meridian-a2a-hop |
| MA5 | Every agent has a badge — the Agent Registry | nhi | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA6 | The $4,000 refund — CIBA with PingID approval | hitl | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA7 | The attack — AI Guard blocks prompt injection | attacks | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA8 | Gold data stays gold — fine-grained authorization | controls | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA9 | Govern and audit — the whole landscape | demo | Here + go deeper | observability-lab | the landscape query runs here against the live SIEM; the observability dashboard shows the whole stream deeper | verified | guided scene: the landscape query runs here; the dashboard shows the stream deeper |
| MA10 | Keys never touch the agents — the credential broker | nhi | Here |  | scene is fully demonstrated in this lab | verified |  |
| MA11 | The auditor asks Elasticsearch — evidence by marker | demo | Here |  | scene is fully demonstrated in this lab | verified |  |
