"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [findingTitle, setFindingTitle] = useState("");
  const [findingDesc, setFindingDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadInspections();
  }, []);

  async function loadInspections() {
    const res = await fetch("/api/inspections");
    const data = await res.json();
    setInspections(data);
  }

  async function loadFindings(id: string) {
    const res = await fetch(`/api/findings?inspectionId=${id}`);
    const data = await res.json();
    setFindings(data);
  }

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

    setTitle("");
    loadInspections();
  }

  async function createFinding() {
    let imageUrl = null;

    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      imageUrl = uploadData.url;
    }

    await fetch("/api/findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inspectionId: selectedInspection.id,
        title: findingTitle,
        description: findingDesc,
        evidenceUrl: imageUrl,
      }),
    });

    setFindingTitle("");
    setFindingDesc("");
    setFile(null);

    loadFindings(selectedInspection.id);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>SegurMap 🚀</h1>

      <h2>Nueva Inspección</h2>
      <input
        placeholder="Título inspección"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button onClick={createInspection}>Crear</button>

      <hr />

      <h2>Inspecciones</h2>

      {inspections.map((i) => (
        <div key={i.id} style={{ marginBottom: 10 }}>
          <strong>{i.title}</strong>
          <button
            style={{ marginLeft: 10 }}
            onClick={() => {
              setSelectedInspection(i);
              loadFindings(i.id);
            }}
          >
            Abrir
          </button>
        </div>
      ))}

      {selectedInspection && (
        <>
          <hr />
          <h2>Findings de: {selectedInspection.title}</h2>

          <input
            placeholder="Título hallazgo"
            value={findingTitle}
            onChange={(e) => setFindingTitle(e.target.value)}
          />
          <input
            placeholder="Descripción"
            value={findingDesc}
            onChange={(e) => setFindingDesc(e.target.value)}
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button onClick={createFinding}>
            Guardar Finding
          </button>

          <hr />

          {findings.map((f) => (
            <div key={f.id} style={{ marginBottom: 20 }}>
              <h4>{f.title}</h4>
              <p>{f.description}</p>
              {f.evidence_url && (
                <img
                  src={f.evidence_url}
                  width={200}
                />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
