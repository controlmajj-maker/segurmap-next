"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ZoneStatus, Finding, Zone, Section, Inspection } from "../components/types";
import { SAFETY_CHECKLIST, INITIAL_ZONES } from "../components/constants";
import { CurrentView } from "../components/CurrentView";
import { FindingsView } from "../components/FindingsView";
import { HistoryView } from "../components/HistoryView";
import { ConfigPage } from "../components/ConfigPage";
import {
  NewInspectionModal,
  InspectionModal,
  FindingDetailModal,
  ClosureModal,
  FindingViewModal,
} from "../components/modals";

// ─── AI Analysis via Gemini ───────────────────────────────────────────────────
async function getAIAnalysis(itemLabel: string, description: string, zoneName: string): Promise<string> {
  try {
    const prompt = `Eres un experto en seguridad industrial. Analiza este hallazgo de seguridad y proporciona una recomendación breve de acción correctiva (máximo 2 oraciones en español):\nZona: ${zoneName}\nHallazgo: ${itemLabel}\nDescripción: ${description}\nResponde solo con la recomendación, sin preámbulo.`;

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
  const [isLoading, setIsLoading] = useState(true);
  const [showNewInspectionModal, setShowNewInspectionModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelPasswordError, setCancelPasswordError] = useState(false);
  // isOwner: true solo en el dispositivo que inició la inspección activa
  const [isOwner, setIsOwner] = useState(false);
  // Recuperación de ownership si se perdió el localStorage
  const [showRecoverOwnership, setShowRecoverOwnership] = useState(false);
  const [recoverPassword, setRecoverPassword] = useState("");
  const [recoverPasswordError, setRecoverPasswordError] = useState(false);
  const [showConfigAuth, setShowConfigAuth] = useState(false);
  const [configPassword, setConfigPassword] = useState("");
  const [configPasswordError, setConfigPasswordError] = useState(false);
  const [configUnlocked, setConfigUnlocked] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  // Estado de colapso para vista de hallazgos (vacío = todo expandido por default)
  const [findingsCollapsedKeys, setFindingsCollapsedKeys] = useState<Set<string>>(new Set());
  const toggleFindingKey = (key: string) => setFindingsCollapsedKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  // Estado de colapso para resumen ejecutivo (vacío = todo expandido por default)
  const [summaryCollapsedKeys, setSummaryCollapsedKeys] = useState<Set<string>>(new Set());
  const toggleSummaryKey = (key: string) => setSummaryCollapsedKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const saveSections = useCallback(async (updated: Section[]) => {
    setSections(updated);
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections_config: JSON.stringify(updated) }),
      });
    } catch (e) { console.error("[saveSections] error:", e); }
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

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

      // Load sections from DB
      if (cfgData.sections_config) {
        try {
          const parsedSections: Section[] = JSON.parse(cfgData.sections_config);
          if (Array.isArray(parsedSections)) setSections(parsedSections);
        } catch (e) { console.error("[loadData] sections parse error:", e); }
      }

      // Active inspection owns zones while running
      const activeInsp = inspList.find((i: any) => i.is_active === true);
      if (activeInsp) {
        setCurrentInspection(activeInsp);
        setIsInspectionActive(true);
        // Restore ownership: only the device that started it has the ownerInspectionId
        const storedOwnerId = typeof window !== "undefined" ? localStorage.getItem("ownerInspectionId") : null;
        setIsOwner(storedOwnerId === activeInsp.id);
        setZones(activeInsp.zones_data ?? (configZones ?? INITIAL_ZONES).map(z => ({ ...z, status: "PENDING" as ZoneStatus, findings: {} })));
      } else {
        setIsInspectionActive(false);
        setCurrentInspection(null);
        setIsOwner(false);
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

  // ─── Guard: verifica en DB si ya hay inspección activa antes de abrir el modal ───
  async function handleNewInspectionClick() {
    try {
      const res = await fetch("/api/inspections");
      const data: any[] = await res.json();
      const activeInsp = Array.isArray(data) ? data.find((i: any) => i.is_active === true) : null;
      if (activeInsp) {
        // Hay una inspección activa en otro dispositivo — sincronizar y unirse como observador
        await loadData();
        return;
      }
    } catch {
      // Si el fetch falla, no bloqueamos — dejamos intentar normalmente
    }
    setShowNewInspectionModal(true);
  }

  async function handleStartInspection(title: string, location: string, inspector: string) {
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, inspector }),
    });
    const newInsp: Inspection = await res.json();
    setCurrentInspection(newInsp);
    // Mark this device as the owner of this inspection
    if (typeof window !== "undefined") localStorage.setItem("ownerInspectionId", newInsp.id);
    setIsOwner(true);
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
      setIsOwner(false);
      if (typeof window !== "undefined") localStorage.removeItem("ownerInspectionId");
      setShowCancelConfirm(false);
      setCancelPassword(""); setCancelPasswordError(false);
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
    setIsOwner(false);
    if (typeof window !== "undefined") localStorage.removeItem("ownerInspectionId");
    setShowCancelConfirm(false);
    setCancelPassword(""); setCancelPasswordError(false);
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

    // 2. Save each new finding to DB — only those with local_ id (not yet persisted)
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

    // 3. Clear zone.findings in state — the source of truth is now allFindings (DB).
    //    This prevents duplicate inserts if the zone is opened and validated again.
    const cleanedZones = updatedZones.map(z =>
      z.id === zoneId ? { ...z, findings: {} } : z
    );
    setZones(cleanedZones);

    // 4. Persist zone colors to DB (with empty findings — counter uses allFindings)
    await fetch("/api/inspections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentInspection!.id, zones_data: cleanedZones }),
    });

    // 5. Reload findings from DB — this is now the single source of truth for the counter
    const finRes = await fetch("/api/findings");
    const finData = await finRes.json();
    setAllFindings(Array.isArray(finData) ? finData : []);
  }

  async function handleFinishInspection() {
    if (!currentInspection) return;
    setIsFinishing(true);

    // ── Paso 1: jalar el estado más fresco de la DB antes de cerrar ──────────
    let freshFindings: Finding[] = allFindings;
    let freshZonesData = zones;
    try {
      const [freshFinRes, freshInsRes] = await Promise.all([
        fetch("/api/findings"),
        fetch("/api/inspections"),
      ]);
      const freshFinData = await freshFinRes.json();
      const freshInsData = await freshInsRes.json();

      if (Array.isArray(freshFinData)) freshFindings = freshFinData;
      if (Array.isArray(freshInsData)) {
        const freshActive = freshInsData.find((i: any) => i.id === currentInspection.id);
        if (freshActive?.zones_data && Array.isArray(freshActive.zones_data)) {
          freshZonesData = freshActive.zones_data.map((serverZone: any) => {
            const localZone = zones.find(z => z.id === serverZone.id);
            if (localZone && localZone.status !== "PENDING") return localZone;
            return serverZone;
          });
        }
      }
    } catch { /* si falla la recarga, continúa con estado local */ }

    const findingsForInspection = freshFindings.filter(f => f.inspection_id === currentInspection.id);
    const okZones = freshZonesData.filter(z => z.status === "OK");
    const issueZones = freshZonesData.filter(z => z.status === "ISSUE");
    const pendingZonesCount = freshZonesData.filter(z => z.status === "PENDING").length;

    // Fallback summary — usado si la IA falla
    let summary = `Inspección completada el ${new Date().toLocaleDateString()}. ${okZones.length} zona${okZones.length !== 1 ? "s" : ""} sin hallazgos, ${issueZones.length} con hallazgos que requieren atención${pendingZonesCount > 0 ? `, ${pendingZonesCount} sin evaluar` : ""}.`;

    // ── Paso 2: IA — Prompt 1: análisis y corrección por hallazgo ────────────
    // Solo texto, sin fotos. Blindado: si falla, continúa con datos originales.
    let updatedFindingsFromAI: Array<{ id: string; ai_analysis: string }> = [];

    if (findingsForInspection.length > 0) {
      try {
        const findingsList = findingsForInspection.map((f, idx) =>
          `[${idx + 1}] Zona: ${f.zone_name || "Sin zona"} | Hallazgo: ${f.item_label} | Descripción: ${f.description} | Severidad: ${f.severity}`
        ).join("\n");

        const prompt1 = `Eres un experto en seguridad industrial e higiene ocupacional. Analiza los siguientes hallazgos de una inspección de seguridad en planta.

Para CADA hallazgo devuelve un objeto JSON con exactamente estos campos:
- "idx": número del hallazgo (mismo que el número entre corchetes)
- "correccion": corrección ortográfica y de redacción de la descripción original (solo corrige errores, conserva el sentido original, máximo 2 oraciones en español)
- "recomendacion": recomendación técnica específica de solución para ese hallazgo (máximo 2 oraciones en español, enfocada en la acción correctiva)

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin markdown, sin bloques de código. Ejemplo de formato esperado:
[{"idx":1,"correccion":"texto corregido","recomendacion":"acción técnica recomendada"},{"idx":2,"correccion":"...","recomendacion":"..."}]

HALLAZGOS A ANALIZAR:
${findingsList}`;

        const res1 = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt1 }),
        });

        if (res1.ok) {
          const data1 = await res1.json();
          if (data1.text) {
            try {
              // Limpiar posibles backticks o markdown que Gemini pueda agregar
              const clean = data1.text.replace(/```json|```/g, "").trim();
              const parsed: Array<{ idx: number; correccion: string; recomendacion: string }> = JSON.parse(clean);
              if (Array.isArray(parsed)) {
                updatedFindingsFromAI = parsed
                  .filter(item => item.idx >= 1 && item.idx <= findingsForInspection.length)
                  .map(item => {
                    const finding = findingsForInspection[item.idx - 1];
                    // Combina: descripción original + corrección IA + recomendación
                    const aiContent = [
                      item.correccion ? `✏️ Corrección IA: ${item.correccion}` : "",
                      item.recomendacion ? `💡 Recomendación: ${item.recomendacion}` : "",
                    ].filter(Boolean).join("\n");
                    return { id: finding.id, ai_analysis: aiContent };
                  });
              }
            } catch { /* parseo falló — continúa sin correcciones IA */ }
          }
        }
      } catch { /* Prompt 1 falló — blindaje: continúa sin análisis por hallazgo */ }
    }

    // ── Paso 3: IA — Prompt 2: resumen ejecutivo global ──────────────────────
    // Depende del contexto completo: zonas + secciones + hallazgos
    if (findingsForInspection.length > 0) {
      try {
        // Construir contexto de secciones y zonas
        const zonesContext = freshZonesData.map(z => {
          const sec = sections.find(s => s.zoneIds.includes(z.id));
          const zFindings = findingsForInspection.filter(f => f.zone_id === z.id);
          return `  - ${z.name} (Sección: ${sec?.name || "Sin sección"}) | Status: ${z.status} | Hallazgos: ${zFindings.length}`;
        }).join("\n");

        const findingsSummaryList = findingsForInspection.map(f =>
          `  • [${f.zone_name || "Sin zona"}] ${f.item_label}: ${f.description} (Severidad: ${f.severity})`
        ).join("\n");

        const totalEvaluated = okZones.length + issueZones.length;
        const evalPct = freshZonesData.length > 0 ? Math.round((totalEvaluated / freshZonesData.length) * 100) : 0;

        const prompt2 = `Eres un experto en seguridad industrial. Genera un resumen ejecutivo profesional en español de la siguiente inspección de seguridad en planta.

DATOS DE LA INSPECCIÓN:
- Total de zonas: ${freshZonesData.length}
- Zonas evaluadas: ${totalEvaluated} (${evalPct}%)
- Zonas con hallazgos (ISSUE): ${issueZones.length}
- Zonas sin hallazgos (OK): ${okZones.length}
- Zonas sin evaluar (PENDING): ${pendingZonesCount}
- Total de hallazgos registrados: ${findingsForInspection.length}

DETALLE POR ZONA:
${zonesContext}

LISTADO DE HALLAZGOS:
${findingsSummaryList}

El resumen debe incluir:
1. Párrafo ejecutivo general (2-3 oraciones) con el estado global de la inspección y porcentaje de avance
2. Sección "Áreas críticas" listando las zonas con más hallazgos o mayor severidad
3. Sección "Recomendaciones generales" con 3-5 acciones prioritarias basadas en los hallazgos encontrados
4. Una conclusión breve

Responde en texto plano en español, sin markdown, sin asteriscos, sin símbolos especiales. Usa saltos de línea para separar secciones.`;

        const res2 = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt2 }),
        });

        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.text && data2.text.trim()) {
            summary = data2.text.trim();
          }
        }
      } catch { /* Prompt 2 falló — blindaje: usa el summary de fallback */ }
    }

    // ── Paso 4: persistir correcciones IA en cada hallazgo (fire & forget) ───
    // No bloqueamos el cierre por esto — si falla, el hallazgo queda sin ai_analysis
    if (updatedFindingsFromAI.length > 0) {
      Promise.allSettled(
        updatedFindingsFromAI.map(({ id, ai_analysis }) =>
          fetch("/api/findings/ai", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ai_analysis }),
          }).catch(() => {}) // silencioso si falla
        )
      ).catch(() => {});
    }

    // ── Paso 5: intentar cerrar — el servidor verifica si ya fue cerrado ─────
    const closeRes = await fetch("/api/inspections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentInspection.id, summary, zones_data: freshZonesData, is_active: false }),
    });
    const closeData = await closeRes.json();

    if (closeData.already_closed) {
      setIsFinishing(false);
      setIsOwner(false);
      if (typeof window !== "undefined") localStorage.removeItem("ownerInspectionId");
      await loadData();
      setIsInspectionActive(false);
      setCurrentInspection(null);
      setView("current");
      return;
    }

    // ── Paso 6: cierre exitoso — esperar brevemente a que los PATCH de IA
    //    terminen para que la recarga final ya los incluya ────────────────────
    if (updatedFindingsFromAI.length > 0) {
      await new Promise(res => setTimeout(res, 800));
    }

    const finishedZones = [...freshZonesData];
    setIsInspectionActive(false);
    setCurrentInspection(null);
    setIsOwner(false);
    if (typeof window !== "undefined") localStorage.removeItem("ownerInspectionId");
    setIsFinishing(false);

    const [insRes, finRes] = await Promise.all([
      fetch("/api/inspections"),
      fetch("/api/findings"),
    ]);
    const insData = await insRes.json();
    const finData = await finRes.json();
    const inspList = Array.isArray(insData) ? insData : [];
    setInspections(inspList);
    setAllFindings(Array.isArray(finData) ? finData : []);
    setZones(finishedZones);

    setView("current");
  }

  async function handleCloseFinding(findingId: string, correctiveActions: string, closurePhotoUrl?: string) {
    await fetch("/api/findings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: findingId, corrective_actions: correctiveActions, closure_photo_url: closurePhotoUrl || null }),
    });
    setClosureTarget(null);
    const finRes = await fetch("/api/findings");
    const finData = await finRes.json();
    setAllFindings(Array.isArray(finData) ? finData : []);
  }

  async function handleDeleteFinding(findingId: string) {
    // 1. Borrar el hallazgo — la API devuelve inspection_id y zone_id
    const delRes = await fetch("/api/findings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: findingId }),
    });
    const delData = await delRes.json();
    const affectedInspectionId: string | null = delData.inspection_id ?? null;

    // 2. Recargar todos los findings
    const finRes = await fetch("/api/findings");
    const finData = await finRes.json();
    const updatedFindings: Finding[] = Array.isArray(finData) ? finData : [];
    setAllFindings(updatedFindings);

    // 3. Si tenemos la inspección afectada, recalcular el status de cada zona y persistir
    if (affectedInspectionId) {
      // Obtener la inspección actual (con su zones_data actual)
      const inspRes = await fetch("/api/inspections");
      const inspData = await inspRes.json();
      const inspList: Inspection[] = Array.isArray(inspData) ? inspData : [];
      const targetInsp = inspList.find((i: Inspection) => i.id === affectedInspectionId);

      if (targetInsp && Array.isArray(targetInsp.zones_data) && targetInsp.zones_data.length > 0) {
        // Findings restantes para esta inspección
        const remainingFindings = updatedFindings.filter(f => f.inspection_id === affectedInspectionId);

        // Recalcular status: una zona es ISSUE si tiene findings restantes, OK si fue evaluada y ya no tiene findings
        const updatedZonesData = (targetInsp.zones_data as Zone[]).map(z => {
          const zoneFindings = remainingFindings.filter(f => f.zone_id === z.id);
          if (zoneFindings.length > 0) {
            // Sigue teniendo hallazgos
            return { ...z, status: "ISSUE" as ZoneStatus };
          } else if (z.status === "ISSUE") {
            // Tenía hallazgos pero ya no — pasa a OK (la zona fue evaluada)
            return { ...z, status: "OK" as ZoneStatus };
          }
          // PENDING o OK sin cambio
          return z;
        });

        // Persistir zones_data actualizado
        await fetch("/api/inspections", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: affectedInspectionId, zones_data: updatedZonesData }),
        });
      }

      // 4. Recargar inspecciones para que ExecutiveSummary reciba zonesData actualizado
      const freshInspRes = await fetch("/api/inspections");
      const freshInspData = await freshInspRes.json();
      setInspections(Array.isArray(freshInspData) ? freshInspData : []);
    }
  }

  async function handleUpdateFinding(findingId: string, description: string, itemLabel: string) {
    await fetch("/api/findings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: findingId, description, item_label: itemLabel }),
    });
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
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Cargando app JJ. Amil...</p>
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
                { key: "active_issues", label: `Hallazgos (${activeFindings.length})` },
                { key: "history", label: "Historial" },
                { key: "config", label: "Configuración" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "config" && !configUnlocked) {
                      setConfigPassword("");
                      setConfigPasswordError(false);
                      setShowConfigAuth(true);
                    } else {
                      if (view === "config" && key !== "config") setConfigUnlocked(false);
                      setView(key as any);
                    }
                  }}
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
          { key: "active_issues", label: "Hallazgos", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
          { key: "history", label: "Historial", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
          { key: "config", label: "Config", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => {
              if (key === "config" && !configUnlocked) {
                setConfigPassword("");
                setConfigPasswordError(false);
                setShowConfigAuth(true);
              } else {
                if (view === "config" && key !== "config") setConfigUnlocked(false);
                setView(key as any);
              }
            }}
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
        {/* ── CURRENT VIEW ── */}
        {view === "current" && (
          <CurrentView
            isInspectionActive={isInspectionActive}
            currentInspection={currentInspection}
            zones={zones}
            allFindings={allFindings}
            inspections={inspections}
            sections={sections}
            expandedSectionIds={expandedSectionIds}
            toggleSection={toggleSection}
            setSelectedZone={setSelectedZone}
            setShowNewInspectionModal={(v) => { if (v) handleNewInspectionClick(); else setShowNewInspectionModal(false); }}
            setShowCancelConfirm={setShowCancelConfirm}
            setShowFinishConfirm={setShowFinishConfirm}
            isFinishing={isFinishing}
            pendingZones={pendingZones}
            lastInspection={lastInspection}
            setViewFinding={setViewFinding}
            summaryCollapsedKeys={summaryCollapsedKeys}
            toggleSummaryKey={toggleSummaryKey}
            isOwner={isOwner}
            onRecoverOwnership={() => {
              setRecoverPassword("");
              setRecoverPasswordError(false);
              setShowRecoverOwnership(true);
            }}
            onDeleteFinding={handleDeleteFinding}
            onUpdateFinding={handleUpdateFinding}
          />
        )}

        {/* ── ACTIVE ISSUES VIEW ── */}
        {view === "active_issues" && (
          <FindingsView
            allFindings={allFindings}
            activeFindings={activeFindings}
            closedFindings={closedFindings}
            sections={sections}
            setClosureTarget={setClosureTarget}
            setViewFinding={setViewFinding}
            setZoomImage={setZoomImage}
            findingsCollapsedKeys={findingsCollapsedKeys}
            toggleFindingKey={toggleFindingKey}
          />
        )}

        {/* ── HISTORY VIEW ── */}
        {view === "history" && (
          <HistoryView
            inspections={inspections}
            allFindings={allFindings}
            activeFindings={activeFindings}
            sections={sections}
            setViewFinding={setViewFinding}
            summaryCollapsedKeys={summaryCollapsedKeys}
            toggleSummaryKey={toggleSummaryKey}
            onDeleteFinding={handleDeleteFinding}
            onUpdateFinding={handleUpdateFinding}
          />
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
            sections={sections}
            onSectionsChange={saveSections}
            isInspectionActive={isInspectionActive}
            onShowCancelConfirm={() => setShowCancelConfirm(true)}
            onShowFinishConfirm={() => setShowFinishConfirm(true)}
            isFinishing={isFinishing}
            pendingZones={pendingZones}
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
          existingFindings={allFindings.filter(f =>
            f.inspection_id === currentInspection.id &&
            f.zone_id === selectedZone.id
          )}
          onClose={() => setSelectedZone(null)}
          onSave={async (zoneId, zoneName, status, checklistResults, findings) => {
            await handleZoneSave(zoneId, zoneName, status, checklistResults, findings);
          }}
        />
      )}

      {closureTarget && (
        <ClosureModal
          finding={closureTarget}
          sectionName={sections.find(s => s.zoneIds.includes(closureTarget.zone_id || ""))?.name}
          onClose={() => setClosureTarget(null)}
          onConfirm={handleCloseFinding}
        />
      )}

      {viewFinding && (
        <FindingViewModal
          finding={viewFinding}
          sectionName={sections.find(s => s.zoneIds.includes(viewFinding.zone_id || ""))?.name}
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
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Confirma con contraseña de admin</p>
                <input
                  type="password"
                  value={cancelPassword}
                  onChange={e => { setCancelPassword(e.target.value); setCancelPasswordError(false); }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && cancelPassword === "admin") handleCancelInspection();
                    else if (e.key === "Enter") setCancelPasswordError(true);
                  }}
                  placeholder="Contraseña"
                  className={`w-full px-4 py-3 bg-slate-50 border-2 rounded-xl text-center font-black text-lg tracking-widest outline-none transition-all ${cancelPasswordError ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-red-400"}`}
                  autoFocus
                />
                {cancelPasswordError && (
                  <p className="text-red-500 text-[10px] font-black uppercase text-center mt-1.5">Contraseña incorrecta</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCancelConfirm(false); setCancelPassword(""); setCancelPasswordError(false); }}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-600 hover:bg-slate-50 transition-all"
                >
                  CONTINUAR RECORRIDO
                </button>
                <button
                  onClick={() => {
                    if (cancelPassword === "admin") handleCancelInspection();
                    else setCancelPasswordError(true);
                  }}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 transition-all shadow-lg"
                >
                  SÍ, CANCELAR
                </button>
              </div>
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
      {/* ── Modal contraseña config ── */}
      {showConfigAuth && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50 border-b text-center">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-800">Acceso a Configuración</h3>
              <p className="text-slate-500 text-sm mt-1">Introduzca contraseña de admin para ingresar</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <input
                  type="password"
                  value={configPassword}
                  onChange={e => { setConfigPassword(e.target.value); setConfigPasswordError(false); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (configPassword === "admin") {
                        setConfigUnlocked(true);
                        setShowConfigAuth(false);
                        setView("config");
                      } else {
                        setConfigPasswordError(true);
                      }
                    }
                  }}
                  placeholder="Contraseña"
                  className={`w-full px-4 py-3 bg-slate-50 border-2 rounded-xl text-center font-black text-lg tracking-widest outline-none transition-all ${configPasswordError ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-slate-900"}`}
                  autoFocus
                />
                {configPasswordError && (
                  <p className="text-red-500 text-[10px] font-black uppercase text-center mt-1.5">Contraseña incorrecta</p>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setShowConfigAuth(false); setConfigPassword(""); setConfigPasswordError(false); }}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 transition-all"
              >
                CANCELAR
              </button>
              <button
                onClick={() => {
                  if (configPassword === "admin") {
                    setConfigUnlocked(true);
                    setShowConfigAuth(false);
                    setView("config");
                  } else {
                    setConfigPasswordError(true);
                  }
                }}
                className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-black transition-all shadow-lg"
              >
                INGRESAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal recuperación de ownership ── */}
      {showRecoverOwnership && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-amber-100 overflow-hidden">
            <div className="p-6 bg-amber-50 border-b text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-800">Recuperar control</h3>
              <p className="text-slate-500 text-sm mt-1">Ingresa la contraseña de admin para retomar el control de este recorrido en este dispositivo.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <input
                  type="password"
                  value={recoverPassword}
                  onChange={e => { setRecoverPassword(e.target.value); setRecoverPasswordError(false); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (recoverPassword === "admin" && currentInspection) {
                        if (typeof window !== "undefined") localStorage.setItem("ownerInspectionId", currentInspection.id);
                        setIsOwner(true);
                        setShowRecoverOwnership(false);
                        setRecoverPassword("");
                      } else {
                        setRecoverPasswordError(true);
                      }
                    }
                  }}
                  placeholder="Contraseña"
                  className={`w-full px-4 py-3 bg-slate-50 border-2 rounded-xl text-center font-black text-lg tracking-widest outline-none transition-all ${recoverPasswordError ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-amber-400"}`}
                  autoFocus
                />
                {recoverPasswordError && (
                  <p className="text-red-500 text-[10px] font-black uppercase text-center mt-1.5">Contraseña incorrecta</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRecoverOwnership(false); setRecoverPassword(""); setRecoverPasswordError(false); }}
                  className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 transition-all"
                >
                  CANCELAR
                </button>
                <button
                  onClick={() => {
                    if (recoverPassword === "admin" && currentInspection) {
                      if (typeof window !== "undefined") localStorage.setItem("ownerInspectionId", currentInspection.id);
                      setIsOwner(true);
                      setShowRecoverOwnership(false);
                      setRecoverPassword("");
                    } else {
                      setRecoverPasswordError(true);
                    }
                  }}
                  className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-black text-xs uppercase hover:bg-amber-600 transition-all shadow-lg"
                >
                  RECUPERAR CONTROL
                </button>
              </div>
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

