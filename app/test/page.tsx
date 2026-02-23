"use client";

import { useState } from "react";

export default function TestPage() {
  const [file, setFile] = useState<File | null>(null);

  async function createFindingWithPhoto() {
    if (!file) return alert("Selecciona una imagen");

    // 1️⃣ Subir imagen
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const uploadData = await uploadRes.json();
    const photoUrl = uploadData.url;

    // 2️⃣ Crear finding con la URL
    const findingRes = await fetch("/api/findings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inspectionId: "69b515f0-8b7d-4851-b6b5-306c01124ee5",
        zoneId: null,
        itemLabel: "Cable expuesto",
        description: "Cable sin canalización adecuada",
        severity: "Media",
        photoUrl: photoUrl,
        aiAnalysis: "Riesgo eléctrico potencial"
      }),
    });

    const findingData = await findingRes.json();

    alert(JSON.stringify({
      findingId: findingData.id,
      photoUrl: photoUrl
    }));
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Test Finding con Imagen</h1>

      <input
        type="file"
        onChange={(e) => {
          if (e.target.files) setFile(e.target.files[0]);
        }}
      />

      <button onClick={createFindingWithPhoto}>
        Crear Finding con Imagen
      </button>
    </div>
  );
}
