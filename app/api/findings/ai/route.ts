import { NextResponse } from "next/server";
import pool from "../../../../lib/db";

export async function PATCH(req: Request) {
  try {
    const { id, ai_analysis } = await req.json();
    const result = await pool.query(
      "UPDATE findings SET ai_analysis = $1 WHERE id = $2 RETURNING *",
      [ai_analysis, id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
