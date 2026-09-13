import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/agent", "/board", "/farewell", "/film", "/gate", "/hall", "/icons", "/letters", "/looks", "/m", "/ops", "/experiments", "/engine/", "/api/"] }], sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
