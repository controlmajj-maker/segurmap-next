import { NextResponse } from "next/server";
import pool from "../../../../lib/db";

// PATCH /api/findings/ai
// Actualiza el campo ai_analysis de un finding.
// Llamado al finalizar una inspección, después de que la IA procesa todos los hallazgos.
// Blindado: si falla, el hallazgo queda sin ai_analysis pero la inspección ya cerró.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ai_analysis } = body;

    if (!id || !ai_analysis) {
      return NextResponse.json({ error: "id y ai_analysis son requeridos" }, { status: 400 });
    }

    const result = await pool.query(
      "UPDATE findings SET ai_analysis = $1 WHERE id = $2 RETURNING id, ai_analysis",
      [ai_analysis, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Finding no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
