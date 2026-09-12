import { Hono } from "hono";
import type { Town } from "@unwatched/engine";
import type { BuildingReplay } from "@unwatched/protocol";

/** Place snapshots retain this small public archive, independently of the rolling event log. */
export function constructionRoutes(town: Town, name: string) {
  const app = new Hono();
  app.get("/:place?", (c) => {
    const id = c.req.param("place"); const raw = c.req.query("through");
    const through = raw === undefined ? undefined : Number(raw);
    if (through !== undefined && (!id || !Number.isSafeInteger(through) || through < 1)) return c.json({ error: "Choose a positive building moment number." }, 400);
    const places = [...town.places.values()].filter((p) => p.history && (!id || p.id === id));
    if (id && !places.length) return c.json({ error: "No construction record for this place. Records begin with buildings started after this feature was installed." }, 404);
    if (through !== undefined && through > places[0]!.history!.moments.length) return c.json({ error: "That moment has not been recorded." }, 404);
    const replay: BuildingReplay = { town: name, source: "Recorded island actions", size: town.pack.size,
      buildings: places.map((p) => ({ x: p.x, y: p.y, district: p.district, history: { ...p.history!, moments: p.history!.moments.filter((m) => through === undefined || m.sequence <= through) } })) };
    return c.json(replay);
  });
  return app;
}
