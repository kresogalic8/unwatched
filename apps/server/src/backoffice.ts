import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
export type Admin = { id: string; role: "viewer" | "operator" | "admin" };
export function adminResolver(db: SupabaseClient | null) {
  return async (req: Request): Promise<Admin | null> => {
    if (!db) return null;
    const bearer = req.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ")) return null;
    const { data, error } = await db.auth.getUser(bearer.slice(7));
    if (error || !data.user) return null;
    const member = await db
      .from("ops_members")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return member.error || !member.data
      ? null
      : { id: data.user.id, role: member.data.role };
  };
}
export function safePage(value: string) {
  try {
    const u = new URL(value, "https://unwatched.world");
    return u.pathname.replace(/[^a-zA-Z0-9/_\-.]/g, "").slice(0, 200) || "/";
  } catch {
    return "/";
  }
}
export function safeScreenshot(s: string | undefined) {
  if (!s) return null;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!match || s.length > 1450000)
    throw new Error("Use a PNG or JPEG screenshot under 1 MB.");
  const b = Buffer.from(match[2]!, "base64");
  if (
    b.length > 1048576 ||
    (match[1] === "png"
      ? b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
      : b[0] !== 255 || b[1] !== 216 || b[2] !== 255)
  )
    throw new Error("Invalid screenshot.");
  return s;
}
const submission = z.object({
  category: z.enum(["bug", "idea", "help", "praise"]),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  email: z.string().email().max(254).optional(),
  page: z.string().max(2000),
  version: z.string().max(80).optional(),
  agentId: z.string().max(100).optional(),
  screenshot: z.string().max(1450000).optional(),
  website: z.string().max(200).optional(),
});
const selected =
  "id,owner_id,category,title,description,email,page,version,browser,agent_id,status,severity,assignee,duplicate_of,github_url,created_at,updated_at";
