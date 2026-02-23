"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [inspector, setInspector] = useState("");

  const [findingTitle, setFindingTitle] = useState("");
  const [findingDescription, setFindingDescription] = useState("");
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
    const res = await fetch(`/api/findings?inspection_id=${id}`);
    const data = await res.json();
    setFindings(data);
  }

  async function createInspection() {
    await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, inspector }),
    });

    setTitle("");
    setLocation("");
    setInspector("");
    loadInspections();
  }

async function createFinding() {
  if (!selectedInspection) return;

  let photo_url = null;

  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const uploadData = await uploadRes.json();
    photo_url = uploadData.url;
  }

  await fetch("/api/findings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inspection_id: selectedInspection.id,
      item_label: findingTitle,
      description: findingDescription,
      photo_url,
    }),
  });

  setFindingTitle("");
  setFindingDescription("");
  setFile(null);

  loadFindings(selectedInspection.id);
}




  

  return (
    <div style={{ padding: 40 }}>
      <h1>SegurMap 🚀</h1>

      <h2>Nueva Inspección</h2>
      <input
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <br />
      <input
        placeholder="Ubicación"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <br />
      <input
        placeholder="Inspector"
        value={inspector}
        onChange={(e) => setInspector(e.target.value)}
      />
      <br />
      <button onClick={createInspection}>Crear Inspección</button>

      <hr />

      <h2>Inspecciones</h2>
      {inspections.map((insp) => (
        <div key={insp.id} style={{ marginBottom: 10 }}>
          <strong>{insp.title}</strong> - {insp.location}
          <button
            onClick={() => {
              setSelectedInspection(insp);
              loadFindings(insp.id);
            }}
            style={{ marginLeft: 10 }}
          >
            Abrir
          </button>
        </div>
      ))}

      {selectedInspection && (
        <>
          <hr />
          <h2>Hallazgos de {selectedInspection.title}</h2>

          <input
            placeholder="Título hallazgo"
            value={findingTitle}
            onChange={(e) => setFindingTitle(e.target.value)}
          />
          <br />
          <textarea
            placeholder="Descripción"
            value={findingDescription}
            onChange={(e) => setFindingDescription(e.target.value)}
          />
          <br />
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <br />
          <button onClick={createFinding}>Guardar Hallazgo</button>

          <hr />

          {findings.map((f) => (
            <div key={f.id} style={{ marginBottom: 20 }}>
              <strong>{f.title}</strong>
              <p>{f.description}</p>
              {f.evidence_url && (
                <img src={f.evidence_url} width="200" />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
