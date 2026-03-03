"use client";

import React, { useState } from "react";
import type { Zone, Finding, Inspection, Section } from "./types";

// ─── Config Page ──────────────────────────────────────────────────────────────
// Sections own zones. No independent zones panel.
export function ConfigPage({
  inspectionCount, findingCount, zones,
  onZonesChange, onDeleteAll, inspections, allFindings, onDeleteInspection,
  sections, onSectionsChange,
  isInspectionActive, onShowCancelConfirm, onShowFinishConfirm, isFinishing, pendingZones,
}: {
  inspectionCount: number;
  findingCount: number;
  zones: Zone[];
  onZonesChange: (zones: Zone[]) => void;
  onDeleteAll: () => Promise<void>;
  inspections: Inspection[];
  allFindings: Finding[];
  onDeleteInspection: (id: string) => Promise<void>;
  sections: Section[];
  onSectionsChange: (sections: Section[]) => Promise<void>;
  isInspectionActive: boolean;
  onShowCancelConfirm: () => void;
  onShowFinishConfirm: () => void;
  isFinishing: boolean;
  pendingZones: number;
}) {
  // ── Section state ──
  const [newSectionName, setNewSectionName] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);
  const [expandedSectionCfgIds, setExpandedSectionCfgIds] = useState<Set<string>>(new Set());

  // ── Zone state (per-section inputs) ──
  const [newZoneNames, setNewZoneNames] = useState<Record<string, string>>({});
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState("");
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [deleteZoneWord, setDeleteZoneWord] = useState("");

  // ── History state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [histDeleteWord, setHistDeleteWord] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [inspToDelete, setInspToDelete] = useState<Inspection | null>(null);
  const [inspDeleteWord, setInspDeleteWord] = useState("");
  const [isDeletingInsp, setIsDeletingInsp] = useState(false);

  // ── Save status ──
  const [lastSaveStatus, setLastSaveStatus] = useState<"idle"|"saving"|"ok"|"error">("idle");
  const [isSaving, setIsSaving] = useState(false);

  const toggleSectionCfg = (id: string) => {
    setExpandedSectionCfgIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Section handlers ──
  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    const sec: Section = { id: `s${Date.now()}`, name: newSectionName.trim(), zoneIds: [] };
    // Auto-assign unassigned zones to first section if this is the first one being created
    const assignedIds = new Set(sections.flatMap(s => s.zoneIds));
    const unassigned = zones.filter(z => !assignedIds.has(z.id));
    const newSec = sections.length === 0 && unassigned.length > 0
      ? { ...sec, zoneIds: unassigned.map(z => z.id) }
      : sec;
    const updated = [...sections, newSec];
    setNewSectionName("");
    setExpandedSectionCfgIds(prev => { const n = new Set(prev); n.add(newSec.id); return n; });
    setIsSaving(true); setLastSaveStatus("saving");
    try { await onSectionsChange(updated); setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000); }
    catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  const handleSaveSectionName = async (secId: string) => {
    if (!editingSectionName.trim()) return;
    const updated = sections.map(s => s.id === secId ? { ...s, name: editingSectionName.trim() } : s);
    setEditingSectionId(null); setEditingSectionName("");
    setIsSaving(true); setLastSaveStatus("saving");
    try { await onSectionsChange(updated); setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000); }
    catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  const handleDeleteSection = async (sec: Section) => {
    const updated = sections.filter(s => s.id !== sec.id);
    setSectionToDelete(null);
    setIsSaving(true); setLastSaveStatus("saving");
    try { await onSectionsChange(updated); setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000); }
    catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  // ── Zone handlers ──
  const commitZones = async (updated: Zone[], updatedSections?: Section[]) => {
    setIsSaving(true); setLastSaveStatus("saving");
    try {
      onZonesChange(updated);
      if (updatedSections) await onSectionsChange(updatedSections);
      setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000);
    } catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  const handleAddZoneToSection = async (secId: string) => {
    const name = (newZoneNames[secId] || "").trim();
    if (!name) return;
    const newZone: Zone = { id: `z${Date.now()}`, name, status: "PENDING", x: 10, y: 10, width: 25, height: 25, findings: {} };
    const updatedZones = [...zones, newZone];
    const updatedSections = sections.map(s => s.id === secId ? { ...s, zoneIds: [...s.zoneIds, newZone.id] } : s);
    setNewZoneNames(prev => ({ ...prev, [secId]: "" }));
    await commitZones(updatedZones, updatedSections);
  };

  const handleSaveZoneName = async (zoneId: string) => {
    if (!editingZoneName.trim()) return;
    const updated = zones.map(z => z.id === zoneId ? { ...z, name: editingZoneName.trim() } : z);
    setEditingZoneId(null); setEditingZoneName("");
    await commitZones(updated);
  };

  const handleConfirmDeleteZone = async () => {
    if (!zoneToDelete || deleteZoneWord !== "BORRAR") return;
    const updatedZones = zones.filter(z => z.id !== zoneToDelete.id);
    const updatedSections = sections.map(s => ({ ...s, zoneIds: s.zoneIds.filter(id => id !== zoneToDelete.id) }));
    setZoneToDelete(null); setDeleteZoneWord("");
    await commitZones(updatedZones, updatedSections);
  };

  // ── Reorder handlers ──
  const handleMoveSectionUp = async (idx: number) => {
    if (idx === 0) return;
    const updated = [...sections];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setIsSaving(true); setLastSaveStatus("saving");
    try { await onSectionsChange(updated); setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000); }
    catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  const handleMoveSectionDown = async (idx: number) => {
    if (idx === sections.length - 1) return;
    const updated = [...sections];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setIsSaving(true); setLastSaveStatus("saving");
    try { await onSectionsChange(updated); setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000); }
    catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  const handleMoveZoneUp = async (secId: string, zoneIdx: number) => {
    if (zoneIdx === 0) return;
    const updated = sections.map(s => {
      if (s.id !== secId) return s;
      const ids = [...s.zoneIds];
      [ids[zoneIdx - 1], ids[zoneIdx]] = [ids[zoneIdx], ids[zoneIdx - 1]];
      return { ...s, zoneIds: ids };
    });
    setIsSaving(true); setLastSaveStatus("saving");
    try { await onSectionsChange(updated); setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000); }
    catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  const handleMoveZoneDown = async (secId: string, zoneIdx: number, totalZones: number) => {
    if (zoneIdx === totalZones - 1) return;
    const updated = sections.map(s => {
      if (s.id !== secId) return s;
      const ids = [...s.zoneIds];
      [ids[zoneIdx], ids[zoneIdx + 1]] = [ids[zoneIdx + 1], ids[zoneIdx]];
      return { ...s, zoneIds: ids };
    });
    setIsSaving(true); setLastSaveStatus("saving");
    try { await onSectionsChange(updated); setLastSaveStatus("ok"); setTimeout(() => setLastSaveStatus("idle"), 2000); }
    catch { setLastSaveStatus("error"); } finally { setIsSaving(false); }
  };

  // ── History handlers ──
  const handleConfirmDeleteInspection = async () => {
    if (!inspToDelete || inspDeleteWord !== "BORRAR") return;
    setIsDeletingInsp(true);
    await onDeleteInspection(inspToDelete.id);
    setIsDeletingInsp(false); setInspToDelete(null); setInspDeleteWord("");
  };

  const handleConfirmDeleteHistory = async () => {
    if (histDeleteWord !== "BORRAR") return;
    setIsDeleting(true);
    await onDeleteAll();
    setIsDeleting(false); setShowDeleteConfirm(false); setHistDeleteWord("");
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Configuración</h2>
        {lastSaveStatus === "saving" && (
          <span className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1">
            <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"/>Guardando...
          </span>
        )}
        {lastSaveStatus === "ok" && <span className="text-[10px] font-black text-green-600 uppercase">✓ Guardado</span>}
        {lastSaveStatus === "error" && <span className="text-[10px] font-black text-red-600 uppercase">✕ Error al guardar</span>}
      </div>

      {/* ── Botones de control del recorrido activo ── */}
      {isInspectionActive && (
        <div className="rounded-2xl border-2 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 border-blue-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-1 bg-blue-100 text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Recorrido en progreso · acceso de administrador
            </div>
            <p className="text-xs font-bold text-slate-500">
              {pendingZones > 0
                ? `${pendingZones} zona${pendingZones !== 1 ? "s" : ""} pendiente${pendingZones !== 1 ? "s" : ""} de evaluar`
                : "Todas las zonas evaluadas"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onShowCancelConfirm}
              className="bg-red-500/10 text-red-500 border border-red-300 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500/20 transition-all"
            >
              CANCELAR RECORRIDO
            </button>
            <button
              onClick={onShowFinishConfirm}
              disabled={isFinishing}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:bg-slate-300"
            >
              {isFinishing
                ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> GENERANDO...</>
                : "FINALIZAR EVALUACIÓN"
              }
            </button>
          </div>
        </div>
      )}

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

      {/* ── Secciones + Zonas anidadas ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-sm">Secciones y Zonas</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Crear secciones · agregar zonas dentro de cada sección</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {/* Crear sección */}
          <div className="flex gap-2">
            <input
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddSection()}
              placeholder="Nombre de la nueva sección..."
              className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none transition-all"
            />
            <button
              onClick={handleAddSection}
              disabled={!newSectionName.trim() || isSaving}
              className={`px-3 py-2 rounded-xl font-black text-xs uppercase transition-all ${newSectionName.trim() && !isSaving ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow" : "bg-slate-100 text-slate-300"}`}
            >
              + ADD
            </button>
          </div>

          {sections.length === 0 && (
            <p className="text-center text-slate-400 text-xs py-3 font-bold uppercase">Sin secciones creadas. Agrega la primera.</p>
          )}

          <div className="space-y-2">
            {sections.map((sec, secIdx) => {
              const isExpanded = expandedSectionCfgIds.has(sec.id);
              const isEditing  = editingSectionId === sec.id;
              const secZones   = sec.zoneIds.map(id => zones.find(z => z.id === id)).filter(Boolean) as Zone[];
              const isFirst    = secIdx === 0;
              const isLast     = secIdx === sections.length - 1;
              return (
                <div key={sec.id} className="border-2 border-indigo-100 rounded-xl overflow-hidden">
                  {/* Cabecera sección */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 bg-indigo-50/70 cursor-pointer hover:bg-indigo-50"
                    onClick={() => !isEditing && toggleSectionCfg(sec.id)}
                  >
                    {/* Botones reorden sección */}
                    <div className="flex flex-col gap-0.5 mr-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveSectionUp(secIdx)}
                        disabled={isFirst || isSaving}
                        className={`w-5 h-4 rounded flex items-center justify-center transition-all ${isFirst ? "text-slate-200 cursor-default" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-100"}`}
                        title="Subir sección"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveSectionDown(secIdx)}
                        disabled={isLast || isSaving}
                        className={`w-5 h-4 rounded flex items-center justify-center transition-all ${isLast ? "text-slate-200 cursor-default" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-100"}`}
                        title="Bajar sección"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0" />
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingSectionName}
                          onChange={e => setEditingSectionName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleSaveSectionName(sec.id); if (e.key === "Escape") setEditingSectionId(null); }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 px-2 py-0.5 text-xs font-black bg-white border-2 border-indigo-400 rounded-lg outline-none min-w-0"
                        />
                      ) : (
                        <span className="font-black text-slate-800 text-xs truncate">{sec.name}</span>
                      )}
                      <span className="text-[7px] bg-indigo-100 text-indigo-500 px-1.5 py-0.5 rounded-full font-black uppercase shrink-0">{sec.zoneIds.length} zonas</span>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <button onClick={() => handleSaveSectionName(sec.id)} className="px-2 h-6 bg-green-600 text-white rounded-md font-black text-[8px] hover:bg-green-700">✓</button>
                          <button onClick={() => setEditingSectionId(null)} className="px-2 h-6 bg-slate-200 text-slate-600 rounded-md font-black text-[8px]">✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingSectionId(sec.id); setEditingSectionName(sec.name); }} className="w-6 h-6 bg-blue-50 text-blue-500 rounded-md flex items-center justify-center hover:bg-blue-100" title="Renombrar">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button onClick={() => setSectionToDelete(sec)} className="w-6 h-6 bg-red-50 text-red-500 rounded-md flex items-center justify-center text-[10px] hover:bg-red-100 font-black">✕</button>
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ml-1 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Contenido: zonas + input nueva zona */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 bg-white space-y-1.5">
                      {/* Lista de zonas de esta sección */}
                      {secZones.map((zone, zoneIdx) => {
                        const isEditingZone = editingZoneId === zone.id;
                        const zoneIsFirst   = zoneIdx === 0;
                        const zoneIsLast    = zoneIdx === secZones.length - 1;
                        return (
                          <div key={zone.id} className="border-2 border-slate-100 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-white transition-all">
                              {/* Botones reorden zona */}
                              <div className="flex flex-col gap-0.5 mr-2 shrink-0">
                                <button
                                  onClick={() => handleMoveZoneUp(sec.id, zoneIdx)}
                                  disabled={zoneIsFirst || isSaving}
                                  className={`w-5 h-4 rounded flex items-center justify-center transition-all ${zoneIsFirst ? "text-slate-200 cursor-default" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200"}`}
                                  title="Subir zona"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleMoveZoneDown(sec.id, zoneIdx, secZones.length)}
                                  disabled={zoneIsLast || isSaving}
                                  className={`w-5 h-4 rounded flex items-center justify-center transition-all ${zoneIsLast ? "text-slate-200 cursor-default" : "text-slate-400 hover:text-slate-700 hover:bg-slate-200"}`}
                                  title="Bajar zona"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${zone.status === "OK" ? "bg-green-500" : zone.status === "ISSUE" ? "bg-red-500" : "bg-slate-300"}`} />
                                {isEditingZone ? (
                                  <input autoFocus value={editingZoneName}
                                    onChange={e => setEditingZoneName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleSaveZoneName(zone.id); if (e.key === "Escape") setEditingZoneId(null); }}
                                    className="flex-1 px-2 py-0.5 text-xs font-black bg-white border-2 border-blue-400 rounded-lg outline-none min-w-0" />
                                ) : (
                                  <span className="font-black text-slate-800 text-xs truncate">{zone.name}</span>
                                )}
                                <span className="text-[7px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-black uppercase shrink-0">{zone.status}</span>
                              </div>
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                {isEditingZone ? (
                                  <>
                                    <button onClick={() => handleSaveZoneName(zone.id)} className="px-2 h-6 bg-green-600 text-white rounded-md font-black text-[8px] hover:bg-green-700">✓</button>
                                    <button onClick={() => setEditingZoneId(null)} className="px-2 h-6 bg-slate-200 text-slate-600 rounded-md font-black text-[8px]">✕</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => { setEditingZoneId(zone.id); setEditingZoneName(zone.name); }} className="w-6 h-6 bg-blue-50 text-blue-500 rounded-md flex items-center justify-center hover:bg-blue-100" title="Renombrar">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button onClick={() => { setZoneToDelete(zone); setDeleteZoneWord(""); }} className="w-6 h-6 bg-red-50 text-red-500 rounded-md flex items-center justify-center text-[10px] hover:bg-red-100 font-black">✕</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Input para agregar zona a esta sección */}
                      <div className="flex gap-2 pt-1">
                        <input
                          value={newZoneNames[sec.id] || ""}
                          onChange={e => setNewZoneNames(prev => ({ ...prev, [sec.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && handleAddZoneToSection(sec.id)}
                          placeholder="Nueva zona en esta sección..."
                          className="flex-1 px-3 py-1.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-medium focus:border-indigo-400 outline-none transition-all"
                        />
                        <button
                          onClick={() => handleAddZoneToSection(sec.id)}
                          disabled={!(newZoneNames[sec.id] || "").trim() || isSaving}
                          className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all ${(newZoneNames[sec.id] || "").trim() && !isSaving ? "bg-slate-900 text-white hover:bg-black shadow" : "bg-slate-100 text-slate-300"}`}
                        >
                          + Zona
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Zonas sin sección (sólo si existen) */}
          {(() => {
            const assignedIds = new Set(sections.flatMap(s => s.zoneIds));
            const unassigned  = zones.filter(z => !assignedIds.has(z.id));
            if (unassigned.length === 0) return null;
            return (
              <div className="border-2 border-dashed border-amber-200 rounded-xl overflow-hidden mt-2">
                <div className="px-3 py-2 bg-amber-50 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="flex-1 font-black text-amber-700 text-xs">Sin sección asignada</span>
                  <span className="text-[7px] font-black bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase">⚠ {unassigned.length}</span>
                </div>
                <div className="px-3 pb-2 pt-1.5 bg-white space-y-1.5">
                  {unassigned.map(zone => (
                    <div key={zone.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${zone.status === "OK" ? "bg-green-500" : zone.status === "ISSUE" ? "bg-red-500" : "bg-slate-300"}`} />
                      <span className="flex-1 text-xs font-black text-slate-700 truncate">{zone.name}</span>
                      <span className="text-[7px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-black uppercase">{zone.status}</span>
                    </div>
                  ))}
                  <p className="text-[9px] text-amber-600 font-bold text-center py-1">Asigna estas zonas a una sección desde la sección correspondiente</p>
                </div>
              </div>
            );
          })()}
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
                    <div className="bg-slate-800 rounded-lg px-2 py-1 text-center shrink-0 min-w-[36px]">
                      <p className="text-[7px] font-black text-slate-400 uppercase leading-none">
                        {new Date(insp.created_at).toLocaleString("default", { month: "short" })}
                      </p>
                      <p className="text-sm font-black text-white leading-tight">{new Date(insp.created_at).getDate()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-xs truncate">{insp.title}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{insp.inspector} · {insp.location}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {openCount > 0 && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">{openCount} ab.</span>}
                      {closedCount > 0 && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">{closedCount} ok</span>}
                      {inspFindings.length === 0 && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">sin hall.</span>}
                    </div>
                    <button
                      onClick={() => { setInspToDelete(insp); setInspDeleteWord(""); }}
                      className="shrink-0 w-7 h-7 bg-red-50 text-red-500 border border-red-100 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all"
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
              <p className="text-xs text-slate-500 text-center">Se eliminarán todos los hallazgos e imágenes asociados.</p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Escribe <span className="text-red-600 font-black">BORRAR</span> para confirmar
                </label>
                <input value={inspDeleteWord} onChange={e => setInspDeleteWord(e.target.value)} placeholder="BORRAR"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-lg tracking-widest focus:border-red-400 outline-none" />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => { setInspToDelete(null); setInspDeleteWord(""); }}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
              <button disabled={inspDeleteWord !== "BORRAR" || isDeletingInsp} onClick={handleConfirmDeleteInspection}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white ${inspDeleteWord === "BORRAR" && !isDeletingInsp ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}>
                {isDeletingInsp ? "ELIMINANDO..." : "ELIMINAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar sección */}
      {sectionToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs border-4 border-red-200 overflow-hidden">
            <div className="p-5 bg-red-600 text-white text-center">
              <p className="text-3xl mb-1">⚠️</p>
              <h3 className="text-lg font-black">¿Eliminar sección?</h3>
              <p className="text-red-100 text-xs mt-1 font-bold">"{sectionToDelete.name}"</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-slate-500">Las zonas asignadas no se eliminarán, solo se desagruparán.</p>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={() => setSectionToDelete(null)} className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
              <button onClick={() => handleDeleteSection(sectionToDelete)} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 shadow">ELIMINAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar zona */}
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
                <input value={deleteZoneWord} onChange={e => setDeleteZoneWord(e.target.value)} placeholder="BORRAR"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-lg tracking-widest focus:border-red-400 outline-none" />
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => { setZoneToDelete(null); setDeleteZoneWord(""); }}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
              <button disabled={deleteZoneWord !== "BORRAR"} onClick={handleConfirmDeleteZone}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white ${deleteZoneWord === "BORRAR" ? "bg-red-600 hover:bg-red-700" : "bg-slate-300"}`}>
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
