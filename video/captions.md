<!--
  All the WORDING for the mock-first Meridian Air recording. Edit the text under each heading — nothing else needs to change.
  take.py reads this file and fills in the live values (a hop count, a verdict) around whatever you write here; it never
  touches this file itself. SCRIPT.md is the source for every claim below. The heading names are the loader's contract
  ("# Opening Slide" / "# Closing Slide" / "# Slide: <key>" / "# Step: <key>" with "## Title"/"## Text"/"## Lead"/"## Verdict"/
  "## Column A: ..."/"## Column B: ..."); editing the WORDS is always safe. "---" separates sections; keep those.
-->

# Opening Slide

## Header
Meridian Air: agents on a trust plane

## Title
Agents act on their own. Who watches them?

## Lead
Give every agent the keys, or put a trust plane between the agent and everything it touches. This lab is the trust plane — simulated here, one button away from your own tenant.

## Column A: The obvious way
- Each agent holds real credentials
- Keys copied into code, config and laptops
- Nothing in the middle decides or records

## Column B: This demo: a trust plane
- The agent proves who it is, every call
- The gateway checks, injects, screens
- Approvals, evidence and audit come free

## Verdict
This cut is a sample: the simulated rehearsal, every hop produced by the demo's mock engine.

---

# Slide: ma1

## Title
MA1 · The passenger books — MCP through one front door

## Lead
Every tool the agent can reach sits behind one address — the Privilege gateway — and security is enforced before any tool is reachable.

## Column A: Products used
- PingOne SSO (OAuth 2.1 + PKCE, RFC 8693 exchange)
- Ping Gateway (the single MCP front door)
- PingOne Authorize (the permit decision)
- PingOne Privilege (agent registry and key grant)

## Column B: The value
- Integration effort drops to near zero: one address, not one per tool
- The tool list is filtered to what this caller may use
- Every hop is decided and recorded in the same place

## Verdict
One front door, every call authorized, nothing reachable that was not permitted.

---

# Slide: ma2

## Title
MA2 · The copilot picks a brain — LLM routing and virtual keys

## Lead
A copilot should not get frontier-model pricing for summarizing weather. Model choice becomes a policy decision, and provider keys never live in an app.

## Column A: Products used
- PingOne SSO (identity for every hop)
- Ping Gateway (LLM routing and key brokering)
- PingOne Privilege (per-key model limits)

## Column B: The value
- Cost becomes a policy: the right model for the right task
- No OpenAI or Anthropic key in any app, config or laptop
- Key theft from a laptop stops being an incident class

## Verdict
Routing turns spend into policy; virtual keys turn theft into a non-event.

---

# Slide: ma3

## Title
MA3 · The CFO sleeps at night — budgets and rate limits

## Lead
Batch jobs run unattended — the step where a runaway agent would burn six figures overnight. Rate limits stop it in seconds.

## Column A: Products used
- PingOne SSO (which agent is asking)
- Ping Gateway (rate limits and budget enforcement)
- PingOne Privilege (per-key budgets and limits)

## Column B: The value
- Budgets are per agent key, like corporate cards — set by finance, not engineers
- A runaway loop is refused in seconds, not discovered on an invoice
- The refusal names its reason: limit reached, on the record

## Verdict
Spend without a ceiling becomes impossible; a runaway agent dies mid-loop.

---

# Slide: ma4

## Title
MA4 · A partner agent from AWS — A2A across the trust boundary

## Lead
The caller is a partner's agent hosted in Amazon Bedrock AgentCore — outside the network entirely — and it still cannot do anything without a registered identity.

