import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      inspectionId,
      zoneId,
      itemLabel,
      description,
      severity,
      photoUrl,
      aiAnalysis,
    } = body;

    const id = uuidv4();

    await pool.query(
      `INSERT INTO findings
      (id, inspection_id, zone_id, item_label, description, severity, photo_url, ai_analysis)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, inspectionId, zoneId, itemLabel, description, severity, photoUrl, aiAnalysis]
    );

    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating finding" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT * FROM findings ORDER BY created_at DESC`
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching findings" },
      { status: 500 }
    );
  }
}
