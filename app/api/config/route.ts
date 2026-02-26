import { NextResponse } from "next/server";
import pool from "../../../lib/db";

/**
 * Config storage strategy (v2):
 * - Dedicated `app_config` table with key/value pairs (UPSERT)
 * - Auto-creates the table on first use
 * - Falls back to legacy sentinel row in `inspections` for migration
 */

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function readAll(): Promise<Record<string, string>> {
  await ensureTable();
  const r = await pool.query("SELECT key, value FROM app_config");
  const result: Record<string, string> = {};
  for (const row of r.rows) {
    result[row.key] = row.value;
  }
  // Migration: if empty, try legacy sentinel row
  if (Object.keys(result).length === 0) {
    try {
      const legacy = await pool.query(
        "SELECT summary FROM inspections WHERE title = '__cfg__' LIMIT 1"
      );
      if (legacy.rows[0]?.summary) {
        const parsed = JSON.parse(legacy.rows[0].summary) as Record<string, string>;
        // Migrate to new table
        for (const [k, v] of Object.entries(parsed)) {
          await pool.query(
            `INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [k, String(v)]
          );
        }
        return parsed;
      }
    } catch { /* no legacy data */ }
  }
  return result;
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
    await ensureTable();
    const incoming = await req.json() as Record<string, unknown>;
    // UPSERT each key individually — atomic, no lost updates
    for (const [k, v] of Object.entries(incoming)) {
      await pool.query(
        `INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [k, String(v)]
      );
    }
    const saved = await readAll();
    console.log("[cfg PUT] saved keys:", Object.keys(saved), "zones_config len:", saved.zones_config?.length ?? 0);
    return NextResponse.json({ ok: true, keys: Object.keys(saved) });
  } catch (e: any) {
    console.error("[cfg PUT] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
