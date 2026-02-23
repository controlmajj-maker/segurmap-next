import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const inspection_id = searchParams.get("inspection_id");
    const result = await pool.query(
      "SELECT * FROM findings WHERE inspection_id = $1 ORDER BY created_at DESC",
      [inspection_id]
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
      `INSERT INTO findings (inspection_id, item_label, description, severity, photo_url, ai_analysis)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        body.inspection_id,
        body.item_label,
        body.description,
        body.severity || "medium",
        body.photo_url || null,
        body.ai_analysis || null,
      ]
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
      `UPDATE findings 
       SET is_closed = true, corrective_actions = $1, closed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [body.corrective_actions, body.id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
