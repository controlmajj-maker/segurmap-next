import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, location, inspector } = body;

    const id = uuidv4();

    await pool.query(
      `INSERT INTO inspections (id, title, location, inspector)
       VALUES ($1, $2, $3, $4)`,
      [id, title, location, inspector]
    );

    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating inspection" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT * FROM inspections ORDER BY created_at DESC`
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching inspections" },
      { status: 500 }
    );
  }
}
