import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const inspectionId = searchParams.get("inspectionId");

  const findings = await sql`
    SELECT * FROM findings
    WHERE inspection_id = ${inspectionId}
  `;

  return NextResponse.json(findings);
}

export async function POST(req: Request) {
  const body = await req.json();

  const result = await sql`
    INSERT INTO findings (inspection_id, title, description, evidence_url)
    VALUES (${body.inspectionId}, ${body.title}, ${body.description}, ${body.evidenceUrl})
    RETURNING *
  `;

  return NextResponse.json(result[0]);
}
