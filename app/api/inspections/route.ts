import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function GET() {
  const result = await pool.query(
    "SELECT * FROM inspections ORDER BY created_at DESC"
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const { title, location, inspector } = await req.json();

  const result = await pool.query(
    "INSERT INTO inspections (title, location, inspector) VALUES ($1, $2, $3) RETURNING *",
    [title, location, inspector]
  );

  return NextResponse.json(result.rows[0]);
}
