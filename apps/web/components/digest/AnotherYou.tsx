import Link from "next/link";
import type { OwnerAgent } from "@/lib/api";
import { divergenceCopy, selfDifferences, selfPortrait } from "@/lib/another-you";
import s from "./another-you.module.css";

export function AnotherYou({ agent }: { agent: OwnerAgent }) {
  const current = selfPortrait(agent.persona);
  const firstSaved = agent.selves?.[0];
  const origin = firstSaved ? selfPortrait(firstSaved) : current;
  const differences = selfDifferences(origin, current);
  const copy = divergenceCopy(differences.length);
  const first = agent.name.split(" ")[0] ?? agent.name;

  return (
    <section className={s.shell} aria-labelledby="another-you-title">
      <div className={s.masthead}>
        <div>
          <div className={s.label}>You / another you</div>
          <h2 id="another-you-title">{copy.title}</h2>
        </div>
        <div className={s.drift} data-active={differences.length > 0}>
          <span>{String(differences.length).padStart(2, "0")}</span>
          <small>{copy.label}</small>
        </div>
      </div>

      {differences.length ? (
        <div className={s.changes}>
          {differences.map((change, index) => (
            <article key={change.key} className={s.change} style={{ "--i": index } as React.CSSProperties}>
              <div className={s.changeLabel}>{change.label}</div>
              <div className={s.pair}>
                <div>
                  <small>When {first} arrived</small>
                  <p>{change.before}</p>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <small>Now</small>
                  <p>{change.now}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={s.quiet}>
          {first} has not rewritten who they are yet. Experiences, relationships and difficult choices can move this portrait over time.
        </p>
      )}

      <div className={s.footer}>
        <p>The original person stays preserved. Every later self is part of the record.</p>
        <Link href={`/agent/${agent.id}/book`}>Follow the change <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  );
}
