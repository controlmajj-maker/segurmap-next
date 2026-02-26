import { NextResponse } from "next/server";
import pool from "../../../lib/db";

// app_config table already exists in DB with only: key TEXT PRIMARY KEY, value TEXT NOT NULL
// DO NOT use updated_at column - it doesn't exist in the current schema

export async function GET() {
  try {
    const r = await pool.query("SELECT key, value FROM app_config");
    const config: Record<string, string> = {};
    for (const row of r.rows) {
      config[row.key] = row.value;
    }
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
    for (const [k, v] of Object.entries(incoming)) {
      await pool.query(
        `INSERT INTO app_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [k, String(v)]
      );
    }
    const r = await pool.query("SELECT key, value FROM app_config");
    const saved: Record<string, string> = {};
    for (const row of r.rows) { saved[row.key] = row.value; }
    console.log("[cfg PUT] saved keys:", Object.keys(saved), "zones_config len:", saved.zones_config?.length ?? 0);
    return NextResponse.json({ ok: true, keys: Object.keys(saved) });
  } catch (e: any) {
    console.error("[cfg PUT] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
