import { Fragment } from "react";
import { CONSOLE_TREE } from "./consoleTree";

// The Privilege Console walkthrough: the mock's console view. Each card is one console
// area (lab-invented teaching fields), with the scene buttons that demo it.
export default function PrivilegeConsole({ catalog, onPickScene, selectedId }) {
  return (
    <section className="pconsole" aria-label="Privilege Console walkthrough" data-testid="console-view">
      <h2 className="panel__title">Privilege Console — where the features live</h2>
      <p className="muted">Mock of the admin surface. Each panel names the console fields and links to the scene that demos it.</p>
      <div className="pconsole__grid">
        {CONSOLE_TREE.map((c) => (
          <article key={c.area} className="card pconsole__card" data-testid={`console-${c.area.replace(/[^a-z]+/gi, "-").toLowerCase()}`}>
            <h3>{c.area}</h3>
            <dl className="kv">
              {c.fields.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
            </dl>
            <p className="muted pconsole__why"><b>Why it matters:</b> {c.why}</p>
            <div className="pconsole__scenes">
              {c.scenes.map((id) => {
                const u = (catalog?.tracks || []).flatMap((t) => t.usecases).find((x) => x.id === id);
                return (
                  <button key={id} type="button" className={id === selectedId ? "primary" : undefined}
                    onClick={() => onPickScene?.(id)} data-testid={`console-scene-${id}`}
                    title={u ? `${u.title}` : id}>
                    ▶ {id}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