## Column A: Products used
- PingOne SSO (federated identity across the boundary)
- Ping Gateway (delegation chain checked per hop)
- PingOne Privilege (the partner's agent registered)

## Column B: The value
- Partners get delegated access, never copied credentials
- Who is acting, on whose behalf: presented and checked on every hop
- An uncredentialed hop is refused by policy — the negative case sells hardest

## Verdict
Trust crosses the boundary as identity, not as a shared secret.

---

# Slide: ma5

## Title
MA5 · Every agent has a badge — the Agent Registry

## Lead
The customer's agent HR system: every agent has a named owner and custodian before it ever runs.

## Column A: Products used
- PingOne SSO (the human custodian's identity)
- PingOne Privilege (the Agent Registry, write-only keys)

## Column B: The value
- Named owner and custodian for every agent, before it runs
- Keys are write-only — even the admin cannot read one back
- "What did agent-7 do at 9:31?" answers in one query

## Verdict
An agent without a badge does nothing; an agent with one is accountable.

---

# Slide: ma6

## Title
MA6 · The $4,000 refund — CIBA with PingID approval

## Lead
The agent proposed a $4,120 refund on its own. Policy puts a human in the loop by value, not by code.

## Column A: Products used
- PingOne SSO (CIBA: the backchannel request)
- Ping Gateway (holds the run until approval)
- PingOne Authorize (the by-value policy)
- PingID (the manager's approval, on their phone)

## Column B: The value
- Human approval by amount, wired in policy — not in the agent's code
- The same PingID the customer runs for workforce sign-in guards agent actions
- No browser, no redirect URI, nothing for the agent to host

## Verdict
The money moves only when a person says so — and the decision is on the record.

---

# Slide: ma7

## Title
MA7 · The attack — AI Guard blocks prompt injection

## Lead
This input is a real attack someone pasted into a real airline chat. Inspection happens before the model ever sees the payload.

## Column A: Products used
- PingOne SSO (who is really sending this)
- Ping Gateway (inline AI Guard inspection)
- Ping AI Guard (injection and jailbreak detectors)

## Column B: The value
- The customer's prompts, data and money are never exposed to the payload
- Fail-closed: an unavailable detector blocks, it never passes through
- The refusal names the detector and the reason, not a leaked itinerary

## Verdict
The attack is stopped before the model — and the proof is on the record.

---

# Slide: ma8

## Title
MA8 · Gold data stays gold — fine-grained authorization

## Lead
One policy engine answers for every call — the customer stops re-implementing entitlements in every service.

## Column A: Products used
- PingOne SSO (the member's entitlements)
- Ping Gateway (enforcement on the response)
- PingOne Authorize (fine-grained, attribute-based policy)

## Column B: The value
- Entitlements live in one policy, not re-coded in every service
- Deny is not the only tool: redaction lets partners see enough to be useful and nothing that leaks
- The response left the gateway already withheld

## Verdict
Gold data stays gold — for everyone, in every service, by one policy.

---

# Slide: ma9

## Title
MA9 · Govern and audit — the whole landscape

## Lead
"Prove your AI is safe" stops being an essay and becomes a query.

## Column A: Products used
- Ping Gateway (every verdict, emitted in real time)
- PingOne Privilege (the governance view over it)

## Column B: The value
- Every verdict the gateway made this morning is already in the SIEM
- Evidence is a byproduct of enforcement, not a project
- MITRE ATLAS, OWASP LLM and NIST AI RMF mappings attached at emit time

## Verdict
The whole landscape, answerable from one record.

---

# Slide: ma10

## Title
MA10 · Keys never touch the agents — the credential broker

## Lead
The pipeline agent needs an AWS credential to do its job — and the design guarantee is that it will never hold one.

## Column A: Products used
- PingOne SSO (the workload's identity)
- Ping Gateway (the brokered fetch, TTL-bounded)
- PingOne Privilege (secret stores, JIT injection, rotation)

## Column B: The value
- JIT injection: the credential arrives TTL-brokered, never to the agent
- Rotation and access log are configured on one page
- Agents that never hold secrets cannot leak them — the stolen-credential class disappears by construction

## Verdict
The agent does the work; the secret never becomes the agent's to lose.

---

# Slide: ma11

## Title
MA11 · The auditor asks Elasticsearch — evidence by marker

## Lead
The customer's question is always "can you prove it?" — this scene answers with their own Elasticsearch cluster, not a slide.

## Column A: Products used
- Ping Gateway (the audit trail, marked per run)
- PingOne Privilege (the decision record)
- Elasticsearch (the customer's own SIEM)

## Column B: The value
- The audit entry carries all four fields the requirement names: user, agent identity, tool, policy decision
- Matched to this exact call by marker, not by guesswork
- Evidence lands in the tool the auditor already uses

## Verdict
Proof, by marker, in the customer's own stack.

---

# Step: sample_signin

## Title
A simulated traveler signs in

## Text
The sign-in here is the mock engine's: no real identity provider is called, but the run records the identity every hop acts as, exactly as a live run would.

---

# Step: sample_ma1

## Title
"Book me a seat to Denver on the next flight" (simulated)

## Text
One sentence from the customer. The simulated agent plans, the simulated gateway authorizes, the booking is made — every hop on screen. Nothing here touched a live tenant.

---

# Step: sample_ma2

## Title
The copilot picks a brain — with a simulated virtual key

## Text
The LLM key the agent uses is minted by the broker, scoped and expiring. The mock engine produces the shape of that exchange; no provider was called.

---

# Step: sample_ma7

## Title
"Ignore your instructions" — refused (simulated)

## Text
A prompt injection, typed as a customer. The simulated gateway refuses with a policy reason and a 403, not a leaked itinerary. The mock engine's decision, recorded like a real one.

---

# Step: sample_ma5

## Title
An agent's identity, read on demand (simulated)

## Text
The badge: name, scopes, custodian, expiry. The key value is shown nowhere, because the registry hands out proof, not copies. This read is the mock engine's registry.

---

# Step: sample_ma6

## Title
A $4,120 refund needs a human (simulated)

## Text
The agent cannot approve this. The approval goes to a person by CIBA, the agent waits, and the decision is on the record before the money moves — all simulated here.

---

# Step: sample_ma4

## Title
A partner agent, across the trust boundary (simulated)

## Text
The delegated chain is presented to the gateway — who is acting, on whose behalf — and the gateway decides what crosses. The mock engine plays both agents.

---

# Step: sample_ma9

## Title
"Prove your AI is safe" is a query now (simulated)

## Text
Every verdict the gateway made is already on the record, with compliance mappings attached at emit time. The mock engine's record; the real one reads the same.

---

# Step: sample_ma3

## Title
A runaway batch job hits a wall (simulated)

## Text
"Run the nightly analytics batch" — and the simulated rate limit refuses the loop in seconds. Budgets set per agent key, by finance. The mock engine's decision, recorded like a real one.

---

# Step: sample_ma8

## Title
Gold data stays gold (simulated)

## Text
One policy answers for every call: the gold member's profile comes back redacted for this caller — enough to be useful, nothing that leaks. The mock engine's redaction, on the record.

---

# Step: sample_ma10

## Title
The agent never sees the key (simulated)

## Text
The pipeline agent needs an AWS credential — and gets a TTL-brokered one injected by the gateway, never a copy. The mock engine plays the broker; no real secret moved.

---

# Step: sample_ma11

## Title
Proof, by marker, in their own stack (simulated)

## Text
"Prove it in Elasticsearch." The audit entry for this exact run — user, agent identity, tool, policy decision — matched by marker. The mock engine's record; the real one reads the same.

---

# Step: signin

## Title
The traveler signs in

## Text
A mock persona signs in the way the product would: the agent now acts as her, and every hop names whose identity is in flight.

---

# Step: ma1

## Title
"Book me a seat to Denver on the next flight"

## Text
One sentence from the customer. The agent plans, the gateway authorizes, the booking is made — every hop on screen, nothing hidden in a library.

---

# Step: hops

## Title
Every hop, on the record

## Text
Browser to identity provider to agent to gateway to tool. The mock engine produces the whole chain offline; the real mode runs the same chain against your tenant.

---

# Step: ma2

## Title
The copilot picks a brain — with a virtual key

## Text
The LLM key the agent uses is minted by the broker, scoped and expiring. The real provider key never touches the agent, so a stolen agent holds nothing worth stealing. {hops}

---

# Step: ma7

## Title
"Ignore your instructions" — refused

## Text
A prompt injection, typed as a customer. The gateway refuses with a policy reason and a 403, not a leaked itinerary. Enforcement is the same door the booking went through.

---

# Step: ma5

## Title
An agent's identity, read on demand

## Text
The badge: name, scopes, custodian, expiry. The key value is shown nowhere, because the registry hands out proof, not copies.

---

# Step: ma6

## Title
A $4,120 refund needs a human

## Text
The agent cannot approve this. The approval goes to a person by CIBA, the agent waits, and the decision is on the record before the money moves.

---

# Step: ma4

## Title
A partner agent, across the trust boundary

## Text
The delegated chain is presented to the gateway — who is acting, on whose behalf — and the gateway decides what crosses. (In the lab's Real mode this leg is a live AWS agent.)

---

# Step: ma9

## Title
"Prove your AI is safe" is a query now

## Text
Every verdict the gateway made is already on the record, with compliance mappings attached at emit time. Evidence is a byproduct of enforcement, not a project.

---

# Step: ma3

## Title
A runaway batch job hits a wall

## Text
"Run the nightly analytics batch" — and the rate limit refuses the loop in seconds. The budget was set per agent key, like a corporate card, by finance. The refusal names its reason, on the record. {hops}

---

# Step: ma8

## Title
Gold data stays gold

## Text
One policy answers for every call: the gold member's profile comes back redacted for this caller — enough to be useful, nothing that leaks. The response left the gateway already withheld. {hops}

---

# Step: ma10

## Title
The agent never sees the key

## Text
The pipeline agent needs an AWS credential — and gets a TTL-brokered one injected by the gateway, never a copy. Agents that never hold secrets cannot leak them. {hops}

---

# Step: ma11

## Title
Proof, by marker, in their own stack

## Text
"Prove it in Elasticsearch." The audit entry for this exact run — user, agent identity, tool, policy decision — is already in the customer's own SIEM, matched by marker. {hops}

---


---








# Closing Slide

## Title
One trust plane for everything an agent does

## Lead
Sign-in, screening, approval, identity, proof — the same control plane, the same record, for every agent and every tool.

## Column A: What the run showed
- Every hop labelled and on screen
- A refusal with a reason, not a leak
- Identity, approval and evidence from one place

## Column B: Where this goes next
- 10 of the 11 scenes gate Real in this lab
- Real mode signs in as you, against your tenant
- The same hops, the same decisions, live

## Verdict
This cut is the simulated rehearsal. The live cut runs the identical chain against a real tenant.
