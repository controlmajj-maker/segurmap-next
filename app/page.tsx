"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type ZoneStatus = "PENDING" | "OK" | "ISSUE";
type Severity = "low" | "medium" | "high";

interface ChecklistItem { id: string; label: string; }
interface ChecklistGroup { id: string; title: string; items: ChecklistItem[]; }

interface Finding {
  id: string;
  inspection_id: string;
  zone_id?: string;
  zone_name?: string;
  item_id?: string;
  item_label: string;
  description: string;
  photo_url?: string;
  severity: Severity;
  ai_analysis?: string;
  is_closed: boolean;
  corrective_actions?: string;
  closed_at?: string;
  created_at: string;
}

interface Zone {
  id: string;
  name: string;
  status: ZoneStatus;
  x: number; y: number; width: number; height: number;
  checklistResults?: Record<string, boolean>;
  findings: Record<string, Finding>;
}

interface Inspection {
  id: string;
  title: string;
  location: string;
  inspector: string;
  summary?: string;
  zones_data?: Zone[];
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SAFETY_CHECKLIST: ChecklistGroup[] = [
  { id: "nom-001", title: "NOM-001: Condiciones del lugar", items: [
    { id: "c1", label: "Edificios e instalaciones libres de daños estructurales" },
    { id: "c2", label: "Pasillos y salidas libres de obstrucciones" },
    { id: "c3", label: "Iluminación suficiente" },
    { id: "c4", label: "Pisos en buen estado (sin derrames, hoyos, desniveles)" },
    { id: "c5", label: "Señalización clara y visible" },
    { id: "c6", label: "Orden y limpieza general" },
  ]},
  { id: "nom-002", title: "NOM-002: Protección contra incendios", items: [
    { id: "f1", label: "Extintores vigentes, señalizados, visibles y de fácil acceso" },
    { id: "f2", label: "Rutas de evacuación y salidas de emergencia despejadas" },
    { id: "f3", label: "Sistema de alarma accesible y sin obstrucciones" },
    { id: "f4", label: "Botiquín disponible y completo" },
  ]},
  { id: "nom-004", title: "NOM-004/006/029: Maquinaria y Equipos", items: [
    { id: "m1", label: "Guardas y protecciones instaladas en máquinas" },
    { id: "m2", label: "Mantenimiento visible y vigente" },
    { id: "m3", label: "Equipos de manejo de cargas verificados" },
    { id: "m4", label: "Herramientas adecuadas para la tarea" },
    { id: "m5", label: "Riesgos eléctricos controlados (tableros etiquetados)" },
    { id: "m6", label: "Instalaciones eléctricas en buen estado" },
  ]},
  { id: "nom-017", title: "NOM-017: Equipo de Protección Personal", items: [
    { id: "p1", label: "Uso adecuado de EPP de acuerdo al área" },
    { id: "p2", label: "EPP disponible y en buen estado" },
    { id: "p3", label: "Señalización de EPP obligatorio" },
  ]},
  { id: "nom-026", title: "NOM-026: Señalización y Colores", items: [
    { id: "s1", label: "Señales visibles de acuerdo a colores estandarizados" },
    { id: "s2", label: "Tubería indica claramente nombre y dirección del fluido" },
  ]},
  { id: "otros", title: "Otros", items: [
    { id: "o1", label: "Observaciones adicionales de seguridad" },
  ]},
];

const INITIAL_ZONES: Zone[] = [
  { id: "z1", name: "Almacén",      status: "PENDING", x: 5,  y: 5,  width: 38, height: 42, findings: {} },
  { id: "z2", name: "Producción",   status: "PENDING", x: 48, y: 5,  width: 47, height: 42, findings: {} },
  { id: "z3", name: "Mantenimiento",status: "PENDING", x: 5,  y: 52, width: 38, height: 42, findings: {} },
  { id: "z4", name: "Oficinas",     status: "PENDING", x: 48, y: 52, width: 47, height: 42, findings: {} },
];

// ─── AI Analysis via Gemini ───────────────────────────────────────────────────
async function getAIAnalysis(itemLabel: string, description: string, zoneName: string): Promise<string> {
  try {
    const prompt = `Eres un experto en seguridad industrial. Analiza este hallazgo de seguridad y proporciona una recomendación breve de acción correctiva (máximo 2 oraciones en español):
Zona: ${zoneName}
Hallazgo: ${itemLabel}
Descripción: ${description}
Responde solo con la recomendación, sin preámbulo.`;

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.text || "";
  } catch {
    return "";
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SegurMapApp() {
  const [view, setView] = useState<"current" | "history" | "active_issues">("current");
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [allFindings, setAllFindings] = useState<Finding[]>([]);
  const [isInspectionActive, setIsInspectionActive] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<Inspection | null>(null);
  const [zones, setZones] = useState<Zone[]>(INITIAL_ZONES);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [closureTarget, setClosureTarget] = useState<Finding | null>(null);
  const [viewFinding, setViewFinding] = useState<Finding | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [expandedInspectionId, setExpandedInspectionId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [showNewInspectionModal, setShowNewInspectionModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [insRes, finRes] = await Promise.all([
        fetch("/api/inspections"),
        fetch("/api/findings"),
      ]);
      const insData: Inspection[] = await insRes.json();
      const finData: Finding[] = await finRes.json();
      const inspList = Array.isArray(insData) ? insData : [];
      const finList = Array.isArray(finData) ? finData : [];
      setInspections(inspList);
      setAllFindings(finList);
      // Only restore zones if no active inspection (avoids overwriting in-progress zones)
      if (!isInspectionActive && inspList.length > 0 && inspList[0].zones_data) {
        setZones(inspList[0].zones_data);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, [isInspectionActive]);

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function handleStartInspection(title: string, location: string, inspector: string) {
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, inspector }),
    });
    const newInsp: Inspection = await res.json();
    setCurrentInspection(newInsp);
    const freshZones = INITIAL_ZONES.map(z => ({ ...z, status: "PENDING" as ZoneStatus, findings: {} }));
    setZones(freshZones);
    setIsInspectionActive(true);
    setShowNewInspectionModal(false);
    // Reload inspections list but preserve zones
    const insRes = await fetch("/api/inspections");
    const insData = await insRes.json();
    setInspections(Array.isArray(insData) ? insData : []);
  }

  async function handleZoneSave(
    zoneId: string,
    zoneName: string,
    status: ZoneStatus,
    checklistResults: Record<string, boolean>,
    newFindings: Record<string, Finding>
  ) {
    // 1. Update zones state immediately (before any async calls)
    const updatedZones = zones.map(z =>
      z.id === zoneId ? { ...z, status, checklistResults, findings: newFindings } : z
    );
    setZones(updatedZones);

    // 2. Save each new finding to DB
    for (const [, finding] of Object.entries(newFindings)) {
      if (!finding.id.startsWith("local_")) continue;
      await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: currentInspection!.id,
          zone_id: zoneId,
          zone_name: zoneName,
          item_label: finding.item_label,
          description: finding.description,
          severity: finding.severity,
          photo_url: finding.photo_url || null,
          ai_analysis: finding.ai_analysis || null,
        }),
      });
    }

    // 3. Persist zone colors to DB (without touching zones state again)
    await fetch("/api/inspections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentInspection!.id, zones_data: updatedZones }),
    });

    // 4. Reload only findings (not zones, to avoid overwriting state)
    const finRes = await fetch("/api/findings");
    const finData = await finRes.json();
    setAllFindings(Array.isArray(finData) ? finData : []);
  }

  async function handleFinishInspection() {
    if (!currentInspection) return;
    setIsFinishing(true);

    // Generate AI summary
    const issueZones = zones.filter(z => z.status === "ISSUE");
    const okZones = zones.filter(z => z.status === "OK");
    const findingsForSummary = allFindings.filter(f => f.inspection_id === currentInspection.id);

    let summary = `Inspección completada el ${new Date().toLocaleDateString()}. ${okZones.length} zonas sin hallazgos. ${issueZones.length} zonas con hallazgos que requieren atención.`;

    if (findingsForSummary.length > 0) {
      try {
        const findingsList = findingsForSummary
          .map(f => `- [${f.zone_name || "Sin zona"}] ${f.item_label}: ${f.description}`)
          .join("\n");
        const prompt = `Eres un experto en seguridad industrial. Genera un resumen ejecutivo breve (3-4 oraciones en español) de esta inspección de seguridad:\n${findingsList}\nIncluye las áreas de mayor riesgo y recomendaciones generales.`;
        const aiRes = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.text) summary = aiData.text;
        }
      } catch { /* keep default summary */ }
    }

    await fetch("/api/inspections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentInspection.id, summary, zones_data: zones }),
    });

    setIsInspectionActive(false);
    setCurrentInspection(null);
    setIsFinishing(false);

    // Full reload now that inspection is done
    const [insRes, finRes] = await Promise.all([
      fetch("/api/inspections"),
      fetch("/api/findings"),
    ]);
    const insData = await insRes.json();
    const finData = await finRes.json();
    const inspList = Array.isArray(insData) ? insData : [];
    setInspections(inspList);
    setAllFindings(Array.isArray(finData) ? finData : []);
    if (inspList.length > 0 && inspList[0].zones_data) setZones(inspList[0].zones_data);

    setView("history");
  }

  async function handleCloseFinding(findingId: string, correctiveActions: string) {
    await fetch("/api/findings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: findingId, corrective_actions: correctiveActions }),
    });
    setClosureTarget(null);
    const finRes = await fetch("/api/findings");
    const finData = await finRes.json();
    setAllFindings(Array.isArray(finData) ? finData : []);
  }

  async function handleDeleteAll() {
    await fetch("/api/admin", { method: "DELETE" });
    setInspections([]);
    setAllFindings([]);
    setZones(INITIAL_ZONES);
    setIsInspectionActive(false);
    setCurrentInspection(null);
    setShowConfig(false);
  }

  // Safe boolean check — Postgres returns actual booleans but just in case
  const activeFindings = allFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true");
  const closedFindings = allFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true");
  const pendingZones = zones.filter(z => z.status === "PENDING").length;
  const lastInspection = inspections.length > 0 ? inspections[0] : null;

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Cargando SegurMap...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 lg:pb-0">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 md:px-8 py-3 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <img src="/logo.png" alt="Logo MAQ" className="h-10 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-base md:text-xl font-black tracking-tight text-slate-800 leading-none">SegurMap MAQ</h1>
              <p className="text-[9px] uppercase font-black text-[#e30613] tracking-[0.2em]">Comisión Seguridad</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden lg:flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[
                { key: "current", label: "Recorrido" },
                { key: "active_issues", label: `Resolución (${activeFindings.length})` },
                { key: "history", label: "Auditorías" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setView(key as any)}
                  className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    view === key
                      ? key === "active_issues" && activeFindings.length > 0
                        ? "bg-white shadow text-red-600"
                        : "bg-white shadow text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isEditMode ? "bg-orange-500 text-white shadow-lg" : "bg-slate-100 border text-slate-400"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <button
              onClick={() => setShowConfig(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-slate-100 border text-slate-400 hover:bg-slate-200"
              title="Configuración"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around py-2 pb-4 z-50 shadow-lg">
        {[
          { key: "current", label: "Mapa", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
          { key: "active_issues", label: "Resolución", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
          { key: "history", label: "Historial", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setView(key as any)}
            className={`relative flex flex-col items-center gap-1 px-4 py-1 transition-all ${
              view === key
                ? key === "active_issues" ? "text-red-600" : "text-blue-600"
                : "text-slate-400"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
            </svg>
            <span className="text-[9px] font-black uppercase">{label}</span>
            {key === "active_issues" && activeFindings.length > 0 && (
              <span className="absolute -top-1 right-2 bg-red-600 text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-black">
                {activeFindings.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">

        {/* ── CURRENT VIEW ── */}
        {view === "current" && (
          <div className="space-y-6">
            {isEditMode && (
              <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔧</span>
                  <div>
                    <p className="font-black text-orange-900 uppercase text-xs tracking-widest">Editor de Planta</p>
                    <p className="text-orange-700 text-[10px]">Carga tu plano y ajusta zonas</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { const r = new FileReader(); r.onload = () => setBackgroundImage(r.result as string); r.readAsDataURL(f); }
                    }}
                  />
                  <button onClick={() => bgInputRef.current?.click()}
                    className="bg-white px-4 py-2 rounded-xl text-xs font-black uppercase text-orange-600 border border-orange-200 shadow-sm">
                    Cargar Plano
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white p-4 md:p-8 rounded-3xl shadow-xl border border-slate-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                    {isInspectionActive ? "Inspección Activa" : "Estado del Sitio"}
                  </h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                    {isInspectionActive
                      ? `${pendingZones} áreas pendientes`
                      : lastInspection
                        ? `${new Date(lastInspection.created_at).toLocaleDateString()} · ${lastInspection.inspector}`
                        : "Sin inspecciones previas"}
                  </p>
                </div>
                {!isInspectionActive ? (
                  <button
                    onClick={() => setShowNewInspectionModal(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    NUEVA INSPECCIÓN
                  </button>
                ) : (
                  <button
                    onClick={() => setIsInspectionActive(false)}
                    className="bg-slate-100 text-slate-500 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest"
                  >
                    PAUSAR
                  </button>
                )}
              </div>

              <ZoneMap
                zones={zones}
                onZoneClick={z => isInspectionActive && setSelectedZone(z)}
                backgroundImage={backgroundImage}
                isDisabled={!isInspectionActive}
              />
            </div>

            {pendingZones === 0 && isInspectionActive && (
              <div className="bg-slate-900 p-6 md:p-10 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl border-b-4 border-blue-600">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-blue-400 mb-1">Recorrido Finalizado</h3>
                  <p className="text-slate-400 text-sm">Todas las zonas auditadas. Sella el informe.</p>
                </div>
                <button
                  onClick={handleFinishInspection}
                  disabled={isFinishing}
                  className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl flex items-center justify-center gap-3"
                >
                  {isFinishing
                    ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> GENERANDO CON IA...</>
                    : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> SELLAR INFORME</>
                  }
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE ISSUES VIEW ── */}
        {view === "active_issues" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">Hallazgos Abiertos</h2>
              <div className="flex gap-2">
                <span className="bg-red-100 text-red-600 px-4 py-1.5 rounded-full font-black text-xs uppercase">
                  {activeFindings.length} PENDIENTES
                </span>
                <span className="bg-green-100 text-green-600 px-4 py-1.5 rounded-full font-black text-xs uppercase">
                  {closedFindings.length} RESUELTOS
                </span>
              </div>
            </div>

            {activeFindings.length === 0 ? (
              <div className="py-24 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">¡Sin hallazgos activos!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {activeFindings.map(f => (
                  <div key={f.id} className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                    <div className="p-4 bg-red-50 border-b border-red-100">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${
                          f.severity === "high" ? "bg-red-600" : f.severity === "medium" ? "bg-orange-500" : "bg-yellow-500"
                        }`}>{f.severity === "high" ? "ALTA" : f.severity === "medium" ? "MEDIA" : "BAJA"}</span>
                        {f.zone_name && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-700 text-white">
                            📍 {f.zone_name}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 font-bold ml-auto">{new Date(f.created_at).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-black text-slate-800 text-sm leading-tight">{f.item_label}</h4>
                    </div>
                    {f.photo_url && (
                      <div className="cursor-zoom-in" onClick={() => setZoomImage(f.photo_url!)}>
                        <img src={f.photo_url} className="w-full h-36 object-cover border-b" alt="Evidencia" />
                      </div>
                    )}
                    <div className="p-4 flex-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Observación:</p>
                      <p className="text-xs text-slate-600 italic">"{f.description}"</p>
                      {f.ai_analysis && (
                        <div className="mt-3 bg-slate-800 rounded-lg p-2">
                          <p className="text-[8px] font-black text-blue-400 uppercase mb-0.5">Recomendación IA:</p>
                          <p className="text-[9px] text-slate-300 leading-relaxed">{f.ai_analysis}</p>
                        </div>
                      )}
                    </div>
                    <div className="p-4 pt-0">
                      <button
                        onClick={() => setClosureTarget(f)}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow hover:bg-green-700 transition-all"
                      >
                        EJECUTAR CIERRE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY VIEW ── */}
        {view === "history" && (
          <div className="space-y-4">
            <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">Historial de Auditorías</h2>

            {inspections.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-black uppercase text-sm">Sin registros previos</p>
              </div>
            ) : (
              inspections.map(insp => {
                const inspFindings = allFindings.filter(f => f.inspection_id === insp.id);
                const closedCount = inspFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                const openCount = inspFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true").length;
                const isExpanded = expandedInspectionId === insp.id;

                return (
                  <div key={insp.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div
                      className="p-4 md:p-6 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      onClick={() => setExpandedInspectionId(isExpanded ? null : insp.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-900 w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white shrink-0">
                          <span className="text-[9px] font-black uppercase opacity-50">
                            {new Date(insp.created_at).toLocaleString("default", { month: "short" })}
                          </span>
                          <span className="text-lg font-black leading-none">{new Date(insp.created_at).getDate()}</span>
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-base">{insp.title}</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase">{insp.inspector} · {insp.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {openCount > 0 && (
                          <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase">{openCount} ABIERTOS</span>
                        )}
                        {closedCount > 0 && (
                          <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[9px] font-black uppercase">{closedCount} CERRADOS</span>
                        )}
                        {inspFindings.length === 0 && (
                          <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase">SIN HALLAZGOS</span>
                        )}
                        <svg className={`w-4 h-4 text-slate-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 md:px-6 pb-6 border-t border-slate-50 pt-4 space-y-4">
                        {insp.summary && (
                          <div className="bg-slate-900 rounded-2xl p-5 text-white">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">🤖 Resumen Ejecutivo IA</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{insp.summary}</p>
                          </div>
                        )}

                        {inspFindings.length === 0 ? (
                          <p className="text-slate-400 text-sm text-center py-4">Sin hallazgos registrados</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {inspFindings.map(f => {
                              const isClosed = f.is_closed === true || (f as any).is_closed === "true";
                              return (
                                <div
                                  key={f.id}
                                  onClick={e => { e.stopPropagation(); setViewFinding(f); }}
                                  className={`rounded-xl border-2 cursor-pointer hover:scale-[1.01] transition-all overflow-hidden ${
                                    isClosed ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"
                                  }`}
                                >
                                  {f.photo_url && (
                                    <img src={f.photo_url} alt="Evidencia" className="w-full h-28 object-cover" />
                                  )}
                                  <div className="p-3">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full text-white ${isClosed ? "bg-green-600" : "bg-red-600"}`}>
                                        {isClosed ? "RESUELTO" : "PENDIENTE"}
                                      </span>
                                      {f.zone_name && (
                                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-700 text-white">
                                          📍 {f.zone_name}
                                        </span>
                                      )}
                                      <span className="text-[8px] text-slate-400 ml-auto">{new Date(f.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="font-black text-slate-800 text-xs truncate">{f.item_label}</p>
                                    <p className="text-slate-500 text-[10px] italic truncate">"{f.description}"</p>
                                    {isClosed && f.corrective_actions && (
                                      <p className="text-green-700 text-[9px] mt-1 font-bold truncate">✓ {f.corrective_actions}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* ── MODALS ── */}
      {showNewInspectionModal && (
        <NewInspectionModal
          onConfirm={handleStartInspection}
          onClose={() => setShowNewInspectionModal(false)}
        />
      )}

      {selectedZone && isInspectionActive && currentInspection && (
        <InspectionModal
          zone={selectedZone}
          inspectionId={currentInspection.id}
          onClose={() => setSelectedZone(null)}
          onSave={async (zoneId, zoneName, status, checklistResults, findings) => {
            await handleZoneSave(zoneId, zoneName, status, checklistResults, findings);
          }}
        />
      )}

      {closureTarget && (
        <ClosureModal
          finding={closureTarget}
          onClose={() => setClosureTarget(null)}
          onConfirm={handleCloseFinding}
        />
      )}

      {viewFinding && (
        <FindingViewModal
          finding={viewFinding}
          onClose={() => setViewFinding(null)}
          onImageZoom={setZoomImage}
        />
      )}

      {zoomImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center border border-white/20">✕</button>
          <img src={zoomImage} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="Evidencia Ampliada" />
        </div>
      )}

      {showConfig && (
        <ConfigModal
          onClose={() => setShowConfig(false)}
          onDeleteAll={handleDeleteAll}
          inspectionCount={inspections.length}
          findingCount={allFindings.length}
        />
      )}
    </div>
  );
}

// ─── Zone Map ─────────────────────────────────────────────────────────────────
function ZoneMap({ zones, onZoneClick, backgroundImage, isDisabled }: {
  zones: Zone[];
  onZoneClick: (z: Zone) => void;
  backgroundImage?: string;
  isDisabled: boolean;
}) {
  const getStyle = (status: ZoneStatus) => {
    if (status === "ISSUE") return "bg-red-500/50 border-red-600 text-red-900 border-2 animate-pulse";
    if (status === "OK") return "bg-green-500/40 border-green-600 text-green-900 border-2";
    return "bg-slate-200/70 border-slate-400 text-slate-700 hover:bg-blue-200/50 hover:border-blue-400";
  };

  return (
    <div className={`relative w-full aspect-video bg-slate-100 rounded-2xl border-4 border-slate-200 overflow-hidden shadow-inner ${isDisabled ? "opacity-75" : ""}`}>
      {backgroundImage ? (
        <img src={backgroundImage} className={`absolute inset-0 w-full h-full object-cover ${isDisabled ? "grayscale opacity-50" : ""}`} alt="Plano" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10">
          <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-xs font-black uppercase tracking-widest">Sin plano de planta</p>
        </div>
      )}

      {zones.map(zone => (
        <button
          key={zone.id}
          disabled={isDisabled}
          onClick={() => onZoneClick(zone)}
          className={`absolute border rounded-xl flex flex-col items-center justify-center text-center transition-all p-1 ${getStyle(zone.status)} ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}
        >
          <span className="text-[7px] md:text-[10px] font-black uppercase leading-tight">{zone.name}</span>
          {zone.status === "OK" && <span className="text-[8px] md:text-xs">✓</span>}
          {zone.status === "ISSUE" && <span className="text-[8px] md:text-xs">⚠</span>}
        </button>
      ))}

      <div className="hidden md:flex absolute bottom-3 right-3 bg-black/60 backdrop-blur px-3 py-1.5 rounded-xl text-[8px] text-white font-black gap-4 border border-white/20">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>PENDIENTE</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>OK</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"></span>HALLAZGO</span>
      </div>
    </div>
  );
}

// ─── New Inspection Modal ─────────────────────────────────────────────────────
function NewInspectionModal({ onConfirm, onClose }: {
  onConfirm: (title: string, location: string, inspector: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("Planta Principal");
  const [inspector, setInspector] = useState("Administrador de Seguridad");

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border-4 border-slate-100 overflow-hidden">
        <div className="p-6 bg-blue-50 border-b">
          <h3 className="text-xl font-black text-slate-800">Nueva Inspección</h3>
          <p className="text-slate-500 text-sm">Completa los datos para iniciar</p>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: "Título del Reporte", value: title, setter: setTitle, placeholder: "Ej: Recorrido Semanal Feb 2025" },
            { label: "Ubicación", value: location, setter: setLocation, placeholder: "Planta Principal" },
            { label: "Inspector", value: inspector, setter: setInspector, placeholder: "Nombre del inspector" },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</label>
              <input
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm font-medium transition-all"
              />
            </div>
          ))}
        </div>
        <div className="p-6 bg-slate-50 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
          <button
            disabled={!title.trim()}
            onClick={() => onConfirm(title, location, inspector)}
            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white transition-all ${!title.trim() ? "bg-slate-300" : "bg-blue-600 hover:bg-blue-700 shadow-lg"}`}
          >
            INICIAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inspection Modal ─────────────────────────────────────────────────────────
function InspectionModal({ zone, inspectionId, onClose, onSave }: {
  zone: Zone;
  inspectionId: string;
  onClose: () => void;
  onSave: (zoneId: string, zoneName: string, status: ZoneStatus, checklistResults: Record<string, boolean>, findings: Record<string, Finding>) => Promise<void>;
}) {
  const [results, setResults] = useState<Record<string, boolean>>(zone.checklistResults || {});
  const [findings, setFindings] = useState<Record<string, Finding>>(zone.findings || {});
  const [expandedGroup, setExpandedGroup] = useState<string | null>(SAFETY_CHECKLIST[0].id);
  const [itemToReport, setItemToReport] = useState<{ id: string; label: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (Object.keys(results).length === 0) {
      const initial: Record<string, boolean> = {};
      SAFETY_CHECKLIST.forEach(g => g.items.forEach(i => { initial[i.id] = true; }));
      setResults(initial);
    }
  }, []);

  const hasAnyFail = Object.values(results).some(v => v === false);

  const handleConfirm = async () => {
    setIsSaving(true);
    const status: ZoneStatus = hasAnyFail ? "ISSUE" : "OK";
    await onSave(zone.id, zone.name, status, results, findings);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-2 md:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border-4 border-slate-100">
        <div className="p-4 md:p-6 bg-slate-50 border-b flex justify-between items-center shrink-0">
          <div>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${hasAnyFail ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
              {hasAnyFail ? "Con Hallazgos" : "Sin Hallazgos"}
            </span>
            <h2 className="text-xl font-black text-slate-800 mt-1">{zone.name}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-white border rounded-xl flex items-center justify-center text-slate-400">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <div className="space-y-2">
            {SAFETY_CHECKLIST.map(group => (
              <div key={group.id} className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  className={`w-full p-3 md:p-4 flex items-center justify-between text-left transition-all ${expandedGroup === group.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"}`}
                >
                  <span className="font-bold text-xs md:text-sm flex items-center gap-2">
                    {group.title}
                    {group.items.some(i => results[i.id] === false) && (
                      <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center animate-pulse">!</span>
                    )}
                  </span>
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expandedGroup === group.id ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>

                {expandedGroup === group.id && (
                  <div className="p-2 space-y-1 bg-white">
                    {group.items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => setItemToReport(item)}
                        className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${results[item.id] === false ? "bg-red-50 border-red-200" : "border-transparent hover:bg-slate-50"}`}
                      >
                        <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border-2 transition-all ${results[item.id] === false ? "bg-red-600 border-red-600 text-white" : "border-slate-300"}`}>
                          {results[item.id] === false
                            ? <span className="text-[10px]">✕</span>
                            : <span className="text-[10px] text-slate-300">✓</span>}
                        </div>
                        <div>
                          <p className={`text-xs md:text-sm leading-tight ${results[item.id] === false ? "text-red-800 font-bold" : "text-slate-600"}`}>{item.label}</p>
                          {results[item.id] === false && findings[item.id] && (
                            <p className="text-[9px] text-red-500 font-bold mt-1">
                              📷 Evidencia registrada {findings[item.id].ai_analysis ? "· 🤖 IA lista" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6 bg-slate-50 border-t shrink-0">
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="w-full py-4 rounded-xl font-black text-sm text-white shadow-xl bg-slate-900 hover:bg-black transition-all flex items-center justify-center gap-2"
          >
            {isSaving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> GUARDANDO...</>
              : "CONFIRMAR ZONA"}
          </button>
        </div>
      </div>

      {itemToReport && (
        <FindingDetailModal
          item={itemToReport}
          zoneName={zone.name}
          inspectionId={inspectionId}
          existing={findings[itemToReport.id]}
          onSave={async (finding) => {
            setResults(prev => ({ ...prev, [itemToReport.id]: false }));
            setFindings(prev => ({ ...prev, [itemToReport.id]: { ...finding, id: `local_${Date.now()}`, created_at: new Date().toISOString() } as Finding }));
            setItemToReport(null);
          }}
          onClear={() => {
            setResults(prev => ({ ...prev, [itemToReport.id]: true }));
            const updated = { ...findings };
            delete updated[itemToReport.id];
            setFindings(updated);
            setItemToReport(null);
          }}
          onCancel={() => setItemToReport(null)}
        />
      )}
    </div>
  );
}

// ─── Finding Detail Modal ─────────────────────────────────────────────────────
function FindingDetailModal({ item, zoneName, inspectionId, existing, onSave, onClear, onCancel }: {
  item: { id: string; label: string };
  zoneName: string;
  inspectionId: string;
  existing?: Finding;
  onSave: (f: Omit<Finding, "id" | "created_at">) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(existing?.description || "");
  const [severity, setSeverity] = useState<Severity>(existing?.severity || "medium");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>(existing?.photo_url);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!description.trim()) return;
    setIsUploading(true);
    let photo_url = existing?.photo_url || null;

    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      photo_url = data.url;
    }

    // Save finding immediately without waiting for AI
    onSave({
      inspection_id: inspectionId,
      zone_name: zoneName,
      item_label: item.label,
      description,
      severity,
      photo_url: photo_url || undefined,
      ai_analysis: undefined,
      is_closed: false,
    });
    setIsUploading(false);

    // AI analysis runs in background (non-blocking)
    getAIAnalysis(item.label, description, zoneName).then(ai_analysis => {
      if (ai_analysis) console.log("AI analysis ready:", ai_analysis);
      // AI analysis will be saved on next zone confirm
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-red-50 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-red-50 border-b flex justify-between items-center shrink-0">
          <div>
            <span className="text-[9px] font-black uppercase text-red-600 bg-red-100 px-2 py-0.5 rounded">⚠ Reportar Hallazgo</span>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">📍 {zoneName}</p>
            <h3 className="text-sm font-black text-slate-800 mt-1 leading-tight">{item.label}</h3>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descripción del Hallazgo</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Cable expuesto sin canalización..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-red-400 outline-none text-sm resize-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Gravedad</label>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              {(["low", "medium", "high"] as Severity[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${severity === s ? "bg-red-600 text-white shadow" : "text-slate-400 hover:text-slate-600"}`}
                >
                  {s === "low" ? "Baja" : s === "medium" ? "Media" : "Alta"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Evidencia Fotográfica</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative aspect-video border-4 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center overflow-hidden hover:border-red-300 cursor-pointer transition-all"
            >
              {preview ? (
                <img src={preview} className="w-full h-full object-cover" alt="preview" />
              ) : (
                <div className="text-center">
                  <p className="text-3xl mb-1">📷</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase">Capturar / Subir Foto</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    const r = new FileReader();
                    r.onloadend = () => setPreview(r.result as string);
                    r.readAsDataURL(f);
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t flex flex-col gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={!description.trim() || isUploading}
            className={`w-full py-3 rounded-xl font-black text-sm text-white transition-all ${!description.trim() || isUploading ? "bg-slate-300" : "bg-slate-900 hover:bg-black shadow-lg"}`}
          >
            {isUploading ? "SUBIENDO FOTO..." : "GUARDAR EVIDENCIA"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClear} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-[9px] font-black uppercase text-slate-500">Borrar</button>
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-[9px] font-black uppercase text-slate-500">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Closure Modal ────────────────────────────────────────────────────────────
function ClosureModal({ finding, onClose, onConfirm }: {
  finding: Finding;
  onClose: () => void;
  onConfirm: (id: string, correctiveActions: string) => void;
}) {
  const [actions, setActions] = useState("");

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur flex items-center justify-center z-[120] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-green-50 overflow-hidden">
        <div className="p-6 bg-green-50 border-b">
          <span className="text-[9px] font-black uppercase text-green-600 bg-green-100 px-2 py-0.5 rounded">Protocolo de Cierre</span>
          {finding.zone_name && <p className="text-[9px] font-black text-slate-400 uppercase mt-1">📍 {finding.zone_name}</p>}
          <h3 className="text-xl font-black text-slate-800 mt-2">Cerrar Hallazgo</h3>
          <p className="text-slate-500 text-sm mt-1">{finding.item_label}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Hallazgo:</p>
            <p className="text-sm text-slate-700 italic">"{finding.description}"</p>
          </div>
          {finding.ai_analysis && (
            <div className="bg-slate-900 p-3 rounded-xl">
              <p className="text-[9px] font-black text-blue-400 uppercase mb-1">🤖 Recomendación IA:</p>
              <p className="text-xs text-slate-300">{finding.ai_analysis}</p>
            </div>
          )}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Acciones Correctivas (Obligatorio)</label>
            <textarea
              rows={4}
              value={actions}
              onChange={e => setActions(e.target.value)}
              placeholder="Describe cómo se solucionó el riesgo..."
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-green-500 outline-none text-sm resize-none transition-all"
            />
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-400">CANCELAR</button>
          <button
            disabled={!actions.trim()}
            onClick={() => onConfirm(finding.id, actions)}
            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white transition-all ${!actions.trim() ? "bg-slate-300" : "bg-green-600 hover:bg-green-700 shadow-lg"}`}
          >
            CERTIFICAR CIERRE
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Finding View Modal ───────────────────────────────────────────────────────
function FindingViewModal({ finding, onClose, onImageZoom }: {
  finding: Finding;
  onClose: () => void;
  onImageZoom?: (url: string) => void;
}) {
  const isClosed = finding.is_closed === true || (finding as any).is_closed === "true";
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-4 border-slate-100">
        <div className={`p-5 border-b flex justify-between items-start ${isClosed ? "bg-green-50" : "bg-red-50"}`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${isClosed ? "bg-green-600" : "bg-red-600"}`}>
                {isClosed ? "RESUELTO" : "PENDIENTE"}
              </span>
              {finding.zone_name && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-700 text-white">
                  📍 {finding.zone_name}
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-800 mt-2 leading-tight">{finding.item_label}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-slate-400 shrink-0">✕</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-slate-300">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Hallazgo:</p>
            <p className="text-sm text-slate-700 italic">"{finding.description}"</p>
          </div>

          {finding.photo_url && (
            <div className="cursor-zoom-in rounded-xl overflow-hidden border-4 border-slate-50 shadow" onClick={() => onImageZoom?.(finding.photo_url!)}>
              <img src={finding.photo_url} alt="Evidencia" className="w-full object-cover max-h-56" />
              <p className="text-center text-[8px] text-slate-400 py-1 bg-slate-50 font-black uppercase">Toca para ampliar</p>
            </div>
          )}

          {finding.ai_analysis && (
            <div className="bg-slate-900 p-4 rounded-xl text-white">
              <p className="text-[9px] font-black text-blue-400 uppercase mb-1">🤖 Análisis IA:</p>
              <p className="text-xs text-slate-300 leading-relaxed">{finding.ai_analysis}</p>
            </div>
          )}

          {isClosed && finding.corrective_actions && (
            <div className="bg-green-50 p-4 rounded-xl border-2 border-green-100">
              <p className="text-[9px] font-black text-green-600 uppercase mb-1">✅ Acciones Correctivas:</p>
              <p className="text-sm text-slate-700">{finding.corrective_actions}</p>
              {finding.closed_at && (
                <p className="text-[9px] text-slate-400 mt-2">Cerrado el {new Date(finding.closed_at).toLocaleDateString()}</p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t">
          <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase">CERRAR</button>
        </div>
      </div>
    </div>
  );
}

// ─── Config Modal ─────────────────────────────────────────────────────────────
function ConfigModal({ onClose, onDeleteAll, inspectionCount, findingCount }: {
  onClose: () => void;
  onDeleteAll: () => void;
  inspectionCount: number;
  findingCount: number;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (deleteWord !== "BORRAR") return;
    setIsDeleting(true);
    await onDeleteAll();
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border-4 border-slate-100 overflow-hidden">
        <div className="p-6 bg-slate-900 border-b flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-white">Configuración</h3>
            <p className="text-slate-400 text-xs uppercase font-bold tracking-widest mt-0.5">SegurMap MAQ</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-white/10 text-white rounded-xl flex items-center justify-center border border-white/20">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border text-center">
              <p className="text-3xl font-black text-slate-800">{inspectionCount}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auditorías</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border text-center">
              <p className="text-3xl font-black text-slate-800">{findingCount}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hallazgos</p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Danger zone */}
          <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">⚠ Zona Peligrosa</p>
            <p className="text-sm font-black text-slate-800 mb-1">Borrar todo el historial</p>
            <p className="text-[10px] text-slate-500 mb-3">Elimina permanentemente todas las auditorías, hallazgos y evidencias de la base de datos. Esta acción no se puede deshacer.</p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg"
            >
              🗑 BORRAR TODO EL HISTORIAL
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-red-200 overflow-hidden">
            <div className="p-6 bg-red-600 text-white text-center">
              <p className="text-4xl mb-2">⚠️</p>
              <h3 className="text-xl font-black">¿Borrar todo?</h3>
              <p className="text-red-100 text-xs mt-1">Esta acción es irreversible</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 text-center">
                Se eliminarán <strong>{inspectionCount} auditorías</strong> y <strong>{findingCount} hallazgos</strong> permanentemente.
              </p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Escribe <span className="text-red-600 font-black">BORRAR</span> para confirmar
                </label>
                <input
                  value={deleteWord}
                  onChange={e => setDeleteWord(e.target.value)}
                  placeholder="BORRAR"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-lg tracking-widest focus:border-red-400 outline-none transition-all"
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteWord(""); }}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50"
              >
                CANCELAR
              </button>
              <button
                disabled={deleteWord !== "BORRAR" || isDeleting}
                onClick={handleConfirmDelete}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white transition-all ${
                  deleteWord === "BORRAR" && !isDeleting
                    ? "bg-red-600 hover:bg-red-700 shadow-lg"
                    : "bg-slate-300"
                }`}
              >
                {isDeleting ? "BORRANDO..." : "CONFIRMAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
