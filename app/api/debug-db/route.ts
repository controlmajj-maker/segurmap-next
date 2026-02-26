import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET() {
  const results: Record<string, any> = {};

  try {
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    results.tables = tables.rows.map((r: any) => r.table_name);
  } catch (e: any) { results.tables_error = e.message; }

  try {
    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'app_config'`
    );
    results.app_config_columns = cols.rows;
  } catch (e: any) { results.app_config_columns_error = e.message; }

  try {
    const cfg = await pool.query("SELECT key, LEFT(value, 100) as value_preview FROM app_config ORDER BY key");
    results.app_config_rows = cfg.rows;
  } catch (e: any) { results.app_config_error = e.message; }

  try {
    await pool.query(
      `INSERT INTO app_config (key, value) VALUES ('__test__', 'ok')
       ON CONFLICT (key) DO UPDATE SET value = 'ok'`
    );
    results.test_write = "SUCCESS";
  } catch (e: any) { results.test_write = `FAILED: ${e.message}`; }

  try {
    const zc = await pool.query("SELECT value FROM app_config WHERE key = 'zones_config'");
    if (zc.rows[0]) {
      results.zones_config_length = zc.rows[0].value.length;
      const parsed = JSON.parse(zc.rows[0].value);
      results.zones_count = Array.isArray(parsed) ? parsed.length : "not array";
      results.zones_names = Array.isArray(parsed) ? parsed.map((z: any) => z.name) : [];
    } else {
      results.zones_config_exists = false;
    }
  } catch (e: any) { results.zones_config_error = e.message; }

  return NextResponse.json(results);
}

// POST: write zones_config directly to DB (bypasses config route)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const value = body.zones_config ?? JSON.stringify(body.zones);
    await pool.query(
      `INSERT INTO app_config (key, value) VALUES ('zones_config', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [value]
    );
    // Verify it saved
    const verify = await pool.query("SELECT value FROM app_config WHERE key = 'zones_config'");
    const parsed = JSON.parse(verify.rows[0].value);
    return NextResponse.json({ 
      ok: true, 
      saved_count: Array.isArray(parsed) ? parsed.length : 0,
      zone_names: Array.isArray(parsed) ? parsed.map((z: any) => z.name) : []
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: test the exact same logic as config PUT route
export async function PATCH(req: Request) {
  try {
    const incoming = await req.json() as Record<string, unknown>;
    const keys_written: string[] = [];
    for (const [k, v] of Object.entries(incoming)) {
      await pool.query(
        `INSERT INTO app_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [k, String(v)]
      );
      keys_written.push(k);
    }
    const r = await pool.query("SELECT key, value FROM app_config");
    const saved: Record<string, string> = {};
    for (const row of r.rows) { saved[row.key] = row.value; }
    return NextResponse.json({ ok: true, keys_written, all_keys: Object.keys(saved) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
