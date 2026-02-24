import { NextResponse } from "next/server";
import pool from "../../../lib/db";

export async function DELETE() {
  try {
    // Delete in order to respect foreign keys
    await pool.query("DELETE FROM findings");
    await pool.query("DELETE FROM inspections");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
