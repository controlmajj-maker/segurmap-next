"use client";
import { useState } from "react";

export default function DiagnosticoPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testZones] = useState([
    { id: "z1", name: "TEST Almacén", status: "PENDING", x: 5, y: 5, width: 38, height: 42, findings: {} },
    { id: "z2", name: "TEST Producción", status: "PENDING", x: 48, y: 5, width: 47, height: 42, findings: {} },
  ]);

  async function runDiagnostic() {
    setLoading(true);
    try {
      const res = await fetch("/api/debug-db");
      const data = await res.json();
      setResult({ type: "GET /api/debug-db", ...data });
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  async function testWrite() {
    setLoading(true);
    try {
      // Write via config API
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones_config: JSON.stringify(testZones) }),
      });
      const data = await res.json();
      setResult({ type: "PUT /api/config", status: res.status, response: data });
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  async function testRead() {
    setLoading(true);
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setResult({ type: "GET /api/config", status: res.status, response: data });
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  async function testDirectWrite() {
    setLoading(true);
    try {
      const res = await fetch("/api/debug-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: testZones }),
      });
      const data = await res.json();
      setResult({ type: "POST /api/debug-db (direct write)", status: res.status, response: data });
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>🔍 Diagnóstico DB — Zonas Config</h1>
      
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={runDiagnostic} disabled={loading}
          style={{ padding: "8px 16px", background: "#1e293b", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {loading ? "..." : "1. Ver estado de DB"}
        </button>
        <button onClick={testWrite} disabled={loading}
          style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {loading ? "..." : "2. Escribir zonas TEST via /api/config"}
        </button>
        <button onClick={testRead} disabled={loading}
          style={{ padding: "8px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {loading ? "..." : "3. Leer /api/config"}
        </button>
        <button onClick={testDirectWrite} disabled={loading}
          style={{ padding: "8px 16px", background: "#9333ea", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {loading ? "..." : "4. Escribir directo en DB"}
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
        Flujo de prueba: <strong>1 → 2 → 3</strong> (debe mostrar las zonas TEST). Luego recarga la página principal y verifica si aparecen.
      </p>

      {result && (
        <pre style={{
          background: "#0f172a", color: "#94a3b8", padding: 16, borderRadius: 8,
          overflow: "auto", fontSize: 11, maxHeight: 600, whiteSpace: "pre-wrap",
          wordBreak: "break-all"
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
