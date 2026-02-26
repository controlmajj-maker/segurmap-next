import { NextResponse } from "next/server";
import pool from "../../../lib/db";

// Simple, direct reads/writes to app_config table
// Table schema: key TEXT PRIMARY KEY, value TEXT NOT NULL

export async function GET() {
  try {
    const r = await pool.query("SELECT key, value FROM app_config");
    const config: Record<string, string> = {};
    for (const row of r.rows) {
      config[row.key] = row.value;
    }
    return NextResponse.json(config);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.text();
    const incoming = JSON.parse(body) as Record<string, unknown>;
    for (const [k, v] of Object.entries(incoming)) {
      await pool.query(
        `INSERT INTO app_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [k, String(v)]
      );
    }
    const r = await pool.query("SELECT key FROM app_config");
    return NextResponse.json({ ok: true, keys: r.rows.map((row: any) => row.key) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
