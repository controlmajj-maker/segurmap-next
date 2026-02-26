import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET() {
  const results: Record<string, any> = {};
  
  try {
    // 1. Check what tables exist
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    results.tables = tables.rows.map((r: any) => r.table_name);
  } catch (e: any) { results.tables_error = e.message; }

  try {
    // 2. Check app_config contents
    const cfg = await pool.query("SELECT * FROM app_config ORDER BY key");
    results.app_config_rows = cfg.rows;
  } catch (e: any) { results.app_config_error = e.message; }

  try {
    // 3. Check legacy sentinel
    const sentinel = await pool.query(
      "SELECT id, title, LEFT(summary, 200) as summary_preview FROM inspections WHERE title = '__cfg__'"
    );
    results.sentinel_rows = sentinel.rows;
  } catch (e: any) { results.sentinel_error = e.message; }

  try {
    // 4. Try a test write to app_config
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO app_config (key, value, updated_at) VALUES ('__test__', 'ok', NOW())
      ON CONFLICT (key) DO UPDATE SET value = 'ok', updated_at = NOW()
    `);
    results.test_write = "SUCCESS";
  } catch (e: any) { results.test_write = `FAILED: ${e.message}`; }

  try {
    // 5. Check zones_config specifically
    const zc = await pool.query("SELECT value FROM app_config WHERE key = 'zones_config'");
    if (zc.rows[0]) {
      results.zones_config_raw = zc.rows[0].value.substring(0, 500);
      results.zones_config_length = zc.rows[0].value.length;
      try {
        const parsed = JSON.parse(zc.rows[0].value);
        results.zones_config_count = Array.isArray(parsed) ? parsed.length : "not array";
        results.zones_names = Array.isArray(parsed) ? parsed.map((z: any) => z.name) : [];
      } catch (e: any) { results.zones_config_parse_error = e.message; }
    } else {
      results.zones_config_raw = null;
    }
  } catch (e: any) { results.zones_config_error = e.message; }

  return NextResponse.json(results, { status: 200 });
}

// Also allow POST to manually set zones_config for testing
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO app_config (key, value, updated_at) VALUES ('zones_config', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(body.zones)]);
    return NextResponse.json({ ok: true, saved: body.zones?.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
