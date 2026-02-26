import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT * FROM inspections WHERE title != '__app_config__' ORDER BY created_at DESC"
    );
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Mark any existing active inspection as inactive first
    await pool.query("UPDATE inspections SET is_active = false WHERE is_active = true");
    const result = await pool.query(
      "INSERT INTO inspections (title, location, inspector, is_active) VALUES ($1, $2, $3, true) RETURNING *",
      [body.title, body.location, body.inspector]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const result = await pool.query(
      "UPDATE inspections SET summary = COALESCE($1, summary), zones_data = COALESCE($2, zones_data), is_active = COALESCE($3, is_active) WHERE id = $4 RETURNING *",
      [body.summary || null, body.zones_data ? JSON.stringify(body.zones_data) : null, body.is_active !== undefined ? body.is_active : null, body.id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    // Delete findings first, then inspection
    await pool.query("DELETE FROM findings WHERE inspection_id = $1", [id]);
    await pool.query("DELETE FROM inspections WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
