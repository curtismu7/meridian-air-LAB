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
