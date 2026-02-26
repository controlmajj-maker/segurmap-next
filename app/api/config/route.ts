import { NextResponse } from "next/server";
import pool from "../../../lib/db";

// We store app config inside the existing inspections table as a special row
// with title='__app_config__'. No new tables needed.
const CONFIG_SENTINEL = "__app_config__";

async function getConfigRow() {
  const r = await pool.query(
    "SELECT * FROM inspections WHERE title = $1 LIMIT 1",
    [CONFIG_SENTINEL]
  );
  return r.rows[0] ?? null;
}

export async function GET() {
  try {
    const row = await getConfigRow();
    if (!row) {
      return NextResponse.json({});
    }
    // zones_data holds zones JSON, summary holds bg_url + offsets JSON
    const config: Record<string, string> = {};
    if (row.zones_data) {
      config.zones_config = typeof row.zones_data === "string"
        ? row.zones_data
        : JSON.stringify(row.zones_data);
    }
    if (row.summary) {
      try {
        const extra = JSON.parse(row.summary);
        Object.assign(config, extra);
      } catch {}
    }
    console.log("[GET /api/config] keys:", Object.keys(config));
    return NextResponse.json(config);
  } catch (error: any) {
    console.error("[GET /api/config] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    console.log("[PUT /api/config] keys:", Object.keys(body));

    const existing = await getConfigRow();

    // Read current extra fields from summary
    let extra: Record<string, string> = {};
    if (existing?.summary) {
      try { extra = JSON.parse(existing.summary); } catch {}
    }

    // Separate zones_config from the rest (bg_url, bg_zoom, etc.)
    let newZonesData: string | null = null;
    const otherKeys: Record<string, string> = { ...extra };

    for (const [k, v] of Object.entries(body)) {
      if (k === "zones_config") {
        newZonesData = String(v);
      } else {
        otherKeys[k] = String(v);
      }
    }

    if (existing) {
      // Update existing config row
      await pool.query(
        `UPDATE inspections SET
          zones_data = COALESCE($1::jsonb, zones_data),
          summary    = $2
         WHERE title = $3`,
        [
          newZonesData ?? null,
          JSON.stringify(otherKeys),
          CONFIG_SENTINEL,
        ]
      );
    } else {
      // Create config row for the first time
      await pool.query(
        `INSERT INTO inspections (title, location, inspector, is_active, zones_data, summary)
         VALUES ($1, '', '', false, $2::jsonb, $3)`,
        [
          CONFIG_SENTINEL,
          newZonesData ?? JSON.stringify([]),
          JSON.stringify(otherKeys),
        ]
      );
    }

    // Verify
    const verify = await getConfigRow();
    console.log("[PUT /api/config] saved ok, zones_data length:",
      verify?.zones_data ? JSON.stringify(verify.zones_data).length : 0);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[PUT /api/config] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
