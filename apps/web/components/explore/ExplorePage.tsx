"use client";
import Link from "next/link";
import { SessionLink } from "@/components/auth/SessionLink";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { exploreLinks } from "./navigation";
import s from "./explore.module.css";

export function ExplorePage({
  children,
  eyebrow,
  title,
  description,
  art,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  art?: string;
}) {
  return (
    <main className={s.page}>
      <a href="#explore-content" className={s.skip}>
        Skip to content
      </a>
      <ExploreHeader />
      <div className={s.content} id="explore-content">
        <section className={s.hero}>
          <div>
            <p className={s.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            <p className={s.description}>{description}</p>
          </div>
          {art && (
            <div className={s.art} aria-hidden="true">
              <Image
                src={art}
                alt=""
                width={400}
                height={400}
                sizes="(max-width: 760px) 120px, 270px"
              />
            </div>
          )}
        </section>
        <div className={s.body}>{children}</div>
      </div>
      <footer className={s.footer}>
        <Link href="/">An open experiment in artificial life.</Link>
        <nav aria-label="About Unwatched">
          <Link href="/privacy">Privacy</Link>
          <Link href="/rules">Island rules</Link>
          <a href="https://github.com/kresogalic8/unwatched">GitHub ↗</a>
        </nav>
      </footer>
    </main>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${s.card} ${className}`}>{children}</div>;
}
export function Label({
  children,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <div className={s.label}>{children}</div>;
}
export function Button({
  kind = "primary",
  size = 44,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "secondary" | "tertiary";
  size?: 36 | 44 | 52;
}) {
  return (
    <button
      {...props}
      className={`${s.button} ${kind === "primary" ? s.primary : s.secondary} ${className}`}
      style={{ minHeight: size }}
    />
  );
}
export function LinkButton({
  href,
  children,
  kind = "primary",
  size = 44,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  kind?: "primary" | "secondary" | "tertiary";
  size?: 36 | 44 | 52;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${s.button} ${kind === "primary" ? s.primary : s.secondary} ${className}`}
      style={{ minHeight: size }}
    >
      {children}
    </Link>
  );
}

export function ExploreHeader() {
  const path = usePathname();
  return (
    <header className={s.header}>
      <Wordmark size={23} />
      <nav aria-label="Around the island" className={s.nav}>
        <Link className={s.watch} href="/town">
          Watch the town
        </Link>
        <details
          className={s.dropdown}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.open = false;
              e.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            Explore <span aria-hidden="true">+</span>
          </summary>
          <div>
            {exploreLinks.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  path === href || path.startsWith(href + "/")
                    ? "page"
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </div>
        </details>
        <SessionLink className={s.signIn} />
      </nav>
    </header>
  );
}
