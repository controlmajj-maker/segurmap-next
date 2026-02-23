import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const inspection_id = searchParams.get("inspection_id");

  const result = await pool.query(
    "SELECT * FROM findings WHERE inspection_id = $1 ORDER BY created_at DESC",
    [inspection_id]
  );

  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { inspection_id, title, description, evidence_url } =
    await req.json();

  const result = await pool.query(
    "INSERT INTO findings (inspection_id, title, description, evidence_url) VALUES ($1, $2, $3, $4) RETURNING *",
    [inspection_id, title, description, evidence_url]
  );

  return NextResponse.json(result.rows[0]);
}
