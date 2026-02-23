import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT * FROM inspections ORDER BY created_at DESC"
    );
    return NextResponse.json(result.rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await pool.query(
      "INSERT INTO inspections (title, location, inspector) VALUES ($1, $2, $3) RETURNING *",
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
      "UPDATE inspections SET summary = COALESCE($1, summary), zones_data = COALESCE($2, zones_data) WHERE id = $3 RETURNING *",
      [body.summary || null, body.zones_data ? JSON.stringify(body.zones_data) : null, body.id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
