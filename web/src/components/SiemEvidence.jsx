import { Fragment } from "react";
import { visible } from "../safeText";
import { Tag } from "./Bits";

// MA11's evidence panel: the Real SIEM search for this run's marker (server/src/siem.js did the search;
// the run carries the masked answer). Matched = records that carry the marker; inferred = the run's
// time-window records (labelled honestly). Absent (mock mode, or the SIEM not configured): nothing.
const FOUR = [["User", "User"], ["AgentKey", "Agent identity"], ["Target", "Tool"], ["Decision", "Policy decision"]];

function Source({ s }) {
  const d = s?.Data && typeof s.Data === "object" ? s.Data : {};
  return (
    <li className="siem__hit" data-testid="siem-hit">
      <p className="siem__meta"><code>{visible(s.event_type || "?")}</code> · {visible(s["@timestamp"] || "?")}</p>
      <dl className="kv" data-testid="siem-fields">
        {FOUR.map(([k, label]) => <Fragment key={k}><dt>{label}</dt><dd className="mono">{visible(String(d[k] ?? s[k] ?? "— (gap, labelled honestly)") )}</dd></Fragment>)}
      </dl>
      {s.Message && <p className="muted siem__msg">{visible(s.Message)}</p>}
    </li>
  );
}

export default function SiemEvidence({ siem }) {
  if (!siem || typeof siem !== "object") return null;
  const matched = Array.isArray(siem.matched) ? siem.matched : [];
  const inferred = Array.isArray(siem.inferred) ? siem.inferred : [];
  return (
    <section className="siem" aria-label="SIEM evidence" data-testid="siem-evidence" data-level={siem.level}>
      <p className="kicker">SIEM evidence <Tag state={siem.level === "real" ? "ok" : "warn"} testId="siem-level">{siem.level === "real" ? "REAL" : "unavailable"}</Tag></p>
      <p className="muted">Read-only search of the owner's SIEM (<code>ping-siem-events-v2</code>) for this run's marker <code data-testid="siem-marker">{visible(siem.marker || "")}</code>.</p>
      {siem.note && <p className="muted" data-testid="siem-note">{visible(siem.note)}</p>}
      {matched.length > 0 && (
        <>
          <p className="siem__h">Matched by marker ({matched.length})</p>
          <ul className="siem__list">{matched.map((h) => <Source key={h.id} s={h.source} />)}</ul>
        </>
      )}
      {inferred.length > 0 && (
        <>
          <p className="siem__h">Same time window (inferred, not matched — {inferred.length})</p>
          <ul className="siem__list">{inferred.map((h) => <Source key={h.id} s={h.source} />)}</ul>
        </>
      )}
    </section>
  );
}
