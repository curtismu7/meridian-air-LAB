// The Privilege Console walkthrough (the approved mock's "console view",
// docs/privilege-one-airlines/mock.html data.js consoleTree): where each feature is
// configured, and the scene that demos it. Lab-invented console fields, teaching data.
export const CONSOLE_TREE = [
  { area: "Agent Registry", scenes: ["MA5"], fields: [["Agents", "every agent registered with owner + custodian"], ["Registration state", "certified / draft / revoked"], ["Badges", "key id, scopes, created, last used"], ["Custodian", "the human owner of the agent"]],
    why: "This is where agent identities are born. Scene MA5 is the badge; this is the badge printer." },
  { area: "Agent Access Keys", scenes: ["MA1", "MA2", "MA3", "MA4", "MA10"], fields: [["Key scopes", "exactly what each key may do"], ["Model limits", "allowed models, monthly budget"], ["Rate limits", "requests/minute per key"], ["Guardrails", "detectors + thresholds per key"]],
    why: "One key = one agent = one budget + one scope list. Scenes MA1, MA2, MA3, MA4 and MA10 all trace back to a row here." },
  { area: "Policies", scenes: ["MA3", "MA6", "MA8"], fields: [["Tag policies", "name-regex → tag sets for resources"], ["PAC policies", "per-agent grants and guardrails"], ["Authorize rules", "refund > $2000 → CIBA + PingID"], ["Response withhold", "field-level redaction rules"]],
    why: "The rules that decide MA3, MA6 and MA8 — edited in a console, not in code." },
  { area: "AI Guard", scenes: ["MA7"], fields: [["Detector groups", "11 detectors across 4 groups"], ["Thresholds", "alert + block, per key (jailbreak 0.80)"], ["Fail closed", "on — unavailable detector blocks"], ["ML sidecar", "external inspection + Block Agreement"]],
    why: "Scene MA7's block was configured here — and tuned from logged scores, not guesswork." },
  { area: "Gateways & Apps", scenes: ["MA1", "MA2", "MA4"], fields: [["MCP apps", "entry paths, aggregate apps, auth modes"], ["Remote agents (A2A)", "agent cards, credentials per hop"], ["LLM route", "/llm/<provider>/v1, virtual keys"], ["Load balancing", "multi-node gateway mesh"]],
    why: "The front door's floor plan: every address an agent can knock on, registered here." },
  { area: "Secret Stores", scenes: ["MA10"], fields: [["Connections", "Vault, CyberArk, AWS/GCP Secrets Manager"], ["Rotation", "schedule + last rotated"], ["JIT injection", "TTL-brokered delivery, never to the agent"], ["Access log", "every brokered fetch recorded"]],
    why: "Scene MA10's guarantee — agents never see a real credential — is configured on this page." },
  { area: "HITL Requests", scenes: ["MA6"], fields: [["Pending", "CIBA requests awaiting a human"], ["Binding message", "shown verbatim on the approver's phone"], ["Decisions", "who approved, device, timestamp"], ["State", "terminal + auditable"]],
    why: "Scene MA6's approval appears here the moment the CIBA request fires — the console view of the phone push." },
  { area: "Observability & SIEM", scenes: ["MA9", "MA11"], fields: [["Verdict stream", "every gateway decision, emitted in real time"], ["Run marker", "travels in the first string tool argument"], ["Certification", "who signed off on each agent, when"], ["Audit view", "requirement fields scored, gaps labelled"]],
    why: "Scenes MA9 and MA11: the evidence already left the building — the SIEM holds it, matched to the call." },
];
