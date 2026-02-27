import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey });
}

// ─── POST /api/ai ─────────────────────────────────────────────────────────────
// Mode 1 — simple prompt (legacy):  { prompt: string }  → { text: string }
// Mode 2 — batch findings:          { mode:"findings", findings:[...] } → { results:[...] }
// Mode 3 — executive summary:       { mode:"summary",  context: string } → { text: string }

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ── Mode 1: legacy single prompt ──────────────────────────────────────────
    if (!body.mode || body.mode === "prompt") {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: body.prompt,
      });
      return NextResponse.json({ text: response.text });
    }

    // ── Mode 2: batch findings analysis ───────────────────────────────────────
    if (body.mode === "findings") {
      const findings: Array<{ id: string; zone_name: string; item_label: string; description: string }> =
        body.findings ?? [];
      if (findings.length === 0) return NextResponse.json({ results: [] });

      const ai = getClient();
      const results: Array<{ id: string; description_ai: string; recommendations: string }> = [];

      // Lotes de 20 para mantenernos dentro del límite de tokens
      const BATCH = 20;
      for (let i = 0; i < findings.length; i += BATCH) {
        const batch = findings.slice(i, i + BATCH);

        const findingsText = batch
          .map((f, idx) =>
            `[${idx + 1}] ID: ${f.id}\nZona: ${f.zone_name || "Sin zona"}\nHallazgo: ${f.item_label}\nDescripción original: ${f.description}`
          )
          .join("\n\n");

        const prompt = `Eres un experto en seguridad industrial en México (normativa NOM). Analiza los siguientes hallazgos y para CADA UNO genera:
1. "description_ai": Redacción técnica mejorada de la descripción original (máximo 2 oraciones en español, sin inventar información que no esté en la descripción original).
2. "recommendations": 2-3 recomendaciones técnicas concretas separadas por " | " (sin numeración ni bullets, en español, referenciando normativa NOM cuando aplique).

Responde ÚNICAMENTE con JSON válido sin markdown:
[
  { "id": "ID_HALLAZGO", "description_ai": "...", "recommendations": "..." }
]

Hallazgos:

${findingsText}`;

        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
          });
          let text = response.text?.trim() ?? "";
          // Limpiar fences de markdown si los hay
          text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) results.push(...parsed.filter((r: any) => r.id && r.description_ai));
        } catch {
          // Blindaje: si falla el lote, insertar vacíos para no bloquear el cierre
          for (const f of batch) results.push({ id: f.id, description_ai: "", recommendations: "" });
        }
      }
      return NextResponse.json({ results });
    }

    // ── Mode 3: executive summary ──────────────────────────────────────────────
    if (body.mode === "summary") {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: body.context,
      });
      return NextResponse.json({ text: response.text });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
