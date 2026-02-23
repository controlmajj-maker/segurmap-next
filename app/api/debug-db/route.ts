import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const result = await pool.query(
      "SELECT current_database(), current_user, inet_server_addr();"
    );

    return NextResponse.json({
      success: true,
      info: result.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
