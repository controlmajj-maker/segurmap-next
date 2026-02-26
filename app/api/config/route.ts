import { NextResponse } from "next/server";
import pool from "../../../lib/db";

/**
 * Config storage strategy:
 * - One special row in `inspections` with title = '__cfg__'
 * - All config (zones_config, bg_url, bg_zoom, bg_offset_x, bg_offset_y)
 *   is stored as a flat JSON object in the `summary` TEXT column.
 * - We NEVER use zones_data or ::jsonb here — TEXT only, no casting.
 */
const SENTINEL = "__cfg__";

async function readAll(): Promise<Record<string, string>> {
  const r = await pool.query(
    "SELECT summary FROM inspections WHERE title = $1 LIMIT 1",
    [SENTINEL]
  );
  if (!r.rows[0]?.summary) return {};
  try { return JSON.parse(r.rows[0].summary); }
  catch { return {}; }
}

async function writeAll(data: Record<string, string>): Promise<void> {
  const json = JSON.stringify(data);
  const upd = await pool.query(
    "UPDATE inspections SET summary = $1 WHERE title = $2 RETURNING id",
    [json, SENTINEL]
  );
  if ((upd.rowCount ?? 0) === 0) {
    await pool.query(
      "INSERT INTO inspections (title, location, inspector, is_active, summary) VALUES ($1, $2, $3, $4, $5)",
      [SENTINEL, "", "", false, json]
    );
  }
}

export async function GET() {
  try {
    const config = await readAll();
    console.log("[cfg GET] keys:", Object.keys(config), "zones_config len:", config.zones_config?.length ?? 0);
    return NextResponse.json(config);
  } catch (e: any) {
    console.error("[cfg GET] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const incoming = await req.json() as Record<string, unknown>;
    // Merge incoming values (as strings) over existing config
    const existing = await readAll();
    const merged: Record<string, string> = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
      merged[k] = String(v);
    }
    await writeAll(merged);
    console.log("[cfg PUT] saved keys:", Object.keys(merged), "zones_config len:", merged.zones_config?.length ?? 0);
    return NextResponse.json({ ok: true, keys: Object.keys(merged) });
  } catch (e: any) {
    console.error("[cfg PUT] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
