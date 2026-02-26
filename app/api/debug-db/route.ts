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
    // Check columns of app_config
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
    // Test write WITHOUT updated_at
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
      results.zones_config_raw = null;
    }
  } catch (e: any) { results.zones_config_error = e.message; }

  return NextResponse.json(results);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await pool.query(
      `INSERT INTO app_config (key, value) VALUES ('zones_config', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(body.zones)]
    );
    return NextResponse.json({ ok: true, saved: body.zones?.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
