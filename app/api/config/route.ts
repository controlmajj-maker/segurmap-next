import { NextResponse } from "next/server";
import pool from "../../../lib/db";

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const result = await pool.query("SELECT key, value FROM app_config");
    const config: Record<string, string> = {};
    for (const row of result.rows) {
      config[row.key] = row.value;
    }
    console.log("[GET /api/config] keys returned:", Object.keys(config));
    return NextResponse.json(config);
  } catch (error: any) {
    console.error("[GET /api/config] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTable();
    const body = await req.json();
    const keys = Object.keys(body);
    console.log("[PUT /api/config] saving keys:", keys.map(k =>
      k === "zones_config" ? `zones_config(${String(body[k]).length}chars)` : k
    ));

    for (const [key, value] of Object.entries(body)) {
      await pool.query(
        `INSERT INTO app_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value)]
      );
    }

    return NextResponse.json({ success: true, saved: keys });
  } catch (error: any) {
    console.error("[PUT /api/config] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
