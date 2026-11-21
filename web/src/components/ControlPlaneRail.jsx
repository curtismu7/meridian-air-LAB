import { Tag } from "./Bits";

// The five layers of the Agentic Trust Control Plane (the approved mock's right rail,
// docs/privilege-one-airlines/mock.html). `hot` comes from the scene's productRoles:
// a layer the scene demonstrates glows and shows the scene's own slice of it.
export const CP_LAYERS = [
  { key: "gw", id: "AI Gateway", blurb: "LLM · MCP · A2A · AI Guard — routing, allow-lists, quotas, DPP, audit" },
  { key: "idp", id: "Identity Authority (PingOne / PF)", blurb: "Agent IdP · SPIFFE/SVIDs · token issuance · token exchange (RFC 8693) · SSO" },
  { key: "privilege", id: "Privilege — Credential Broker", blurb: "Agent/MCP catalog · secret stores (Vault, CyberArk, AWS/GCP) · rotation · JIT injection — agents never see a real credential" },
  { key: "authz", id: "Authorize — Fine-Grained AuthZ", blurb: "Policy per action: who is acting, whom they represent, what, risk" },
  { key: "gov", id: "Agent Governance", blurb: "Certify · monitor · revoke · agent observability" },
];

// One scene's view of the control plane: every layer listed, the ones this scene
// exercises marked HOT with the catalog's own productRoles sentence for the slice.
export default function ControlPlaneRail({ uc }) {
  const roles = uc?.productRoles || null;
  const hotCount = roles ? CP_LAYERS.filter((l) => roles[l.key]).length : 0;
  return (
    <aside className="cprail" aria-label="Agentic Trust Control Plane" data-testid="cp-rail" data-scene={hotCount ? uc.id : undefined}>
      <p className="kicker">Agentic Trust Control Plane{uc ? ` · ${uc.id}` : ""}</p>
      <ol className="cprail__layers">
        {CP_LAYERS.map((l) => {
          const slice = roles?.[l.key] || null;
          return (
            <li key={l.key} className="cprail__layer" data-hot={slice ? "true" : undefined} data-testid={`cp-${l.key}`}>
              <b>{l.id}</b>
              <span>{slice || l.blurb}</span>
              {slice ? <Tag state="info">this scene</Tag> : null}
            </li>
          );
        })}
      </ol>
      {!uc && <p className="muted">Pick a scene to see which layers it exercises.</p>}
      {uc && (
        <>
          <p className="kicker">Talk track</p>
          <p className="cprail__talk" data-testid="cp-talk">“{uc.buyerStory}”</p>
          <p className="kicker">Why it matters</p>
          <p className="cprail__talk" data-testid="cp-why">{uc.pingOneSolution}</p>
        </>
      )}
    </aside>
  );
}
