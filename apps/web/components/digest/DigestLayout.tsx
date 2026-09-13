"use client";
import Link from "next/link";
import { ExploreHeader, LinkButton } from "@/components/explore/ExplorePage";
import theme from "@/components/explore/explore.module.css";
import s from "./digest.module.css";
export function DigestLayout({
  children,
  name,
  active = "digest",
  signedIn,
}: {
  children: React.ReactNode;
  name?: string;
  signedIn?: boolean;
  active?: "digest" | "letters" | "people" | "account";
}) {
  return (
    <main className={theme.page}>
      <a href="#digest-content" className={theme.skip}>
        Skip to content
      </a>
      <ExploreHeader />
      <div className={s.accountNav}>
        <nav aria-label="Your island">
          <Link href="/digest" aria-current={active === "digest" ? "page" : undefined}>
            Digest
          </Link>
          <Link href="/letters" aria-current={active === "letters" ? "page" : undefined}>Letters</Link>
          <Link href="/people" aria-current={active === "people" ? "page" : undefined}>People</Link>
          <Link href="/town">Town</Link>
        </nav>
        <Link href="/account">
          {name ?? "Your account"} <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div id="digest-content" className={s.content}>
        {children}
      </div>
      <footer className={s.footer}>
        <span>A life of their own. A story you get to follow.</span>
        <Link href="/account">Manage your citizen ↗</Link>
      </footer>
    </main>
  );
}
export function DigestSection({
  children,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <section className={s.section}>{children}</section>;
}
export function DigestState({
  title,
  children,
  href,
  action,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <section className={s.state}>
      <p className={s.kicker}>Your island journal</p>
      <h1>{title}</h1>
      <div>{children}</div>
      {href && <LinkButton href={href}>{action} ↗</LinkButton>}
    </section>
  );
}
export function DigestTimeline({
  items,
}: {
  items: {
    t: string;
    changed: boolean;
    text: React.ReactNode;
    share?: string;
    key?: string | number;
  }[];
}) {
  return (
    <ol className={s.timeline}>
      {items.map((item, i) => (
        <li key={item.key ?? i} data-changed={item.changed}>
          <div className={s.timestamp}>{item.t}</div>
          <div className={s.eventText}>
            {item.text}
            {item.share && (
              <Link className={s.share} href={item.share}>
                Share this moment ↗
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