export function backofficeRoutes(o: {
  db: SupabaseClient;
  ownerOf: (r: Request) => Promise<string | null>;
  adminOf: (r: Request) => Promise<Admin | null>;
  citizens: () => unknown[];
  diagnostic: (id: string) => unknown | Promise<unknown>;
  overview: () => unknown;
  retry?: (id: string) => Promise<boolean>;
  billing?: (owner: string) => Promise<unknown>;
}) {
  const app = new Hono();
  const db = o.db;
  app.use("*",async(c,next)=>{c.header("Cache-Control","private, no-store");await next();});
  app.use(
    "*",
    bodyLimit({
      maxSize: 1600000,
      onError: (c) => c.json({ error: "Attachment too large." }, 413),
    }),
  );
  app.onError((_e, c) =>
    c.json({ error: "The back office could not complete this request." }, 503),
  );
  app.post("/feedback", async (c) => {
    const parsed = submission.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json(
        {
          error:
            "Add a title, a description of at least 10 characters, and a valid optional email.",
        },
        400,
      );
    const v = parsed.data;
    if (v.website)
      return c.json({ error: "Could not submit this report." }, 400);
    const owner = await o.ownerOf(c.req.raw);
    // Anonymous submissions share a durable limit: clients cannot rotate forwarded headers to evade it.
    const rate_key = createHash("sha256")
      .update(owner ?? "anonymous-feedback")
      .digest("hex");
    let screenshot;
    try {
      screenshot = safeScreenshot(v.screenshot);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
    const result = await db.rpc("submit_feedback", {
      p: {
        owner_id: owner,
        category: v.category,
        title: v.title,
        description: v.description,
        email: v.email ?? null,
        page: safePage(v.page),
        version: v.version ?? null,
        browser: (c.req.header("user-agent") ?? "").slice(0, 250),
        agent_id: v.agentId ?? null,
        screenshot,
        rate_key,
      },
    });
    if (result.error)
      return c.json(
        {
          error: result.error.message.includes("feedback_rate_limit")
            ? "Too many reports. Please try again in an hour."
            : "Feedback could not be saved. Please try again.",
        },
        result.error.message.includes("feedback_rate_limit") ? 429 : 503,
      );
    return c.json({ id: result.data }, 201);
  });
  app.get("/me/feedback", async (c) => {
    const owner = await o.ownerOf(c.req.raw);
    if (!owner) return c.json({ error: "Sign in to see your reports." }, 401);
    const reports = await db
      .from("feedback_reports")
      .select("id,category,title,description,status,created_at,updated_at")
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .limit(100);
    if (reports.error) throw reports.error;
    const ids = (reports.data ?? []).map((r) => r.id);
    const messages = ids.length
      ? await db
          .from("feedback_messages")
          .select("id,report_id,body,created_at")
          .in("report_id", ids)
          .eq("internal", false)
          .order("created_at")
      : { data: [], error: null };
    if (messages.error) throw messages.error;
    return c.json({ reports: reports.data, messages: messages.data });
  });
  app.use("/backoffice/*", async (c, next) => {
    const a = await o.adminOf(c.req.raw);
    if (!a)
      return c.json({ error: "An administrator account is required." }, 403);
    if (c.req.method === "GET") {
      await next();
      return;
    }
    if (a.role === "viewer")
      return c.json({ error: "This account has read-only access." }, 403);
    const entry = await db
      .from("ops_audit")
      .insert({
        actor: a.id,
        action: c.req.method + " " + c.req.path,
        target: c.req.path,
        outcome: "requested",
      })
      .select("id")
      .single();
    if (entry.error || !entry.data)
      return c.json(
        { error: "Audit unavailable; no action was performed." },
        503,
      );
    await next();
    await db
      .from("ops_audit")
      .update({ outcome: c.res.ok ? "completed" : "failed" })
      .eq("id", entry.data.id);
  });
  app.get("/backoffice/session", async (c) =>
    c.json(await o.adminOf(c.req.raw)),
  );
  app.get("/backoffice/overview", (c) => c.json(o.overview()));
  app.get("/backoffice/citizens", (c) => c.json(o.citizens()));
  app.get("/backoffice/citizens/:id", async (c) => {
    const d = await o.diagnostic(c.req.param("id"));
    return d ? c.json(d) : c.json({ error: "Citizen not found." }, 404);
  });
  app.get("/backoffice/users", async (c) => {
    const page = Math.max(0, Number(c.req.query("page")) || 0);
    const search = (c.req.query("q") ?? "")
      .replace(/[%_,()]/g, "")
      .slice(0, 100);
    let query = db
      .from("owners")
      .select("id,email,display_name,created_at", { count: "exact" })
      .order("created_at", { ascending: false });
    if (search)
      query = query.or(
        `email.ilike.%${search}%,display_name.ilike.%${search}%`,
      );
    const users = await query.range(page * 50, page * 50 + 49);
    if (users.error) throw users.error;
    const wallets = await db
      .from("owner_wallets")
      .select("owner_id,plan,credits")
      .in(
        "owner_id",
        (users.data ?? []).map((u) => u.id),
      );
    if (wallets.error) throw wallets.error;
    return c.json({
      users: (users.data ?? []).map((u) => ({
        ...u,
        wallet: wallets.data?.find((w) => w.owner_id === u.id) ?? null,
      })),
      count: users.count,
    });
  });
  app.get("/backoffice/users/:id/ledger", async (c) => {
    const r = await db
      .from("credit_ledger")
      .select("id,delta,reason,created_at")
      .eq("owner_id", c.req.param("id"))
      .order("created_at", { ascending: false })
      .limit(100);
    if (r.error) throw r.error;
    return c.json(r.data);
  });
  app.get("/backoffice/feedback", async (c) => {
    let q = db
      .from("feedback_reports")
      .select(selected)
      .order("created_at", { ascending: false })
      .limit(200);
    const status = c.req.query("status");
    if (status && status !== "all") q = q.eq("status", status);
    const r = await q;
    if (r.error) throw r.error;
    return c.json(r.data);
  });
  app.get("/backoffice/feedback/:id", async (c) => {
    const r = await db
      .from("feedback_reports")
      .select("*")
      .eq("id", c.req.param("id"))
      .maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) return c.json({ error: "Report not found." }, 404);
    const m = await db
      .from("feedback_messages")
      .select("id,body,internal,author_id,created_at")
      .eq("report_id", r.data.id)
      .order("created_at");
    if (m.error) throw m.error;
    return c.json({ ...r.data, messages: m.data });
  });
  app.get("/backoffice/members", async (c) => {
    const r = await db.from("ops_members").select("user_id,role");
    if (r.error) throw r.error;
    return c.json(r.data);
  });
  app.patch("/backoffice/feedback/:id", async (c) => {
    const schema = z.object({
      status: z.enum([
        "new",
        "reviewing",
        "planned",
        "in_progress",
        "resolved",
        "closed",
      ]),
      severity: z.enum(["low", "normal", "high", "urgent"]),
      assignee: z.string().uuid().nullable(),
      duplicate_of: z.string().uuid().nullable(),
      github_url: z
        .string()
        .regex(/^https:\/\/github\.com\/kresogalic8\/unwatched\/issues\/\d+$/)
        .nullable(),
      updated_at: z.string(),
    });
    const p = schema.safeParse(await c.req.json().catch(() => null));
    if (!p.success)
      return c.json(
        {
          error:
            "Check the status, assignee, duplicate reference and GitHub issue link.",
        },
        400,
      );
    const actor = (await o.adminOf(c.req.raw))!;
    const { updated_at, ...change } = p.data;

    const r = await db
      .from("feedback_reports")
      .update({ ...change, updated_at: new Date().toISOString() })
      .eq("id", c.req.param("id"))
      .eq("updated_at", updated_at)
      .select("id");
    if (r.error) throw r.error;
    if (!r.data?.length)
      return c.json(
        { error: "This report changed. Reopen it before saving." },
        409,
      );
    return c.json({ ok: true });
  });
  app.post("/backoffice/feedback/:id/messages", async (c) => {
    const p = z
      .object({
        body: z.string().trim().min(1).max(5000),
        internal: z.boolean(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success) return c.json({ error: "Write a message first." }, 400);
    const a = (await o.adminOf(c.req.raw))!;
    const r = await db
      .from("feedback_messages")
      .insert({ report_id: c.req.param("id"), author_id: a.id, ...p.data });
    if (r.error) throw r.error;
    return c.json({ ok: true });
  });
  app.get("/backoffice/deliveries", async (c) => {
    const r = await db
      .from("delivery_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (r.error) throw r.error;
    return c.json(r.data);
  });
  app.post("/backoffice/deliveries/:id/retry", async (c) => {
    const a = (await o.adminOf(c.req.raw))!;
    const ok = await o.retry?.(c.req.param("id"));
    return ok
      ? c.json({ ok: true })
      : c.json(
          {
            error:
              "Retry unavailable or failed. Only failed email jobs under 23 hours old with unchanged recipient, ownership and notification preferences can be retried.",
          },
          409,
        );
  });
  app.get("/backoffice/users/:id/billing", async (c) =>
    c.json((await o.billing?.(c.req.param("id"))) ?? {}),
  );
  app.get("/backoffice/audit", async (c) => {
    const r = await db
      .from("ops_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (r.error) throw r.error;
    return c.json(r.data);
  });
  return app;
}
