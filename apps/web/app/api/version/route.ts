export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ version: process.env.RELEASE_VERSION ?? "dev", commit: process.env.COMMIT_SHA ?? "local" }, { headers: { "Cache-Control": "no-store" } });
}
