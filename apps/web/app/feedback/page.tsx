"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExplorePage, Label, Button } from "@/components/explore/ExplorePage";
import { api } from "@/lib/api";
import { useSessionState } from "@/components/auth/SessionLink";
import s from "@/components/feedback/feedback.module.css";
type History = {
  reports: {
    id: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
  }[];
  messages: {
    id: string;
    report_id: string;
    body: string;
    created_at: string;
  }[];
};
export default function Feedback() {
  const session = useSessionState();
  const [category, setCategory] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [screenshot, setScreenshot] = useState<string>();
  const [source, setSource] = useState("/");
  const [version, setVersion] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [history, setHistory] = useState<History | null>(null);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    const from = new URLSearchParams(location.search).get("from");
    if (from?.startsWith("/") && !from.startsWith("//"))
      setSource(from.split(/[?#]/)[0] ?? "/");
    void fetch("/api/version")
      .then((r) => r.json())
      .then((v) => setVersion(v.commit ?? v.version))
      .catch(() => {});
  }, []);
  const load = () =>
    api<History>("/api/me/feedback")
      .then(setHistory)
      .catch(() => setHistoryError("Your reports could not be loaded."));
  useEffect(() => {
    if (session === "signed-in") void load();
    else setHistory(null);
  }, [session]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string }>("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          category,
          title,
          description,
          ...(email ? { email } : {}),
          page: source,
          ...(source.match(/^\/agent\/([^/]+)/)?.[1]?{agentId:source.match(/^\/agent\/([^/]+)/)![1]}:{}),
          version,
          ...(screenshot ? { screenshot } : {}),
          website,
        }),
      });
      setReceipt(r.id);
      setTitle("");
      setDescription("");
      setScreenshot(undefined);
      if (session === "signed-in") void load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function attach(file?: File) {
    setError("");
    if (!file) {
      setScreenshot(undefined);
      return;
    }
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 1048576
    ) {
      setError("Choose a PNG or JPEG screenshot under 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(String(reader.result));
    reader.onerror = () => setError("The screenshot could not be read.");
    reader.readAsDataURL(file);
  }
  return (
    <ExplorePage
      eyebrow="Help shape the island"
      title="Tell us what you noticed."
      description="A broken button, a confusing moment, an idea worth exploring. We’re listening."
    >
      <div className={s.grid}>
        <div>
          {receipt ? (
            <section role="status">
              <Label>Feedback received</Label>
              <h2 className="text-3xl my-4">Thank you for helping.</h2>
              <p>
                Your reference: <strong>{receipt}</strong>
              </p>
              <p className={s.note}>
                {session === "signed-in"
                  ? "Follow your report and our replies below."
                  : "Keep this reference. Sign in before sending future reports to follow replies in your account."}
              </p>
              <Button className="mt-5" onClick={() => setReceipt("")}>
                Send another report
              </Button>
            </section>
          ) : (
            <form className={s.form} onSubmit={submit}>
              <fieldset>
                <legend className="mb-3">What would you like to share?</legend>
                <div className={s.types}>
                  {[
                    ["bug", "Something is broken"],
                    ["idea", "An improvement"],
                    ["help", "I need help"],
                    ["praise", "Something I liked"],
                  ].map(([v, label]) => (
                    <button
                      type="button"
                      key={v}
                      aria-pressed={category === v}
                      onClick={() => setCategory(v!)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className={s.field}>
                In a few words
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What happened, or what could be better?"
                />
              </label>
              <label className={s.field}>
                Tell us more
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="For bugs: what did you expect, what happened, and how can we reproduce it?"
                />
              </label>
              <label className={s.field}>
                Reply email · optional
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className={s.field}>
                Screenshot · optional PNG or JPEG, up to 1 MB
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => void attach(e.target.files?.[0])}
                />
              </label>
              {screenshot && (
                <div>
                  <img
                    src={screenshot}
                    alt="Screenshot attached to your report"
                    className="max-h-52"
                  />
                  <Button
                    kind="secondary"
                    onClick={() => setScreenshot(undefined)}
                    type="button"
                  >
                    Remove screenshot
                  </Button>
                </div>
              )}
              <label className={s.trap} aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
              <p className={s.note}>
                Included with your report: page {source}, app version{" "}
                {version.slice(0, 7) || "unknown"}, browser information and your
                account ID if signed in. Query parameters and login tokens are
                excluded. Please remove personal information from screenshots.
              </p>
              {error && <p role="alert">{error}</p>}
              <Button disabled={busy}>
                {busy ? "Sending…" : "Send feedback"}
              </Button>
            </form>
          )}
          {session === "signed-in" && (
            <section className="mt-12">
              <h2 className="text-3xl mb-5">Your reports</h2>
              {historyError && (
                <p role="alert">
                  {historyError}{" "}
                  <button onClick={() => void load()}>Try again</button>
                </p>
              )}
              {history?.reports.length === 0 && <p>No reports yet.</p>}
              {history?.reports.map((r) => (
                <article key={r.id} className={s.report}>
                  <Label>
                    {r.status.replaceAll("_", " ")} ·{" "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </Label>
                  <h2>{r.title}</h2>
                  <p>{r.description}</p>
                  {history.messages
                    .filter((m) => m.report_id === r.id)
                    .map((m) => (
                      <div className={s.reply} key={m.id}>
                        <Label>From the Unwatched team</Label>
                        <p>{m.body}</p>
                      </div>
                    ))}
                </article>
              ))}
            </section>
          )}
        </div>
        <aside>
          <Label>A shared experiment</Label>
          <p className="text-xl leading-relaxed my-5">
            Your feedback helps us make this world easier to understand, explore
            and enjoy.
          </p>
          <p className={s.note}>
            Reports are private. If an issue belongs on GitHub, we’ll review and
            remove private details first.
          </p>
          {session === "signed-out" && (
            <p className="my-5">
              <Link href="/gate?next=%2Ffeedback">
                Sign in to follow your reports ↗
              </Link>
            </p>
          )}
          <p className={s.note}>
            Please never include passwords, API keys or payment details. Guest
            reports can include an email for follow-up; account replies appear
            here.
          </p>
        </aside>
      </div>
    </ExplorePage>
  );
}
