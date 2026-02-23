"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetch("/api/inspections")
      .then(res => res.json())
      .then(data => setInspections(data));
  }, []);

  async function createInspection() {
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        location: "Planta",
        inspector: "Juanjo"
      }),
    });

    const newInspection = await res.json();
    setInspections([newInspection, ...inspections]);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>SegurMap Next 🚀</h1>

      <input
        placeholder="Título inspección"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button onClick={createInspection}>
        Crear
      </button>

      <hr />

      {inspections.map((i) => (
        <div key={i.id}>
          <h3>{i.title}</h3>
          <p>{i.location}</p>
        </div>
      ))}
    </div>
  );
}
