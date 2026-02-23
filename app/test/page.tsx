"use client";

export default function TestPage() {

  async function createFinding() {
    const res = await fetch("/api/findings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inspectionId: "69b515f0-8b7d-4851-b6b5-306c01124ee5",
        zoneId: null,
        itemLabel: "Extintor bloqueado",
        description: "El extintor está obstruido por material almacenado",
        severity: "Alta",
        photoUrl: null,
        aiAnalysis: "Riesgo de no acceso en caso de emergencia"
      }),
    });

    const data = await res.json();
    alert(JSON.stringify(data));
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Test Crear Finding</h1>
      <button onClick={createFinding}>
        Crear Finding
      </button>
    </div>
  );
}
