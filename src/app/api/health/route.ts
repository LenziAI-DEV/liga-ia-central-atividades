import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const row = getDb().get<{ ok: number }>("SELECT 1 AS ok");
    return Response.json({ db: row?.ok === 1 ? "ok" : "error" });
  } catch {
    return Response.json({ db: "error" }, { status: 503 });
  }
}
