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
  const [view, setView] = useState<"current" | "history" | "active_issues" | "config">("current");
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
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [expandedInspectionId, setExpandedInspectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewInspectionModal, setShowNewInspectionModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [insRes, finRes, cfgRes] = await Promise.all([
        fetch("/api/inspections"),
        fetch("/api/findings"),
        fetch("/api/config"),
      ]);
      const insData: any[] = await insRes.json();
      const finData: Finding[] = await finRes.json();
      const cfgData: Record<string, string> = cfgRes.ok ? await cfgRes.json() : {};
      const inspList = Array.isArray(insData) ? insData : [];
      const finList = Array.isArray(finData) ? finData : [];
      setInspections(inspList);
      setAllFindings(finList);

      console.log("[loadData] cfgData keys:", Object.keys(cfgData), "zones_config len:", cfgData.zones_config?.length ?? 0);

      // Parse saved zones from config (used as fallback base)
      let configZones: Zone[] | null = null;
      if (cfgData.zones_config) {
        try {
          const parsed: Zone[] = JSON.parse(cfgData.zones_config);
          if (Array.isArray(parsed) && parsed.length > 0) {
            configZones = parsed;
          }
        } catch (e) { console.error("[loadData] parse error:", e); }
      }

      // Active inspection owns zones while running
      const activeInsp = inspList.find((i: any) => i.is_active === true);
      if (activeInsp) {
        setCurrentInspection(activeInsp);
        setIsInspectionActive(true);
        setZones(activeInsp.zones_data ?? (configZones ?? INITIAL_ZONES).map(z => ({ ...z, status: "PENDING" as ZoneStatus, findings: {} })));
      } else {
        setIsInspectionActive(false);
        setCurrentInspection(null);
        // Strategy: zones_config owns the layout (names, positions).
        // Last completed inspection owns the visual status (OK/ISSUE).
        // We merge both: base = zones_config, then overlay status from last inspection.
        const lastCompleted = inspList.find((i: any) => !i.is_active);
        const baseZones = configZones ?? (
          lastCompleted?.zones_data && Array.isArray(lastCompleted.zones_data) && lastCompleted.zones_data.length > 0
            ? lastCompleted.zones_data
            : null
        );
        if (baseZones) {
          if (lastCompleted?.zones_data && Array.isArray(lastCompleted.zones_data) && lastCompleted.zones_data.length > 0) {
            // Build a status map from the last inspection by zone name (name is stable, id may drift)
            const statusMap: Record<string, ZoneStatus> = {};
            for (const z of lastCompleted.zones_data as Zone[]) {
              statusMap[z.id]   = z.status;   // match by id first
              statusMap[z.name] = z.status;   // also index by name as fallback
            }
            // Overlay: keep config layout, apply last inspection status
            const merged = baseZones.map((z: Zone) => ({
              ...z,
              status: statusMap[z.id] ?? statusMap[z.name] ?? z.status,
            }));
            console.log("[loadData] merged zones_config layout + last inspection status");
            setZones(merged);
          } else {
            console.log("[loadData] restoring", baseZones.length, "config zones (no inspection status)");
            setZones(baseZones);
          }
        }
        // If neither, leave INITIAL_ZONES as-is
      }
    } catch (e) { console.error("[loadData] error:", e); }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  // ─── Persist config to DB ────────────────────────────────────────────────
  const saveConfig = useCallback(async (patch: Record<string, string | number>) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      console.log("[saveConfig] →", d);
    } catch (e) { console.error("[saveConfig] error:", e); }
  }, []);

  // ─── Zones change handler ───────────────────────────────────────────────
  // Synchronous state update + fire-and-forget DB save
  const handleZonesChange = useCallback((newZones: Zone[]) => {
    // 1. Update React state immediately (UI responds instantly)
    setZones(newZones);
    // 2. Build clean config version (PENDING status, no findings)
    const cleanZones = newZones.map(z => ({
      id: z.id,
      name: z.name,
      status: "PENDING" as ZoneStatus,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      findings: {},
    }));
    // 3. Persist to DB — fire and forget (async in background)
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zones_config: JSON.stringify(cleanZones) }),
    })
      .then(res => {
        if (!res.ok) return res.text().then(t => { throw new Error(`HTTP ${res.status}: ${t}`); });
        return res.json();
      })
      .then(d => console.log("[zones saved]", cleanZones.length, "zones, keys:", d?.keys))
      .catch(e => console.error("[zones save FAILED]", e.message));
  }, []);

  async function handleStartInspection(title: string, location: string, inspector: string) {
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, inspector }),
    });
    const newInsp: Inspection = await res.json();
    setCurrentInspection(newInsp);
    // Use current configured zones (from config/DB) as base, resetting status and findings
    const freshZones = zones.map(z => ({ ...z, status: "PENDING" as ZoneStatus, findings: {} }));
    setZones(freshZones);
    // Save initial zones_data to DB so other devices can see the active inspection
    await fetch("/api/inspections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: newInsp.id, zones_data: freshZones, is_active: true }),
    });
    setIsInspectionActive(true);
    setShowNewInspectionModal(false);
    const insRes = await fetch("/api/inspections");
    const insData = await insRes.json();
    setInspections(Array.isArray(insData) ? insData : []);
  }

  async function handleCancelInspection() {
    if (!currentInspection) {
      setIsInspectionActive(false);
      setCurrentInspection(null);
      setShowCancelConfirm(false);
      // Restore zones from config
      try {
        const cfgRes = await fetch("/api/config");
        const cfgData: Record<string, string> = cfgRes.ok ? await cfgRes.json() : {};
        if (cfgData.zones_config) {
          const saved: Zone[] = JSON.parse(cfgData.zones_config);
          if (Array.isArray(saved) && saved.length > 0) setZones(saved);
          else setZones(INITIAL_ZONES);
        } else setZones(INITIAL_ZONES);
      } catch { setZones(INITIAL_ZONES); }
      return;
    }
    // Delete from DB — no trace left in auditorías
    await fetch("/api/inspections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentInspection.id }),
    });
    setIsInspectionActive(false);
    setCurrentInspection(null);
    setShowCancelConfirm(false);
    // Reload everything — same merge logic as loadData
    const [insRes, finRes, cfgRes] = await Promise.all([
      fetch("/api/inspections"),
      fetch("/api/findings"),
      fetch("/api/config"),
    ]);
    const insData = await insRes.json();
    const finData = await finRes.json();
    const cfgData: Record<string, string> = cfgRes.ok ? await cfgRes.json() : {};
    const inspList = Array.isArray(insData) ? insData : [];
    setInspections(inspList);
    setAllFindings(Array.isArray(finData) ? finData : []);

    // Parse config zones (source of truth for layout)
    let configZones: Zone[] | null = null;
    if (cfgData.zones_config) {
      try {
        const parsed: Zone[] = JSON.parse(cfgData.zones_config);
        if (Array.isArray(parsed) && parsed.length > 0) configZones = parsed;
      } catch { /* fall through */ }
    }

    // Merge: layout from zones_config + status from last completed inspection
    const lastCompleted = inspList.find((i: any) => !i.is_active);
    const baseZones = configZones ?? (
      lastCompleted?.zones_data && Array.isArray(lastCompleted.zones_data) && lastCompleted.zones_data.length > 0
        ? lastCompleted.zones_data
        : null
    );
    if (baseZones) {
      if (lastCompleted?.zones_data && Array.isArray(lastCompleted.zones_data) && lastCompleted.zones_data.length > 0) {
        const statusMap: Record<string, ZoneStatus> = {};
        for (const z of lastCompleted.zones_data as Zone[]) {
          statusMap[z.id] = z.status;
          statusMap[z.name] = z.status;
        }
        setZones(baseZones.map((z: Zone) => ({
          ...z,
          status: statusMap[z.id] ?? statusMap[z.name] ?? z.status,
        })));
      } else {
        setZones(baseZones);
      }
    } else {
      setZones(INITIAL_ZONES);
    }
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

    const pendingZonesCount = zones.filter(z => z.status === "PENDING").length;
    let summary = `Inspección completada el ${new Date().toLocaleDateString()}. ${okZones.length} zona${okZones.length !== 1 ? "s" : ""} sin hallazgos, ${issueZones.length} con hallazgos que requieren atención${pendingZonesCount > 0 ? `, ${pendingZonesCount} sin evaluar` : ""}.`;

    if (findingsForSummary.length > 0) {
      try {
        const findingsList = findingsForSummary
          .map(f => `- [${f.zone_name || "Sin zona"}] ${f.item_label}: ${f.description}`)
          .join("\n");
        const zonesContext = pendingZonesCount > 0
          ? `\nZonas evaluadas: ${okZones.length + issueZones.length} de ${zones.length} (${pendingZonesCount} sin evaluar).`
          : `\nTodas las zonas fueron evaluadas (${zones.length} en total).`;
        const prompt = `Eres un experto en seguridad industrial. Genera un resumen ejecutivo breve (3-4 oraciones en español) de esta inspección de seguridad:\n${findingsList}${zonesContext}\nIncluye las áreas de mayor riesgo y recomendaciones generales.`;
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
      body: JSON.stringify({ id: currentInspection.id, summary, zones_data: zones, is_active: false }),
    });

    // Keep the zones with their final OK/ISSUE status visible on the map
    const finishedZones = [...zones];

    setIsInspectionActive(false);
    setCurrentInspection(null);
    setIsFinishing(false);

    // Full reload
    const [insRes, finRes] = await Promise.all([
      fetch("/api/inspections"),
      fetch("/api/findings"),
    ]);
    const insData = await insRes.json();
    const finData = await finRes.json();
    const inspList = Array.isArray(insData) ? insData : [];
    setInspections(inspList);
    setAllFindings(Array.isArray(finData) ? finData : []);
    // Show the just-completed inspection zones with their OK/ISSUE colors
    setZones(finishedZones);

    setView("current");
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
    // Reset zones_config in DB to initial zones
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zones_config: JSON.stringify(INITIAL_ZONES) }),
    }).catch(() => {});
  }

  async function handleDeleteInspection(id: string) {
    await fetch("/api/inspections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    // Reload inspections and findings
    const [insRes, finRes] = await Promise.all([
      fetch("/api/inspections"),
      fetch("/api/findings"),
    ]);
    const insData = await insRes.json();
    const finData = await finRes.json();
    setInspections(Array.isArray(insData) ? insData : []);
    setAllFindings(Array.isArray(finData) ? finData : []);
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
              <h1 className="text-base md:text-xl font-black tracking-tight text-slate-800 leading-none">Recorridos en planta MAQ</h1>
              <p className="text-[9px] uppercase font-black text-[#e30613] tracking-[0.2em]">Comisión de Seguridad</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden lg:flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[
                { key: "current", label: "Recorrido" },
                { key: "active_issues", label: `Resolución (${activeFindings.length})` },
                { key: "history", label: "Auditorías" },
                { key: "config", label: "Configuración" },
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
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around py-2 pb-4 z-50 shadow-lg">
        {[
          { key: "current", label: "Mapa", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
          { key: "active_issues", label: "Resolución", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
          { key: "history", label: "Historial", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
          { key: "config", label: "Config", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setView(key as any)}
            className={`relative flex flex-col items-center gap-1 px-3 py-1 transition-all ${
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
            <div className={`relative overflow-hidden rounded-3xl shadow-xl transition-all duration-700 ${
              isInspectionActive
                ? "bg-white border-2 border-blue-400"
                : "bg-white border border-slate-100"
            } p-4 md:p-8`}
              style={isInspectionActive ? {
                boxShadow: "0 0 0 3px rgba(59,130,246,0.15), 0 20px 40px -8px rgba(59,130,246,0.12)"
              } : {}}>

              {/* Pulso sutil en esquina superior derecha solo durante inspección activa */}
              {isInspectionActive && (
                <div className="absolute top-4 right-4 pointer-events-none">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                  </span>
                </div>
              )}

              <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  {/* Pill de estado */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 ${
                    isInspectionActive
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isInspectionActive ? "bg-blue-500 animate-pulse" : "bg-slate-400"}`} />
                    {isInspectionActive ? "EN PROGRESO" : "ÚLTIMO RECORRIDO"}
                  </div>

                  <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${isInspectionActive ? "text-slate-800" : "text-slate-800"}`}>
                    {isInspectionActive ? "Inspección Activa" : "Estado actual de la planta"}
                  </h2>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isInspectionActive ? "text-slate-400" : "text-slate-400"}`}>
                    {isInspectionActive
                      ? `${zones.filter(z => z.status !== "PENDING").length} de ${zones.length} zona${zones.length !== 1 ? "s" : ""} evaluada${zones.filter(z => z.status !== "PENDING").length !== 1 ? "s" : ""}`
                      : lastInspection
                        ? `${new Date(lastInspection.created_at).toLocaleDateString()} · ${lastInspection.inspector}`
                        : "Sin inspecciones previas"}
                  </p>
                </div>
                {!isInspectionActive ? (
                  <button
                    onClick={() => setShowNewInspectionModal(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    NUEVA INSPECCIÓN
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="bg-red-500/10 text-red-400 border border-red-500/30 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500/20 transition-all"
                  >
                    CANCELAR RECORRIDO
                  </button>
                )}
              </div>

              {/* ── Dashboard mini — solo cuando no hay inspección activa ── */}
              {!isInspectionActive && (() => {
                const lastCompleted = inspections.find((i: any) => !i.is_active);
                const totalAuditorias = inspections.filter((i: any) => !i.is_active).length;
                const totalHallazgos = allFindings.length;

                // % evaluación de última inspección
                let pct = 0;
                let evalLabel = "Sin datos";
                if (lastCompleted?.zones_data && Array.isArray(lastCompleted.zones_data) && lastCompleted.zones_data.length > 0) {
                  const total = lastCompleted.zones_data.length;
                  const evaluated = (lastCompleted.zones_data as Zone[]).filter(z => z.status !== "PENDING").length;
                  pct = total > 0 ? Math.round((evaluated / total) * 100) : 0;
                  evalLabel = `${evaluated}/${total} zonas`;
                }

                if (totalAuditorias === 0) return null;

                // SVG arc para el gauge circular
                const r = 28;
                const cx = 36;
                const cy = 36;
                const circumference = 2 * Math.PI * r;
                const dashOffset = circumference * (1 - pct / 100);
                const gaugeColor = pct === 100 ? "#16a34a" : pct >= 50 ? "#2563eb" : "#f97316";

                const totalResueltos = allFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                const totalAbiertos = totalHallazgos - totalResueltos;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {/* Gauge evaluación */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center justify-center col-span-2 md:col-span-1">
                      <svg width="72" height="72" viewBox="0 0 72 72">
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
                        <circle
                          cx={cx} cy={cy} r={r}
                          fill="none"
                          stroke={gaugeColor}
                          strokeWidth="7"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          transform={`rotate(-90 ${cx} ${cy})`}
                          style={{ transition: "stroke-dashoffset 0.6s ease" }}
                        />
                        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                          fontSize="13" fontWeight="900" fill="#1e293b">{pct}%</text>
                      </svg>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center leading-tight">
                        Evaluación<br/>
                        <span className="text-slate-600">{evalLabel}</span>
                      </p>
                    </div>

                    {/* Total auditorías */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center justify-center text-center">
                      <p className="text-3xl font-black text-slate-800 leading-none">{totalAuditorias}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-tight">
                        Auditorías<br/>totales
                      </p>
                    </div>

                    {/* Total hallazgos abiertos */}
                    <div className={`rounded-2xl border shadow-sm p-3 flex flex-col items-center justify-center text-center ${totalAbiertos > 0 ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`}>
                      <p className={`text-3xl font-black leading-none ${totalAbiertos > 0 ? "text-red-600" : "text-slate-800"}`}>{totalAbiertos}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-tight">
                        Hallazgos<br/>abiertos
                      </p>
                    </div>

                    {/* Total hallazgos resueltos */}
                    <div className={`rounded-2xl border shadow-sm p-3 flex flex-col items-center justify-center text-center ${totalResueltos > 0 ? "bg-green-50 border-green-100" : "bg-white border-slate-100"}`}>
                      <p className={`text-3xl font-black leading-none ${totalResueltos > 0 ? "text-green-600" : "text-slate-800"}`}>{totalResueltos}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-tight">
                        Hallazgos<br/>resueltos
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Lista vertical de zonas ── */}
              <div className="space-y-2">
                {zones.map((zone, idx) => {
                  const isOK    = zone.status === "OK";
                  const isISSUE = zone.status === "ISSUE";
                  const isPENDING = zone.status === "PENDING";
                  const isClickable = isInspectionActive;

                  // Colores y estilos por estado
                  const dotClass    = isOK ? "bg-green-400" : isISSUE ? "bg-red-500" : isInspectionActive ? "bg-slate-400" : "bg-slate-300";
                  const dotAnim     = isISSUE ? "animate-pulse" : "";
                  const badgeClass  = isOK    ? "bg-green-500/10 text-green-600 border-green-200" :
                                      isISSUE ? "bg-red-500/10 text-red-600 border-red-200" :
                                                "bg-slate-100 text-slate-400 border-slate-200";
                  const rowClass    = isInspectionActive
                    ? isOK    ? "bg-green-50/40 border-green-200 hover:border-green-400 hover:bg-green-50/70"
                    : isISSUE ? "bg-red-50/40 border-red-200 hover:border-red-400 hover:bg-red-50/70"
                    :           "bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                    : isOK    ? "bg-green-50/40 border-green-100"
                    : isISSUE ? "bg-red-50/40 border-red-100"
                    :           "bg-white border-slate-100";
                  const nameClass   = isInspectionActive ? "text-slate-800" : "text-slate-800";
                  const arrowClass  = isInspectionActive ? "text-slate-300" : "text-slate-200";

                  return (
                    <button
                      key={zone.id}
                      disabled={!isClickable}
                      onClick={() => isClickable && setSelectedZone(zone)}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 text-left
                        ${rowClass}
                        ${isClickable ? "cursor-pointer active:scale-[0.98] hover:shadow-md" : "cursor-default"}
                        shadow-sm`}
                    >
                      {/* Indicador circular de estado */}
                      <span className="relative shrink-0 flex items-center justify-center w-8 h-8">
                        <span className={`w-3 h-3 rounded-full ${dotClass} ${dotAnim}`} />
                        {isISSUE && (
                          <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" style={{animationDuration:"2s"}} />
                        )}
                        {isOK && isInspectionActive && (
                          <span className="absolute inset-0 rounded-full bg-green-400/10" />
                        )}
                      </span>

                      {/* Nombre de la zona */}
                      <span className={`flex-1 font-black text-sm md:text-base tracking-tight ${nameClass}`}>
                        {zone.name}
                      </span>

                      {/* Hallazgos registrados en esta zona */}
                      {isISSUE && Object.keys(zone.findings || {}).length > 0 && (
                        <span className="text-[9px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                          ⚠ {Object.keys(zone.findings).length}
                        </span>
                      )}

                      {/* Etiqueta de estado */}
                      <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${badgeClass}`}>
                        {isOK ? "✓ OK" : isISSUE ? "ISSUE" : "PENDIENTE"}
                      </span>

                      {/* Flecha — solo durante inspección */}
                      {isClickable && (
                        <svg className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${arrowClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const evaluatedZones = zones.filter(z => z.status !== "PENDING").length;
              const totalZones = zones.length;
              const allDone = pendingZones === 0;
              if (!isInspectionActive || evaluatedZones === 0) return null;
              return (
                <div className={`p-6 md:p-8 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl border-b-4 ${allDone ? "bg-slate-900 border-blue-600" : "bg-slate-800 border-orange-500"}`}>
                  <div>
                    <h3 className={`text-xl md:text-2xl font-black mb-1 ${allDone ? "text-blue-400" : "text-orange-400"}`}>
                      {allDone ? "Listo para finalizar recorrido" : "Listo para finalizar recorrido"}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {allDone
                        ? "Todas las zonas evaluadas. Puedes finalizar la evaluación."
                        : `${evaluatedZones} de ${totalZones} zona${totalZones !== 1 ? "s" : ""} evaluada${evaluatedZones !== 1 ? "s" : ""}. Puedes finalizar ahora o continuar el recorrido.`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFinishConfirm(true)}
                    disabled={isFinishing}
                    className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl flex items-center justify-center gap-3"
                  >
                    {isFinishing
                      ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> GENERANDO CON IA...</>
                      : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> FINALIZAR EVALUACIÓN</>
                    }
                  </button>
                </div>
              );
            })()}

            {/* ── STATS + ÚLTIMA INSPECCIÓN EN PANTALLA PRINCIPAL ── */}
            {!isInspectionActive && (() => {
              const lastCompleted = inspections.find((i: any) => !i.is_active);
              if (!lastCompleted) return null;
              const inspFindings = allFindings.filter(f => f.inspection_id === lastCompleted.id);
              const closedCount = inspFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
              const openCount = inspFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true").length;
              const lastZonesData: Zone[] = Array.isArray(lastCompleted.zones_data) ? lastCompleted.zones_data : [];
              const zonesEvaluated = lastZonesData.length > 0
                ? lastZonesData.filter((z: Zone) => z.status !== "PENDING").length
                : zones.filter(z => z.status !== "PENDING").length;
              const totalZones = lastZonesData.length > 0 ? lastZonesData.length : zones.length;
              const issueZonesCount = lastZonesData.length > 0
                ? lastZonesData.filter((z: Zone) => z.status === "ISSUE").length
                : zones.filter(z => z.status === "ISSUE").length;
              return (
                <>
                {/* Stats bar */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{zonesEvaluated}<span className="text-slate-300">/{totalZones}</span></p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Zonas Evaluadas</p>
                  </div>
                  <div className={`rounded-2xl border shadow-sm p-4 flex flex-col items-center justify-center text-center ${openCount > 0 ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`}>
                    <p className={`text-2xl md:text-3xl font-black ${openCount > 0 ? "text-red-600" : "text-slate-800"}`}>{inspFindings.length}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Hallazgos Totales</p>
                  </div>
                  <div className={`rounded-2xl border shadow-sm p-4 flex flex-col items-center justify-center text-center ${openCount > 0 ? "bg-orange-50 border-orange-100" : "bg-green-50 border-green-100"}`}>
                    <p className={`text-2xl md:text-3xl font-black ${openCount > 0 ? "text-orange-600" : "text-green-600"}`}>{openCount > 0 ? openCount : closedCount}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{openCount > 0 ? <>Pendientes<br/>de Cierre</> : <>Hallazgos<br/>Resueltos</>}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-900 w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white shrink-0">
                        <span className="text-[9px] font-black uppercase opacity-50">
                          {new Date(lastCompleted.created_at).toLocaleString("default", { month: "short" })}
                        </span>
                        <span className="text-lg font-black leading-none">{new Date(lastCompleted.created_at).getDate()}</span>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Última Inspección</p>
                        <h3 className="font-black text-slate-800 text-base">{lastCompleted.title}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase">{lastCompleted.inspector} · {lastCompleted.location}</p>
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
                    </div>
                  </div>

                  <div className="px-4 md:px-6 pb-6 pt-4 space-y-4">
                    {lastCompleted.summary && (
                      <div className="bg-slate-900 rounded-2xl p-5 text-white">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">🤖 Resumen Ejecutivo IA</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{lastCompleted.summary}</p>
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
                              onClick={() => setViewFinding(f)}
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
                </div>
                </>
              );
            })()}
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

            {inspections.filter((i: any) => !i.is_active).length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-black uppercase text-sm">Sin registros previos</p>
              </div>
            ) : (
              inspections.filter((i: any) => !i.is_active).map(insp => {
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

        {/* ── CONFIG VIEW ── */}
        {view === "config" && (
          <ConfigPage
            inspectionCount={inspections.length}
            findingCount={allFindings.length}
            zones={zones}
            inspections={inspections}
            allFindings={allFindings}
            onZonesChange={handleZonesChange}
            onDeleteAll={handleDeleteAll}
            onDeleteInspection={handleDeleteInspection}
          />
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

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-red-100 overflow-hidden">
            <div className="p-6 bg-red-50 border-b text-center">
              <p className="text-3xl mb-2">⚠️</p>
              <h3 className="text-xl font-black text-slate-800">¿Cancelar recorrido?</h3>
              <p className="text-slate-500 text-sm mt-1">Se eliminará la inspección en curso y todos sus hallazgos. Esta acción no se puede deshacer.</p>
            </div>
            <div className="p-6 flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-600 hover:bg-slate-50 transition-all"
              >
                CONTINUAR RECORRIDO
              </button>
              <button
                onClick={handleCancelInspection}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 transition-all shadow-lg"
              >
                SÍ, CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar finalizar evaluación ── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-blue-100 overflow-hidden">
            <div className="p-6 bg-blue-50 border-b text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-800">¿Finalizar evaluación?</h3>
              <p className="text-slate-500 text-sm mt-1">
                {pendingZones > 0
                  ? `Aún tienes ${pendingZones} zona${pendingZones !== 1 ? "s" : ""} sin evaluar. Puedes finalizar ahora o continuar el recorrido.`
                  : "Todas las zonas han sido evaluadas. Se generará el informe con IA."}
              </p>
            </div>
            <div className="p-6 flex gap-3">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-600 hover:bg-slate-50 transition-all"
              >
                CONTINUAR RECORRIDO
              </button>
              <button
                onClick={() => { setShowFinishConfirm(false); handleFinishInspection(); }}
                disabled={isFinishing}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase hover:bg-blue-700 transition-all shadow-lg disabled:bg-slate-300"
              >
                FINALIZAR
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Footer banner ── */}
      <footer
        className="w-full py-1.5 md:py-2 flex items-center justify-center"
        style={{ backgroundColor: "#E40521" }}
      >
        <p className="text-white text-[9px] md:text-[10px] font-medium tracking-wide opacity-90">
          Desarrollado por Juan José Amil
        </p>
      </footer>
    </div>
  );
}

// ZoneMap eliminado — reemplazado por lista vertical en la vista principal.
// Las zonas en ConfigPage usan su propio canvas inline.

// ─── New Inspection Modal ─────────────────────────────────────────────────────
function NewInspectionModal({ onConfirm, onClose }: {
  onConfirm: (title: string, location: string, inspector: string) => void;
  onClose: () => void;
}) {
  // Title auto-generated from current date — no form fields needed
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  // Capitalize first letter
  const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const autoTitle = `Recorrido ${formattedDate}`;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-slate-100 overflow-hidden">
        <div className="p-6 bg-blue-50 border-b text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-slate-800">Nueva Inspección</h3>
          <p className="text-slate-500 text-sm mt-1">Se iniciará el recorrido con la fecha actual</p>
        </div>
        <div className="p-6">
          <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Título del reporte</p>
            <p className="text-sm font-black text-slate-800 leading-snug">{autoTitle}</p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 transition-all">CANCELAR</button>
          <button
            onClick={() => onConfirm(autoTitle, "Planta Principal", "Comisión de Seguridad")}
            className="flex-1 py-3 rounded-xl font-black text-xs uppercase text-white bg-blue-600 hover:bg-blue-700 shadow-lg transition-all"
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

  const hasAnyFail = Object.values(results).some(v => v === false) || Object.keys(findings).some(k => k.startsWith("manual_"));

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

          {/* ── Instrucción general ── */}
          <div className="mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Si no existe ningún hallazgo en esta zona simplemente da clic en el botón{" "}
              <span className="font-black text-slate-800">Validar Zona</span> para continuar.
              En caso contrario, sube las evidencias y comentarios correspondientes.
            </p>
          </div>

          {/* ── Agregar hallazgo ── */}
          <div className="mb-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Hallazgo detectado
            </p>
            <button
              onClick={() => setItemToReport({ id: `manual_${Date.now()}`, label: `Hallazgo en ${zone.name}` })}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all font-black text-xs uppercase tracking-widest"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Agregar hallazgo
            </button>

            {/* Hallazgos manuales registrados en esta sesión */}
            {Object.entries(findings)
              .filter(([key]) => key.startsWith("manual_"))
              .map(([key, f]) => (
                <div key={key} className="mt-2 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <span className="text-red-500 text-sm">⚠</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{f.item_label}</p>
                    <p className="text-[9px] text-slate-500 italic truncate">"{f.description}"</p>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...findings };
                      delete updated[key];
                      setFindings(updated);
                    }}
                    className="shrink-0 w-5 h-5 bg-red-100 text-red-500 rounded-md text-[10px] flex items-center justify-center hover:bg-red-200 font-black"
                  >✕</button>
                </div>
              ))
            }
          </div>

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
              : "VALIDAR ZONA"}
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
            const key = itemToReport.id;
            // Solo marcar resultado como false si es un ítem del checklist NOM (no manual)
            if (!key.startsWith("manual_")) {
              setResults(prev => ({ ...prev, [key]: false }));
            }
            setFindings(prev => ({ ...prev, [key]: { ...finding, id: `local_${Date.now()}`, created_at: new Date().toISOString() } as Finding }));
            setItemToReport(null);
          }}
          onClear={() => {
            const key = itemToReport.id;
            if (!key.startsWith("manual_")) {
              setResults(prev => ({ ...prev, [key]: true }));
            }
            const updated = { ...findings };
            delete updated[key];
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




// ─── Config Page ──────────────────────────────────────────────────────────────
// IMPORTANT: No local zones state here. Zones live ONLY in parent.
// All changes go directly through onZonesChange → handleZonesChange → DB.
function ConfigPage({
  inspectionCount, findingCount, zones,
  onZonesChange, onDeleteAll, inspections, allFindings, onDeleteInspection,
}: {
  inspectionCount: number;
  findingCount: number;
  zones: Zone[];
  onZonesChange: (zones: Zone[]) => void;
  onDeleteAll: () => Promise<void>;
  inspections: Inspection[];
  allFindings: Finding[];
  onDeleteInspection: (id: string) => Promise<void>;
}) {
  const [newZoneName, setNewZoneName] = useState("");
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [deleteWord, setDeleteWord] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [histDeleteWord, setHistDeleteWord] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingZones, setIsSavingZones] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<"idle"|"saving"|"ok"|"error">("idle");
  const [inspToDelete, setInspToDelete] = useState<Inspection | null>(null);
  const [inspDeleteWord, setInspDeleteWord] = useState("");
  const [isDeletingInsp, setIsDeletingInsp] = useState(false);

  const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null;

  const handleConfirmDeleteInspection = async () => {
    if (!inspToDelete || inspDeleteWord !== "BORRAR") return;
    setIsDeletingInsp(true);
    await onDeleteInspection(inspToDelete.id);
    setIsDeletingInsp(false);
    setInspToDelete(null);
    setInspDeleteWord("");
  };

  // All zone mutations go through this single function
  const commitZones = async (updated: Zone[]) => {
    setIsSavingZones(true);
    setLastSaveStatus("saving");
    try {
      onZonesChange(updated); // updates parent state immediately
      setLastSaveStatus("ok");
      setTimeout(() => setLastSaveStatus("idle"), 2000);
    } catch {
      setLastSaveStatus("error");
    } finally {
      setIsSavingZones(false);
    }
  };

  const handleAddZone = async () => {
    if (!newZoneName.trim()) return;
    const newZone: Zone = {
      id: `z${Date.now()}`,
      name: newZoneName.trim(),
      status: "PENDING",
      x: 10, y: 10, width: 25, height: 25,
      findings: {},
    };
    const updated = [...zones, newZone];
    setNewZoneName("");
    setSelectedZoneId(newZone.id);
    await commitZones(updated);
  };

  const handleSaveZoneName = async (zoneId: string) => {
    if (!editingZoneName.trim()) return;
    const updated = zones.map(z => z.id === zoneId ? { ...z, name: editingZoneName.trim() } : z);
    setEditingZoneId(null);
    setEditingZoneName("");
    await commitZones(updated);
  };

  const handleConfirmDeleteZone = async () => {
    if (!zoneToDelete || deleteWord !== "BORRAR") return;
    const updated = zones.filter(z => z.id !== zoneToDelete.id);
    if (selectedZoneId === zoneToDelete.id) setSelectedZoneId(null);
    setZoneToDelete(null);
    setDeleteWord("");
    await commitZones(updated);
  };

  const handleConfirmDeleteHistory = async () => {
    if (histDeleteWord !== "BORRAR") return;
    setIsDeleting(true);
    await onDeleteAll();
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    setHistDeleteWord("");
  };



  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Configuración</h2>
        {lastSaveStatus === "saving" && (
          <span className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1">
            <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"/>
            Guardando...
          </span>
        )}
        {lastSaveStatus === "ok" && (
          <span className="text-[10px] font-black text-green-600 uppercase">✓ Guardado</span>
        )}
        {lastSaveStatus === "error" && (
          <span className="text-[10px] font-black text-red-600 uppercase">✕ Error al guardar</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-3xl font-black text-slate-800">{inspectionCount}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Auditorías</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-3xl font-black text-slate-800">{findingCount}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Hallazgos</p>
        </div>
      </div>

      {/* ── Zonas de Inspección ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-sm">Zonas de Inspección</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Crear · renombrar · eliminar</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddZone()}
              placeholder="Nombre de nueva zona..."
              className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 outline-none transition-all" />
            <button onClick={handleAddZone} disabled={!newZoneName.trim() || isSavingZones}
              className={`px-3 py-2 rounded-xl font-black text-xs uppercase transition-all ${newZoneName.trim() && !isSavingZones ? "bg-slate-900 text-white hover:bg-black shadow" : "bg-slate-100 text-slate-300"}`}>
              + ADD
            </button>
          </div>

          <div className="space-y-1.5">
            {zones.map(zone => {
              const isSelected = selectedZoneId === zone.id;
              const isEditing = editingZoneId === zone.id;
              return (
                <div key={zone.id} className={`border-2 rounded-xl overflow-hidden ${isSelected ? "border-orange-300" : "border-slate-100"}`}>
                  <div
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer ${isSelected ? "bg-orange-50" : "hover:bg-slate-50"}`}
                    onClick={() => !isEditing && setSelectedZoneId(isSelected ? null : zone.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${zone.status === "OK" ? "bg-green-500" : zone.status === "ISSUE" ? "bg-red-500" : "bg-slate-300"}`} />
                      {isEditing ? (
                        <input autoFocus value={editingZoneName}
                          onChange={e => setEditingZoneName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleSaveZoneName(zone.id); if (e.key === "Escape") setEditingZoneId(null); }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 px-2 py-0.5 text-xs font-black bg-white border-2 border-blue-400 rounded-lg outline-none min-w-0" />
                      ) : (
                        <span className="font-black text-slate-800 text-xs truncate">{zone.name}</span>
                      )}
                      <span className="text-[7px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-black uppercase shrink-0">{zone.status}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {isEditing ? (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleSaveZoneName(zone.id); }}
                            className="px-2 h-6 bg-green-600 text-white rounded-md font-black text-[8px] hover:bg-green-700">✓</button>
                          <button onClick={e => { e.stopPropagation(); setEditingZoneId(null); }}
                            className="px-2 h-6 bg-slate-200 text-slate-600 rounded-md font-black text-[8px]">✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={e => { e.stopPropagation(); setEditingZoneId(zone.id); setEditingZoneName(zone.name); }}
                            className="w-6 h-6 bg-blue-50 text-blue-500 rounded-md flex items-center justify-center hover:bg-blue-100" title="Renombrar">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); setZoneToDelete(zone); setDeleteWord(""); }}
                            className="w-6 h-6 bg-red-50 text-red-500 rounded-md flex items-center justify-center text-[10px] hover:bg-red-100 font-black">✕</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Eliminar Historial ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">⚠️</div>
          <div>
            <h3 className="font-black text-slate-800 text-sm">Eliminar Historial Completo</h3>
            <p className="text-[9px] text-red-400 font-bold uppercase">Acción irreversible</p>
          </div>
        </div>
        <div className="p-4">
          <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-wide mb-2">
              Se eliminarán todas las auditorías realizadas, junto con hallazgos e imágenes registradas.
            </p>
            <p className="text-[10px] text-slate-500 mb-3">Esta acción no se puede deshacer.</p>
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-lg">
              🗑 BORRAR TODO EL HISTORIAL
            </button>
          </div>
        </div>
      </div>

      {/* ── Auditorías Registradas ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-sm">Auditorías Registradas</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Eliminar auditorías individuales</p>
          </div>
        </div>
        <div className="p-4">
          {inspections.filter((i: any) => !i.is_active).length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-4 font-bold uppercase">Sin auditorías registradas</p>
          ) : (
            <div className="space-y-2">
              {inspections.filter((i: any) => !i.is_active).map(insp => {
                const inspFindings = allFindings.filter(f => f.inspection_id === insp.id);
                const openCount = inspFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true").length;
                const closedCount = inspFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                return (
                  <div key={insp.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    {/* Fecha */}
                    <div className="bg-slate-800 rounded-lg px-2 py-1 text-center shrink-0 min-w-[36px]">
                      <p className="text-[7px] font-black text-slate-400 uppercase leading-none">
                        {new Date(insp.created_at).toLocaleString("default", { month: "short" })}
                      </p>
                      <p className="text-sm font-black text-white leading-tight">{new Date(insp.created_at).getDate()}</p>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-xs truncate">{insp.title}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{insp.inspector} · {insp.location}</p>
                    </div>
                    {/* Badges */}
                    <div className="flex items-center gap-1 shrink-0">
                      {openCount > 0 && (
                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">{openCount} ab.</span>
                      )}
                      {closedCount > 0 && (
                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">{closedCount} ok</span>
                      )}
                      {inspFindings.length === 0 && (
                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">sin hall.</span>
                      )}
                    </div>
                    {/* Botón eliminar */}
                    <button
                      onClick={() => { setInspToDelete(insp); setInspDeleteWord(""); }}
                      className="shrink-0 w-7 h-7 bg-red-50 text-red-500 border border-red-100 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all"
                      title="Eliminar esta auditoría"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmar borrar auditoría individual */}
      {inspToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-red-200 overflow-hidden">
            <div className="p-6 bg-red-600 text-white text-center">
              <p className="text-4xl mb-2">🗑</p>
              <h3 className="text-xl font-black">¿Eliminar auditoría?</h3>
              <p className="text-red-100 text-sm mt-1 font-bold truncate px-4">"{inspToDelete.title}"</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 text-center">
                Se eliminarán todos los hallazgos e imágenes asociados a esta auditoría.
              </p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Escribe <span className="text-red-600 font-black">BORRAR</span> para confirmar
                </label>
                <input
                  value={inspDeleteWord}
                  onChange={e => setInspDeleteWord(e.target.value)}
                  placeholder="BORRAR"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-lg tracking-widest focus:border-red-400 outline-none"
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => { setInspToDelete(null); setInspDeleteWord(""); }}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500"
              >CANCELAR</button>
              <button
                disabled={inspDeleteWord !== "BORRAR" || isDeletingInsp}
                onClick={handleConfirmDeleteInspection}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white ${inspDeleteWord === "BORRAR" && !isDeletingInsp ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}
              >
                {isDeletingInsp ? "ELIMINANDO..." : "ELIMINAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal borrar zona */}
      {zoneToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-red-200 overflow-hidden">
            <div className="p-6 bg-red-600 text-white text-center">
              <p className="text-4xl mb-2">⚠️</p>
              <h3 className="text-xl font-black">¿Eliminar zona?</h3>
              <p className="text-red-100 text-sm mt-1 font-bold">"{zoneToDelete.name}"</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Escribe <span className="text-red-600 font-black">BORRAR</span> para confirmar
                </label>
                <input value={deleteWord} onChange={e => setDeleteWord(e.target.value)} placeholder="BORRAR"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-lg tracking-widest focus:border-red-400 outline-none" />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => { setZoneToDelete(null); setDeleteWord(""); }}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
              <button disabled={deleteWord !== "BORRAR"} onClick={handleConfirmDeleteZone}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white ${deleteWord === "BORRAR" ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}>
                ELIMINAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal borrar historial */}
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
                Se eliminarán <strong>{inspectionCount} auditorías</strong> y <strong>{findingCount} hallazgos</strong>.
              </p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Escribe <span className="text-red-600 font-black">BORRAR</span> para confirmar
                </label>
                <input value={histDeleteWord} onChange={e => setHistDeleteWord(e.target.value)} placeholder="BORRAR"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-lg tracking-widest focus:border-red-400 outline-none" />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setHistDeleteWord(""); }}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
              <button disabled={histDeleteWord !== "BORRAR" || isDeleting} onClick={handleConfirmDeleteHistory}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white ${histDeleteWord === "BORRAR" && !isDeleting ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}>
                {isDeleting ? "BORRANDO..." : "CONFIRMAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
