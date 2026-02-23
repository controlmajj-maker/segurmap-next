import { Pool } from "pg";
import { NextResponse } from "next/server";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const result = await pool.query("SELECT NOW()");
    return NextResponse.json({ time: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: "Database connection failed" },
      { status: 500 }
    );
  }
}
