import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function DELETE() {
  try {
    // Delete findings and inspections but preserve the config sentinel row
    await pool.query("DELETE FROM findings");
    await pool.query("DELETE FROM inspections WHERE title != '__app_config__'");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
