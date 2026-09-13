import { describe, it, expect, vi } from "vitest";
import {
  adminResolver,
  backofficeRoutes,
  safePage,
  safeScreenshot,
} from "../src/backoffice.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
function dbMock() {
  const writes: unknown[] = [];
  let result: { data: unknown; error: unknown } = { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const k of [
    "select",
    "eq",
    "in",
    "order",
    "limit",
    "range",
    "or",
    "maybeSingle",
    "single",
    "update",
    "insert",
  ])
    chain[k] = vi.fn((...args) => {
      if (k === "insert" || k === "update") writes.push(args[0]);
      return chain;
    });
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  const db = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user" } }, error: null }),
    },
    from: vi.fn(() => chain),
    rpc: vi.fn().mockResolvedValue({ data: "report-id", error: null }),
  };
  return {
    db: db as unknown as SupabaseClient,
    raw: db,
    writes,
    set: (data: unknown, error: unknown = null) => {
      result = { data, error };
    },
  };
}
function routes(
  role: "viewer" | "operator" | "admin" | null,
  owner: string | null = "owner",
) {
  const mock = dbMock();
  const app = backofficeRoutes({
    db: mock.db,
    ownerOf: async () => owner,
    adminOf: async () => (role ? { id: "staff", role } : null),
    citizens: () => [],
    diagnostic: () => null,
    overview: () => ({}),
  });
  return { app, ...mock };
}
describe("backoffice authorization", () => {
  it("requires verified bearer identity and a server-side membership", async () => {
    const m = dbMock();
    const resolve = adminResolver(m.db);
    expect(
      await resolve(
        new Request("http://test", {
          headers: { "X-Owner": "staff", "X-Ops": "anything" },
        }),
      ),
    ).toBeNull();
    expect(m.raw.auth.getUser).not.toHaveBeenCalled();
    m.set(null);
    expect(
      await resolve(
        new Request("http://test", {
          headers: { Authorization: "Bearer sample" },
        }),
      ),
    ).toBeNull();
    m.set({ role: "viewer" });
    expect(
      await resolve(
        new Request("http://test", {
          headers: { Authorization: "Bearer sample" },
        }),
      ),
    ).toEqual({ id: "user", role: "viewer" });
  });
  it("denies all private endpoints to non-admins", async () => {
    const { app } = routes(null);
    for (const url of [
      "/backoffice/users",
      "/backoffice/feedback",
      "/backoffice/deliveries",
      "/backoffice/audit",
      "/backoffice/citizens",
    ])
      expect((await app.request(url)).status).toBe(403);
  });
  it("denies mutations to viewers", async () => {
    const { app, writes } = routes("viewer");
    expect(
      (
        await app.request("/backoffice/feedback/id/messages", {
          method: "POST",
          body: JSON.stringify({ body: "test", internal: true }),
          headers: { "Content-Type": "application/json" },
        })
      ).status,
    ).toBe(403);
    expect(writes).toHaveLength(0);
  });
  it("requires sign-in for report history", async () => {
    const { app } = routes(null, null);
    expect((await app.request("/me/feedback")).status).toBe(401);
  });
  it("excludes internal messages from reporter history", async () => {
    const { app, raw, set } = routes(null);
    set([{ id: "report" }]);
    await app.request("/me/feedback");
    const c = raw.from.mock.results[0]!.value;
    expect(c.eq).toHaveBeenCalledWith("owner_id", "owner");
    expect(c.eq).toHaveBeenCalledWith("internal", false);
  });
});
describe("feedback intake", () => {
  it("strips query strings and fragments from context", () => {
    expect(safePage("/gate?code=secret#access_token=private")).toBe("/gate");
  });
  it("rejects SVG, invalid image content and oversized uploads", () => {
    expect(() =>
      safeScreenshot("data:image/svg+xml;base64,PHN2Zz4="),
    ).toThrow();
    expect(() => safeScreenshot("data:image/png;base64,ZmFrZQ==")).toThrow();
    expect(() =>
      safeScreenshot("data:image/jpeg;base64," + "a".repeat(1500000)),
    ).toThrow();
  });
  it("saves sanitized context and never accepts a submitted owner ID", async () => {
    const { app, raw } = routes(null);
    const r = await app.request("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "A broken control",
        description: "The submit button does not respond.",
        category: "bug",
        page: "/gate?code=secret",
        owner_id: "someone-else",
      }),
    });
    expect(r.status).toBe(201);
    expect(raw.rpc.mock.calls[0]![1].p).toMatchObject({
      owner_id: "owner",
      page: "/gate",
    });
  });
  it("does not pretend a database failure was a successful report", async () => {
    const { app, raw } = routes(null);
    raw.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "offline" },
    } as never);
    expect(
      (
        await app.request("/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "A broken control",
            description: "The submit button does not respond.",
            category: "bug",
            page: "/",
          }),
        })
      ).status,
    ).toBe(503);
  });
});
