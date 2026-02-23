import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const inspections = await sql`
    SELECT * FROM inspections
    ORDER BY created_at DESC
  `;

  return NextResponse.json(inspections);
}

export async function POST(req: Request) {
  const body = await req.json();

  const result = await sql`
    INSERT INTO inspections (title, location, inspector)
    VALUES (${body.title}, ${body.location}, ${body.inspector})
    RETURNING *
  `;

  return NextResponse.json(result[0]);
}
