"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Wordmark } from "@/components/ui";
import { Button, LinkButton, Label } from "@/components/explore/ExplorePage";
import theme from "@/components/explore/explore.module.css";
import s from "./ops.module.css";
import type { Ops } from "./types";
import { citizenLabels } from "@/lib/ops-citizens";
type Row = Record<string, unknown>;
type Report = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  severity: string;
  assignee: string | null;
  duplicate_of: string | null;
  github_url: string | null;
  updated_at: string;
  created_at: string;
  email: string | null;
  page: string;
  version: string;
  screenshot?: string;
  owner_id: string | null;
  messages?: {
    id: string;
    body: string;
    internal: boolean;
    created_at: string;
  }[];
};
const tabs = [
  "Overview",
  "Users",
  "Citizens",
  "Usage",
  "Feedback",
  "Deliveries",
  "Operations",
] as const;
type Tab = (typeof tabs)[number];
const display = (v: unknown): string =>
  v === null || v === undefined
    ? "Unavailable"
    : typeof v === "boolean"
    ? v
      ? "Yes"
      : "No"
    : typeof v === "object"
    ? Object.entries(v as Row)
        .map(([k, x]) => `${k}: ${display(x)}`)
        .join(" · ")
    : String(v);
function Facts({ data = {} }: { data?: Row }) {
  return (
    <dl className={s.list}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <dt>{k.replace(/([A-Z])/g, " $1").replaceAll("_", " ")}</dt>
          <dd>{display(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
function Table({
  rows,
  columns,
  onSelect,
}: {
  rows: Row[];
  columns: string[];
  onSelect?: (r: Row) => void;
}) {
  return (
    <div className={s.table}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)}>
              {columns.map((c, j) => (
                <td key={c}>
                  {j === 0 && onSelect ? (
                    <button onClick={() => onSelect(r)}>{display(r[c])}</button>
                  ) : (
                    display(r[c])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className={s.muted}>No records in this view.</p>}
    </div>
  );
}
export default function OpsRoom() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [session, setSession] = useState<{ id: string; role: string } | null>(
    null,
  );
  const [checking, setChecking] = useState(true);
  const [d, setD] = useState<Ops | null>(null);
  const [overview, setOverview] = useState<Row>({});
  const [providerUsage,setProviderUsage]=useState<Row[]>([]);
  const [population,setPopulation]=useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [npcPlan,setNpcPlan]=useState<{target:number;current:number;remaining:number;protected:number;canReachTarget:boolean;selected:{id:string;name:string;job:string|null}[]}|null>(null);
  const [loaded, setLoaded] = useState("");
  const generation = useRef(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [detail, setDetail] = useState<Row | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [members, setMembers] = useState<Row[]>([]);
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(true);
  const [confirm, setConfirm] = useState<string | null>(null);
  const writable = session?.role !== "viewer";
  useEffect(() => {
    void api<{ id: string; role: string }>("/api/backoffice/session")
      .then(setSession)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  async function refresh() {
    const ticket=++generation.current;setError("");
    try {
      let nextPopulation:Row[]|undefined;let nextRows:Row[]|undefined;let nextOps:Ops|undefined;let meta:Row|undefined;let nextCount:number|undefined;let nextMembers:Row[]|undefined;
      if (["Overview","Usage","Operations"].includes(tab)) {
        [nextOps,meta,nextPopulation]=await Promise.all([api<Ops>("/api/ops"),api<Row>("/api/backoffice/overview"),api<Row[]>("/api/backoffice/citizens")]);
        if(tab==="Usage")setProviderUsage(await api<Row[]>("/api/backoffice/provider-usage"));
        if(tab==="Operations")nextRows=await api<Row[]>("/api/backoffice/audit");
      } else if(tab==="Users") {const v=await api<{users:Row[];count:number}>(`/api/backoffice/users?q=${encodeURIComponent(search)}&page=${page}`);nextRows=v.users;nextCount=v.count;}
      else if(tab==="Citizens")nextRows=await api<Row[]>("/api/backoffice/citizens");
      else if(tab==="Feedback"){[nextRows,nextMembers]=await Promise.all([api<Row[]>(`/api/backoffice/feedback?status=${status}`),api<Row[]>("/api/backoffice/members")]);}
      else nextRows=await api<Row[]>("/api/backoffice/deliveries");
      if(ticket!==generation.current)return;
      if(nextPopulation)setPopulation(nextPopulation);if(nextRows)setRows(nextRows);if(nextOps)setD(nextOps);if(meta)setOverview(meta);if(nextCount!==undefined)setCount(nextCount);if(nextMembers)setMembers(nextMembers);setLoaded(new Date().toLocaleTimeString());
    }catch(e){if(ticket===generation.current){if([401,403].includes((e as {status:number}).status)){setSession(null);setD(null);setRows([]);setDetail(null);setReport(null);}setError((e as Error).message);}}
  }
  useEffect(() => {
    if (!session) return;
    setRows([]);
    setDetail(null);
    setReport(null);
    void refresh();
    return ()=>{generation.current++;};
  }, [session, tab, page, status, search]);
  useEffect(() => {
    if (!session || !["Overview", "Usage"].includes(tab)) return;
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [session, tab]);
  async function action(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openReport(id: string) {
    const ticket=generation.current;
    try {
      const next=await api<Report>(`/api/backoffice/feedback/${id}`);
      if(ticket!==generation.current)return;
      setReport(next);
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function selectCitizen(r: Row) {
    const ticket=generation.current;
    try {
      const next=await api<Row>(`/api/backoffice/citizens/${r.id}`);
      if(ticket===generation.current)setDetail(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!session)
    return (
      <main className={theme.page}>
        <div className={s.gate}>
          <Wordmark />
          <Label>Unwatched back office</Label>
          <h1>
            {checking
              ? "Checking access…"
              : "For the people behind the island."}
          </h1>
          <p className="mb-6">
            Sign in with an approved administrator account. Access is verified
            by the server.
          </p>
          {!checking && (
            <LinkButton href="/gate?next=%2Fops">
              Sign in to back office
            </LinkButton>
          )}
        </div>
      </main>
    );
  return (
    <main className={theme.page}>
      <div className={s.shell}>
        <aside className={s.sidebar}>
          <Wordmark />
          <div>
            <Label>Back office · {session.role}</Label>
            <nav className={s.nav} aria-label="Back office">
              {tabs.map((t) => (
                <button
                  key={t}
                  disabled={busy}
                  aria-current={tab === t ? "page" : undefined}
                  onClick={() => {
                    generation.current++;
                    setDetail(null);setReport(null);setRows([]);setError("");setConfirm(null);
                    setTab(t);
                    setPage(0);
                    setQuery("");setSearch("");
                  }}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
          <Link href="/town">Return to the island ↗</Link>
        </aside>
        <div className={s.main}>
          <header className={s.header}>
            <div>
              <Label>Unwatched operations</Label>
              <h1>{tab}</h1>
              <p className={s.muted}>
                {loaded ? `Last refreshed ${loaded}` : "Loading records…"} ·{" "}
                {tab === "Overview" || tab === "Usage"
                  ? "updates every 30 seconds"
                  : "manual refresh"}
              </p>
            </div>
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Refresh
            </Button>
          </header>
          {error && (
            <div role="alert" className={s.error}>
              {error} Previous data may be out of date.
            </div>
          )}
          {(tab === "Overview" || tab === "Usage") && d && (
            <>
              <div className={s.metrics}>
                {[
                  [d.stats.agents, "Citizens"],
                  [population.filter(a=>a.admission!=="Awaiting activation" && citizenLabels(a).funding === "World-funded").length, "World-funded citizens"],
                  [population.filter(a=>a.admission!=="Awaiting activation" && a.brain==="hosted" && a.owner && a.plan!=="none" && a.plan).length,"Hosted · with subscription"],
                  [population.filter(a=>a.admission!=="Awaiting activation" && a.brain==="hosted" && a.owner && a.plan==="none").length,"Hosted · no subscription"],
                  [population.filter(a=>a.admission!=="Awaiting activation" && a.brain==="own_key").length,"Personal API key"],
                  [population.filter(a=>a.admission!=="Awaiting activation" && a.brain==="own_brain").length,"External brain"],
                  [population.filter(a=>a.admission==="Awaiting activation").length,"Awaiting activation · off island"],
                  [d.stats.holds, "Open holds"],
                  [d.stats.fallbacksToday, "Fallbacks · last 24h"],
                ].map(([v, l]) => (
                  <div className={s.metric} key={l}>
                    <strong>{v}</strong>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              <section className={s.panel}>
                <h2>Needs attention</h2>
                {d.switches.paused && <p>Simulation is paused.</p>}
                {!d.health.store && <p>Snapshot storage is unavailable.</p>}
                {d.stats.holds > 0 && (
                  <p>{d.stats.holds} moderation holds need review.</p>
                )}
                {!d.switches.paused &&
                  d.health.store &&
                  d.stats.holds === 0 && (
                    <p>No active pause, storage warning or moderation hold.</p>
                  )}
                <p className={s.muted}>
                  Additional provider and delivery failures are shown in Usage
                  and Deliveries.
                </p>
              </section>
              <section className={s.panel}>
                <h2>Provider usage</h2>
                <p className={s.muted}>
                  {display(overview.providerWindow)}. Started{" "}
                  {display(overview.startedAt)}. USD costs may be unavailable
                  for providers that do not return them.
                </p>
                <Facts data={(overview.providers ?? {}) as Row} />
                <p className={s.muted}>
                  User-key estimates are available in each citizen’s diagnostic.
                  External own-brain costs are not visible to Unwatched.
                </p>
              </section>
              {tab === "Overview" ? (
                <>
                  <section className={s.panel}>
                    <h2>Service health</h2>
                    <Facts
                      data={{
                        engineVersion: overview.version,
                        engineCommit: overview.commit,
                        emailConfigured: overview.emailConfigured,
                        telegram: overview.telegram,
                        billingLive: overview.billingLive,
                        storage: overview.storage,
                        tickP50Ms: d.health.tickP50,
                        tickMaxMs: d.health.tickMax,
                      }}
                    />
                  </section>
                  <section className={s.panel}>
                    <h2>World health</h2>
                    <Facts data={{ ...d.health, islandDay: d.clock.day }} />
                  </section>
                </>
              ) : (
                <>
                  <section className={s.panel}>
                    <h2>Provider spend · last 24 hours</h2>
                    <p className={s.muted}>Actual USD reported by the provider, recorded since cost tracking was enabled. Missing costs are unknown, not zero. Thought allowances are counts, not dollars. External brains are billed outside Unwatched.</p>
                    <Table rows={providerUsage.map(r=>({...r,citizen:population.find(a=>a.id===r.agent_id)?.name??r.agent_id??"World services",cost_usd:r.cost_usd==null?"Unknown":`$${Number(r.cost_usd).toFixed(4)}`}))} columns={["citizen","funding","calls","cost_usd","unknown_cost_calls","prompt_tokens","completion_tokens","cached_tokens"]}/>
                  </section>
                  <section className={s.panel}>
                    <h2>Calls per island hour · day {d.clock.day}</h2>
                    <div
                      className={s.bars}
                      role="img"
                      aria-label="Model calls per island hour; values in the table below"
                    >
                      {d.hours.map((h) => (
                        <div
                          key={h.hour}
                          className={s.bar}
                          title={`${h.hour}:00: ${h.calls} calls`}
                          style={{
                            height: `${Math.max(
                              2,
                              (h.calls /
                                Math.max(1, ...d.hours.map((h) => h.calls))) *
                                100,
                            )}%`,
                          }}
                        />
                      ))}
                    </div>
                    <Table
                      rows={d.hours as unknown as Row[]}
                      columns={[
                        "hour",
                        "calls",
                        "t1",
                        "t2",
                        "t3",
                        "converse",
                        "cost",
                      ]}
                    />
                    <p className={s.muted}>
                      Cost column is the legacy public-world estimate for this
                      island day. It is not total billed spend.
                    </p>
                  </section>
                  <section className={s.panel}>
                    <h2>Calls by tier · island day {d.clock.day}</h2>
                    <Table
                      rows={d.byTier}
                      columns={["tier", "model", "calls"]}
                    />
                  </section>
                </>
              )}
            </>
          )}
          {tab === "Users" && (
            <>
              <form
                className={s.toolbar}
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(0);
                  if(search===query && page===0)void refresh();
                  else setSearch(query);
                }}
              >
                <label className={s.field}>
                  Find a user
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or email"
                  />
                </label>
                <Button>Search</Button>
              </form>
              <Table
                rows={rows}
                columns={["email", "display_name", "wallet", "created_at"]}
                onSelect={(r) =>
                  void action(async () =>
                    setDetail({
                      user: r,
                      ledger: await api(`/api/backoffice/users/${r.id}/ledger`),
                      billing: await api(
                        `/api/backoffice/users/${r.id}/billing`,
                      ),
                    }),
                  )
                }
              />
              <div className={s.toolbar}>
                <Button
                  kind="secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page + 1} · {count} users
                </span>
                <Button
                  kind="secondary"
                  disabled={(page + 1) * 50 >= count}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
              {detail && (
                <section className={s.panel}>
                  <h2>Account & credit ledger</h2>
                  <Facts data={detail.user as Row} />
                  <Table
                    rows={detail.ledger as Row[]}
                    columns={["created_at", "delta", "reason"]}
                  />
                  <h2>Stripe reconciliation</h2>
                  <Facts data={detail.billing as Row} />
                  <p className={s.muted}>
                    Stripe amounts are in the currency’s smallest unit. Compare
                    active subscription prices to the wallet plan and the
                    promised allowance above. Latest 100 ledger entries. This is
                    recorded credits activity, not a reconciliation against
                    Stripe invoices.
                  </p>
                </section>
              )}
            </>
          )}
          {tab === "Citizens" && (
            <>
              <label className={s.field}>
                Find a citizen
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, owner ID or citizen ID"
                />
              </label>
              <Table
                rows={rows.map((r):Row=>({...r,...citizenLabels(r)})).filter((r) =>
                  `${r.name} ${r.id} ${r.owner}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )}
                columns={[
                  "name",
                  "id",
                  "admission",
                  "funding",
                  "subscription",
                  "ai_access",
                  "asleep",
                  "lastThought",
                ]}
                onSelect={(r) => void selectCitizen(r)}
              />
              <p className={s.muted}>Hosted describes where the brain runs, not a paid plan. Routine only means no available AI allowance or credits; the citizen still follows simulation routines. AI access does not guarantee a successful provider response.</p>
              {detail && (
                <section className={s.panel}>
                  <h2>Explain {display(detail.name)}</h2>
                  <Facts data={citizenLabels({...detail,owner:rows.find(r=>r.id===detail.id)?.owner})} />
                  <Facts
                    data={Object.fromEntries(
                      Object.entries(detail).filter(
                        ([k]) =>
                          ![
                            "events",
                            "projects",
                            "foodRoutineDecisions",
                            "attempts", "funded", "plan",
                          ].includes(k),
                      ),
                    )}
                  />
                  <p className={s.muted}>
                    last thought and now use island minutes. Cadence is an
                    eligibility interval, not a guaranteed appointment. These
                    are recorded state and events; provider failures may require
                    provider logs.
                  </p>
                  <h2>Recent cognition attempts</h2><Table rows={(detail.attempts??[]) as Row[]} columns={["created_at","kind","outcome","funding","duration_ms"]}/><p className={s.muted}>Completed means the brain method returned; it does not prove the action succeeded. History starts with this deployment.</p><h2>Recent recorded events</h2>
                  {(detail.events as Row[]).map((e) => (
                    <div className={s.event} key={String(e.id)}>
                      <Label>
                        {display(e.kind)} · minute {display(e.t)}
                      </Label>
                      <p>{display(e.text)}</p>
                    </div>
                  ))}
                  <h2>Projects & learning</h2>
                  <Facts
                    data={{
                      projects: detail.projects,
                      foodRoutineDecisions: detail.foodRoutineDecisions,
                    }}
                  />
                </section>
              )}
            </>
          )}
          {tab === "Feedback" && (
            <>
              <label className={s.field}>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {[
                    "all",
                    "new",
                    "reviewing",
                    "planned",
                    "in_progress",
                    "resolved",
                    "closed",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <Table
                rows={rows}
                columns={[
                  "title",
                  "category",
                  "status",
                  "severity",
                  "created_at",
                ]}
                onSelect={(r) => void openReport(String(r.id))}
              />
              <p className={s.muted}>
                Latest 200 matching reports. Incoming reports are private.
              </p>
              {report && (
                <section className={s.panel}>
                  <h2>{report.title}</h2>
                  <p className="whitespace-pre-wrap mb-6">
                    {report.description}
                  </p>
                  <Facts
                    data={{
                      reference: report.id,
                      page: report.page,
                      version: report.version,
                      email: report.email,
                      owner: report.owner_id,
                    }}
                  />
                  {report.email && (
                    <a href={`mailto:${report.email}`}>Reply by email ↗</a>
                  )}
                  {report.screenshot && (
                    <img
                      className="max-h-96 my-5"
                      src={report.screenshot}
                      alt="User-provided report screenshot"
                    />
                  )}
                  <div className={s.split}>
                    <label className={s.field}>
                      Status
                      <select
                        disabled={!writable}
                        value={report.status}
                        onChange={(e) =>
                          setReport({ ...report, status: e.target.value })
                        }
                      >
                        {[
                          "new",
                          "reviewing",
                          "planned",
                          "in_progress",
                          "resolved",
                          "closed",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className={s.field}>
                      Severity
                      <select
                        disabled={!writable}
                        value={report.severity}
                        onChange={(e) =>
                          setReport({ ...report, severity: e.target.value })
                        }
                      >
                        {["low", "normal", "high", "urgent"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className={s.field}>
                      Assignee
                      <select
                        disabled={!writable}
                        value={report.assignee ?? ""}
                        onChange={(e) =>
                          setReport({
                            ...report,
                            assignee: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option
                            key={String(m.user_id)}
                            value={String(m.user_id)}
                          >
                            {m.user_id === session.id
                              ? "You"
                              : String(m.user_id)}{" "}
                            · {String(m.role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={s.field}>
                      Duplicate of · report ID
                      <input
                        disabled={!writable}
                        value={report.duplicate_of ?? ""}
                        onChange={(e) =>
                          setReport({
                            ...report,
                            duplicate_of: e.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label className={s.field}>
                      Linked GitHub issue
                      <input
                        disabled={!writable}
                        value={report.github_url ?? ""}
                        placeholder="https://github.com/kresogalic8/unwatched/issues/…"
                        onChange={(e) =>
                          setReport({
                            ...report,
                            github_url: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className={s.toolbar}>
                    <Button
                      disabled={busy || !writable}
                      onClick={() =>
                        void action(async () => {
                          await api(`/api/backoffice/feedback/${report.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              status: report.status,
                              severity: report.severity,
                              assignee: report.assignee,
                              duplicate_of: report.duplicate_of,
                              github_url: report.github_url,
                              updated_at: report.updated_at,
                            }),
                          });
                          await openReport(report.id);
                        })
                      }
                    >
                      Save report
                    </Button>
                    <a
                      href="https://github.com/kresogalic8/unwatched/issues/new"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Draft a GitHub issue ↗
                    </a>
                  </div>
                  <p className={s.muted}>
                    Review and remove private details before publishing to
                    GitHub.
                  </p>
                  {report.messages?.map((m) => (
                    <div className={s.message} key={m.id}>
                      <Label>
                        {m.internal
                          ? "Internal note"
                          : "Reply visible to reporter"}{" "}
                        · {new Date(m.created_at).toLocaleString()}
                      </Label>
                      <p>{m.body}</p>
                    </div>
                  ))}
                  <label className={s.field}>
                    Message
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={5000}
                    />
                  </label>
                  <label className={s.toolbar}>
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                    />
                    Internal note (staff only)
                  </label>
                  {!internal && !report.owner_id && (
                    <p>
                      Guest reports have no account inbox. Use their reply email
                      if provided.
                    </p>
                  )}
                  <Button
                    disabled={
                      busy ||
                      !writable ||
                      !message.trim() ||
                      (!internal && !report.owner_id)
                    }
                    onClick={() =>
                      void action(async () => {
                        await api(
                          `/api/backoffice/feedback/${report.id}/messages`,
                          {
                            method: "POST",
                            body: JSON.stringify({ body: message, internal }),
                          },
                        );
                        await openReport(report.id);
                      })
                    }
                  >
                    {internal ? "Add internal note" : "Send reply to account"}
                  </Button>
                </section>
              )}
            </>
          )}
          {tab === "Deliveries" && (
            <section className={s.panel}>
              <h2>Delivery attempts</h2>
              <p className={s.muted}>
                Latest 200 attempts recorded after this update. Accepted means
                the provider accepted the request; inbox delivery is not
                confirmed. Auth emails sent directly by Supabase are outside
                this log.
              </p>
              <Table
                rows={rows}
                columns={[
                  "created_at",
                  "channel",
                  "kind",
                  "status",
                  "agent_id",
                  "provider_id",
                  "error",
                ]}
                onSelect={(r) => setDetail(r)}
              />
              {detail && (
                <div>
                  <Facts data={detail} />
                  {detail.channel === "email" &&
                    detail.status === "failed" &&
                    !!detail.job_id && (
                      <>
                        <p className={s.muted}>
                          Retry uses the original message and checks current
                          ownership, recipient and preferences. Available for 23
                          hours; requests are deduplicated by Resend.
                        </p>
                        <Button
                          disabled={busy || !writable}
                          onClick={() =>
                            void action(() =>
                              api(
                                `/api/backoffice/deliveries/${detail.id}/retry`,
                                { method: "POST" },
                              ),
                            )
                          }
                        >
                          Retry failed email
                        </Button>
                      </>
                    )}
                </div>
              )}
            </section>
          )}
          {tab === "Operations" && d && (
            <>
              <section className={`${s.panel} ${s.danger}`}>
                <h2>World controls</h2>
                <h3>Island residents · target 10 NPCs</h3>
                <p className={s.muted}>Review departures for ownerless citizens only. Parents, property owners, the mayor and close connections of user citizens are protected. Departures keep historical records; they are not deletions.</p>
                <Button kind="secondary" disabled={busy||!writable} onClick={()=>void action(async()=>setNpcPlan(await api("/api/ops/npc-population?target=10")))}>Review NPC population</Button>
                {npcPlan&&<div role="status"><p>{npcPlan.current} NPCs → {npcPlan.remaining}. {npcPlan.protected} protected.</p><ul>{npcPlan.selected.map(a=><li key={a.id}>{a.name} · {a.job??"No job"}</li>)}</ul>{!npcPlan.canReachTarget&&<p>Cannot reach 10 without affecting protected citizens. No changes will be applied.</p>}<Button disabled={busy||!writable||!npcPlan.canReachTarget||!npcPlan.selected.length} onClick={()=>void action(async()=>{await api("/api/ops/npc-population",{method:"POST",body:JSON.stringify({target:npcPlan.target,ids:npcPlan.selected.map(a=>a.id)})});setNpcPlan(null);})}>Confirm these departures</Button><Button kind="secondary" onClick={()=>setNpcPlan(null)}>Cancel</Button></div>}

                <p className={s.muted}>
                  Changes affect everyone. Every request is attributed to your
                  account. Successful world switches also appear in the Gazette.
                </p>
                <Facts data={d.switches} />
                <p className={s.muted}>Move user-owned hosted citizens with no plan and no credits out of the live world. Their full state is preserved for activation.</p>
                <Button kind="secondary" disabled={busy||!writable} onClick={()=>setConfirm("park-unfunded")}>Move unfunded citizens to awaiting activation</Button>
                <div className={s.toolbar}>
                  {(["pause", "economy", "boat", "snapshot"] as const).map(
                    (w) => (
                      <Button
                        key={w}
                        kind="secondary"
                        disabled={busy || !writable}
                        onClick={() => setConfirm(w)}
                      >
                        {w === "snapshot"
                          ? "Save snapshot"
                          : w === "pause"
                          ? d.switches.paused
                            ? "Resume time"
                            : "Pause time"
                          : w === "economy"
                          ? d.switches.economyFrozen
                            ? "Resume economy"
                            : "Freeze economy"
                          : d.switches.boatHeld
                          ? "Release boat"
                          : "Hold boat"}
                      </Button>
                    ),
                  )}
                </div>
                {confirm && (
                  <div role="alert">
                    <p>{confirm==="park-unfunded"?"Move unfunded user citizens off the live island? Their full state will be preserved for activation.":`Apply ${confirm} to the live world?`}</p>
                    <div className={s.toolbar}>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api(confirm==="park-unfunded"?"/api/ops/park-unfunded":"/api/ops/switch", {
                              method: "POST",
                              body: JSON.stringify({
                                which: confirm,
                                on:
                                  confirm === "pause"
                                    ? !d.switches.paused
                                    : confirm === "economy"
                                    ? !d.switches.economyFrozen
                                    : !d.switches.boatHeld,
                              }),
                            });
                            setConfirm(null);
                          })
                        }
                      >
                        Confirm change
                      </Button>
                      <Button kind="secondary" onClick={() => setConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </section>
              <section className={s.panel}>
                <h2>Moderation queue</h2>
                {d.holds
                  .filter((h) => !h.done)
                  .map((h) => (
                    <div className={s.event} key={h.id}>
                      <Label>
                        {h.level} · {h.source}
                      </Label>
                      <p>{h.text}</p>
                      <Button
                        kind="secondary"
                        disabled={busy || !writable}
                        onClick={() =>
                          void action(() =>
                            api(`/api/ops/hold/${h.id}`, { method: "POST" }),
                          )
                        }
                      >
                        Mark reviewed
                      </Button>
                    </div>
                  ))}
                {!d.holds.some((h) => !h.done) && (
                  <p>No open moderation items.</p>
                )}
              </section>
              <section className={s.panel}>
                <h2>Administrator audit trail</h2>
                <Table
                  rows={rows}
                  columns={[
                    "created_at",
                    "actor",
                    "action",
                    "target",
                    "outcome",
                  ]}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
