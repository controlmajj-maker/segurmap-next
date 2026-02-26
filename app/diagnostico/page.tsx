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
    try {
      const data = await fn();
      setResult({ step: label, ...data });
    } catch (e: any) {
      setResult({ step: label, error: e.message });
    }
    setLoading(false);
  };

  const steps = [
    {
      label: "1. Estado de DB",
      color: "#1e293b",
      fn: async () => {
        const res = await fetch("/api/debug-db");
        return res.json();
      }
    },
    {
      label: "2. Escribir via /api/config (PUT)",
      color: "#2563eb",
      fn: async () => {
        const res = await fetch("/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zones_config: JSON.stringify(TEST_ZONES) }),
        });
        const text = await res.text();
        try { return { http_status: res.status, response: JSON.parse(text) }; }
        catch { return { http_status: res.status, raw_response: text.substring(0, 500), parse_error: "Not valid JSON" }; }
      }
    },
    {
      label: "3. Leer /api/config (GET)",
      color: "#16a34a",
      fn: async () => {
        const res = await fetch("/api/config");
        const text = await res.text();
        try { return { http_status: res.status, response: JSON.parse(text) }; }
        catch { return { http_status: res.status, raw_response: text.substring(0, 500), parse_error: "Not valid JSON" }; }
      }
    },
    {
      label: "4. Escribir directo a DB (POST debug)",
      color: "#9333ea",
      fn: async () => {
        const res = await fetch("/api/debug-db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zones: TEST_ZONES }),
        });
        return res.json();
      }
    },
    {
      label: "5. Simular lógica config PUT (PATCH debug)",
      color: "#d97706",
      fn: async () => {
        const res = await fetch("/api/debug-db", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zones_config: JSON.stringify(TEST_ZONES) }),
        });
        return res.json();
      }
    },
    {
      label: "6. Verificar DB después de escribir",
      color: "#0891b2",
      fn: async () => {
        const res = await fetch("/api/debug-db");
        return res.json();
      }
    },
  ];

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>🔍 Diagnóstico Completo — Zonas Config</h1>
      <p style={{ fontSize: 11, color: "#64748b", marginBottom: 20 }}>
        Orden sugerido: 1 → 5 → 6 → 3. Si paso 5 funciona pero paso 2 falla, el problema es el deploy del config route.
      </p>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {steps.map(step => (
          <button key={step.label} onClick={() => run(step.label, step.fn)} disabled={loading}
            style={{ padding: "8px 14px", background: loading ? "#94a3b8" : step.color, color: "white", 
                     border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 12 }}>
            {loading ? "..." : step.label}
          </button>
        ))}
      </div>

      {result && (
        <pre style={{
          background: "#0f172a", color: "#94a3b8", padding: 16, borderRadius: 8,
          overflow: "auto", fontSize: 11, maxHeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-all"
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
