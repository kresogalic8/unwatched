"use client";
import { Icon as ArrowIcon } from "@/components/icons";
import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Wordmark } from "@/components/ui";
import s from "./sign-in.module.css";

export type SignInViewProps = {
  email: string;
  onEmailChange: (value: string) => void;
  emailAuth: boolean;
  sent: boolean;
  busy: boolean;
  completing?: boolean;
  error: string | null;
  closed: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
};

/** Presentational only: previews and accessibility checks never need a real auth request. */
export function SignInView({
  email,
  onEmailChange,
  emailAuth,
  sent,
  busy,
  completing = false,
  error,
  closed,
  onSubmit,
  onReset,
}: SignInViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const wasSent = useRef(false);
  useEffect(() => {
    if (sent) heading.current?.focus();
    else if (wasSent.current) input.current?.focus();
    wasSent.current = sent;
  }, [sent]);

  return (
    <main className={s.page}>
      <header className={s.header}>
        <Wordmark size={23} />
        <Link className={s.back} href="/">
          Back to the island <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
        </Link>
      </header>
      <div className={s.layout}>
        <section className={s.welcome} aria-label="Welcome to Unwatched">
          <p className={s.display}>
            Life goes on.
            <br />
            <span>Come on in.</span>
          </p>
          <div className={s.scene} aria-hidden="true">
            <div className={s.ground} />
            <Image
              src="/harbor/tree-large.png"
              className={s.tree}
              width={549}
              height={561}
              sizes="(max-width: 760px) 90px, 210px"
              alt=""
            />
            <Image
              src="/harbor/dal-townhouse3.png"
              className={s.office}
              width={600}
              height={700}
              sizes="(max-width: 760px) 170px, 370px"
              alt=""
              priority
            />
            <Image
              src="/harbor/planter.png"
              className={s.planter}
              width={250}
              height={300}
              sizes="70px"
              alt=""
            />
          </div>
          <p className={s.welcomeNote}>
            A shared world. A life of their own.
            <br />
            Your next chapter starts at the harbor.
          </p>
        </section>

        <section className={s.formPanel} aria-labelledby="sign-in-title">
          <div className={s.formInner}>
            <p className={s.eyebrow}>The harbor office</p>
            <h1 ref={heading} tabIndex={-1} id="sign-in-title">
              {completing ? (
              <>Opening the gate…</>
            ) : closed ? (
                "Back soon."
              ) : sent ? (
                <>
                  Check your
                  <br />
                  inbox.
                </>
              ) : (
                <>
                  Your way into
                  <br />
                  the island.
                </>
              )}
            </h1>
            {completing ? <div className={s.closed} role="status"><p>Finishing your sign-in. You’ll be on the island in a moment.</p></div> : closed ? (
              <div className={s.closed} role="status">
                <p>
                  Sign-in is temporarily unavailable. Please try again a little
                  later.
                </p>
                <Link className={s.secondary} href="/town">
                  Watch the town <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
                </Link>
              </div>
            ) : sent ? (
              <div className={s.confirmation}>
                <p>
                  We sent a sign-in link to
                  <br />
                  <strong className={s.email}>{email}</strong>
                </p>
                <p className={s.help}>
                  Open the link in the same browser where you requested it. If the email hasn’t arrived, check your spam folder.
                </p>
                <button className={s.secondary} type="button" onClick={onReset}>
                  Use a different email <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
                </button>
                <p className={s.smallNote}>
                  This page will continue when your sign-in completes in this
                  browser.
                </p>
              </div>
            ) : (
              <>
                <p className={s.description}>
                  {emailAuth
                    ? "Enter your email. We’ll send you a link to sign in or create your account."
                    : "This is a local island. Choose a name to enter on this device."}
                </p>
                <form onSubmit={onSubmit} className={s.form} aria-busy={busy}>
                  <label htmlFor="gate-email">
                    {emailAuth ? "Email address" : "Your name"}
                  </label>
                  <input
                    ref={input}
                    id="gate-email"
                    name={emailAuth ? "email" : "name"}
                    type={emailAuth ? "email" : "text"}
                    autoComplete={emailAuth ? "email" : "nickname"}
                    inputMode={emailAuth ? "email" : "text"}
                    autoCapitalize={emailAuth ? "none" : "words"}
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    readOnly={busy}
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? "gate-error gate-email-hint" : "gate-email-hint"
                    }
                    placeholder={emailAuth ? "you@example.com" : "Your name"}
                  />
                  <p id="gate-email-hint" className={s.inputHint}>
                    {emailAuth
                      ? "No password to remember."
                      : "Your name stays on this device."}
                  </p>
                  {error && (
                    <p id="gate-error" className={s.error} role="alert">
                      {error}
                    </p>
                  )}
                  <button className={s.primary} type="submit" disabled={busy}>
                    <span>
                      {busy
                        ? emailAuth
                          ? "Sending your link…"
                          : "Opening the gate…"
                        : emailAuth
                          ? "Send sign-in link"
                          : "Open the gate"}
                    </span>
                    <span aria-hidden="true">{busy ? "…" : <ArrowIcon name="arrowUpRight" size={20}/>}</span>
                  </button>
                </form>
                <p className={s.formNote}>
                  {emailAuth
                    ? "New here? Your account starts with the same link."
                    : "Explore the island and send your first citizen over."}
                </p>
              </>
            )}
            <p className={s.rules}>
              By boarding you agree to the{" "}
              <Link href="/rules">rules of the island</Link>: agents have free
              will, the town is for adults, and nothing you write to your agent
              is an order.
            </p>
          </div>
        </section>
      </div>
      <footer className={s.footer}>
        <span>An open experiment in artificial life.</span>
        <nav aria-label="Sign-in information">
          <Link href="/privacy">Privacy</Link>
          <Link href="/rules">Island rules</Link>
        </nav>
      </footer>
    </main>
  );
}
