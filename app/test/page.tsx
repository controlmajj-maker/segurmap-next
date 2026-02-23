"use client";

import { useState } from "react";

export default function TestPage() {

  const [file, setFile] = useState<File | null>(null);

  async function uploadImage() {
    if (!file) return alert("Selecciona una imagen");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    alert(JSON.stringify(data));
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Test Upload Imagen</h1>

      <input
        type="file"
        onChange={(e) => {
          if (e.target.files) setFile(e.target.files[0]);
        }}
      />

      <button onClick={uploadImage}>
        Subir Imagen
      </button>
    </div>
  );
}
