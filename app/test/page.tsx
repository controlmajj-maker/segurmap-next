"use client";

export default function TestPage() {
  async function createInspection() {
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Inspección Planta Querétaro",
        location: "Área Producción",
        inspector: "Juanjo",
      }),
    });

    const data = await res.json();
    alert(JSON.stringify(data));
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Test Crear Inspección</h1>
      <button onClick={createInspection}>
        Crear Inspección
      </button>
    </div>
  );
}
