"use client";
import { useState } from "react";

const TEST_ZONES = [
  { id: "z1", name: "TEST Almacén", status: "PENDING", x: 5, y: 5, width: 38, height: 42, findings: {} },
  { id: "z2", name: "TEST Producción", status: "PENDING", x: 48, y: 5, width: 47, height: 42, findings: {} },
  { id: "z3", name: "TEST Nueva Zona", status: "PENDING", x: 5, y: 52, width: 38, height: 42, findings: {} },
];

export default function DiagnosticoPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (label: string, fn: () => Promise<any>) => {
    setLoading(true);
    try { setResult({ step: label, ...(await fn()) }); }
    catch (e: any) { setResult({ step: label, caught_error: e.message }); }
    setLoading(false);
  };

  const steps = [
    { label: "1. Estado DB", color: "#1e293b", fn: async () => {
      const res = await fetch("/api/debug-db");
      return res.json();
    }},
    { label: "2. PUT /api/config", color: "#dc2626", fn: async () => {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones_config: JSON.stringify(TEST_ZONES) }),
      });
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { http_status: res.status, raw_text: text.substring(0, 300), parsed_json: parsed };
    }},
    { label: "3. GET /api/config", color: "#16a34a", fn: async () => {
      const res = await fetch("/api/config");
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { http_status: res.status, raw_text: text.substring(0, 300), parsed_json: parsed };
    }},
    { label: "4. POST debug (directo DB)", color: "#9333ea", fn: async () => {
      const res = await fetch("/api/debug-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: TEST_ZONES }),
      });
      return res.json();
    }},
    { label: "5. PATCH debug (simula config PUT)", color: "#d97706", fn: async () => {
      const res = await fetch("/api/debug-db", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones_config: JSON.stringify(TEST_ZONES) }),
      });
      return res.json();
    }},
    { label: "6. Verificar DB", color: "#0891b2", fn: async () => {
      const res = await fetch("/api/debug-db");
      return res.json();
    }},
  ];

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>🔍 Diagnóstico</h1>
      <p style={{ fontSize: 11, color: "#64748b", marginBottom: 20 }}>
        Corre: <b>2 → 3</b>. Si paso 2 tiene <code>raw_text</code> vacío o raro, el config_route no está actualizado en Vercel.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {steps.map(s => (
          <button key={s.label} onClick={() => run(s.label, s.fn)} disabled={loading}
            style={{ padding: "8px 14px", background: loading ? "#94a3b8" : s.color,
                     color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
            {s.label}
          </button>
        ))}
      </div>
      {result && (
        <pre style={{ background: "#0f172a", color: "#94a3b8", padding: 16, borderRadius: 8,
          overflow: "auto", fontSize: 11, maxHeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
