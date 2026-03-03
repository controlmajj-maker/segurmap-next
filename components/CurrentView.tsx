"use client";

import React from "react";
import type { Zone, Finding, Inspection, Section, ZoneStatus } from "./types";
import { ExecutiveSummary } from "./ExecutiveSummary";

export function CurrentView({
  isInspectionActive,
  currentInspection,
  zones,
  allFindings,
  inspections,
  sections,
  expandedSectionIds,
  toggleSection,
  setSelectedZone,
  setShowNewInspectionModal,
  setShowCancelConfirm,
  setShowFinishConfirm,
  isFinishing,
  pendingZones,
  lastInspection,
  setViewFinding,
  summaryCollapsedKeys,
  toggleSummaryKey,
}: {
  isInspectionActive: boolean;
  currentInspection: Inspection | null;
  zones: Zone[];
  allFindings: Finding[];
  inspections: Inspection[];
  sections: Section[];
  expandedSectionIds: Set<string>;
  toggleSection: (id: string) => void;
  setSelectedZone: (zone: Zone | null) => void;
  setShowNewInspectionModal: (v: boolean) => void;
  setShowCancelConfirm: (v: boolean) => void;
  setShowFinishConfirm: (v: boolean) => void;
  isFinishing: boolean;
  pendingZones: number;
  lastInspection: Inspection | null;
  setViewFinding: (f: Finding | null) => void;
  summaryCollapsedKeys: Set<string>;
  toggleSummaryKey: (key: string) => void;
}) {
  return (
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
                  // Móvil: fila horizontal compacta. Desktop: grid 4 columnas normal
                  <div className="flex md:grid md:grid-cols-4 gap-2 md:gap-3 mb-4">
                    {/* Gauge evaluación — móvil compacto, desktop normal */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 md:p-3 flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0 flex-1 md:col-span-1">
                      <svg width="44" height="44" className="md:w-[72px] md:h-[72px] shrink-0" viewBox="0 0 72 72">
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
                      <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest md:mt-1 text-center leading-tight">
                        <span className="hidden md:inline">Evaluación<br/></span>
                        <span className="text-slate-600">{evalLabel}</span>
                      </p>
                    </div>

                    {/* Total auditorías */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 md:p-3 flex flex-col items-center justify-center text-center flex-1">
                      <p className="text-xl md:text-3xl font-black text-slate-800 leading-none">{totalAuditorias}</p>
                      <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 md:mt-2 leading-tight">
                        Auditorías<br/>totales
                      </p>
                    </div>

                    {/* Total hallazgos abiertos */}
                    <div className={`rounded-2xl border shadow-sm p-2 md:p-3 flex flex-col items-center justify-center text-center flex-1 ${totalAbiertos > 0 ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`}>
                      <p className={`text-xl md:text-3xl font-black leading-none ${totalAbiertos > 0 ? "text-red-600" : "text-slate-800"}`}>{totalAbiertos}</p>
                      <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 md:mt-2 leading-tight">
                        Hall.<br/>abiertos
                      </p>
                    </div>

                    {/* Total hallazgos resueltos */}
                    <div className={`rounded-2xl border shadow-sm p-2 md:p-3 flex flex-col items-center justify-center text-center flex-1 ${totalResueltos > 0 ? "bg-green-50 border-green-100" : "bg-white border-slate-100"}`}>
                      <p className={`text-xl md:text-3xl font-black leading-none ${totalResueltos > 0 ? "text-green-600" : "text-slate-800"}`}>{totalResueltos}</p>
                      <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 md:mt-2 leading-tight">
                        Hall.<br/>resueltos
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Lista de zonas agrupada por secciones ── */}
              {(() => {
                const assignedZoneIds = new Set(sections.flatMap(s => s.zoneIds));
                const unassignedZones = zones.filter(z => !assignedZoneIds.has(z.id));

                const renderZoneRow = (zone: Zone, idx: number) => {
                  const isOK      = zone.status === "OK";
                  const isISSUE   = zone.status === "ISSUE";
                  const isClickable = isInspectionActive;
                  const dotClass  = isOK ? "bg-green-400" : isISSUE ? "bg-red-500" : isInspectionActive ? "bg-slate-400" : "bg-slate-300";
                  const dotAnim   = isISSUE ? "animate-pulse" : "";
                  const badgeClass = isOK    ? "bg-green-500/10 text-green-600 border-green-200" :
                                     isISSUE ? "bg-red-500/10 text-red-600 border-red-200" :
                                               "bg-slate-100 text-slate-400 border-slate-200";
                  const rowClass  = isInspectionActive
                    ? isOK    ? "bg-green-50/40 border-green-200 hover:border-green-400 hover:bg-green-50/70"
                    : isISSUE ? "bg-red-50/40 border-red-200 hover:border-red-400 hover:bg-red-50/70"
                    :           "bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                    : isOK    ? "bg-green-50/40 border-green-100"
                    : isISSUE ? "bg-red-50/40 border-red-100"
                    :           "bg-white border-slate-100";
                  return (
                    <button
                      key={zone.id}
                      disabled={!isClickable}
                      onClick={() => isClickable && setSelectedZone(zone)}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 text-left ${rowClass} ${isClickable ? "cursor-pointer active:scale-[0.98] hover:shadow-md" : "cursor-default"} shadow-sm`}
                    >
                      <span className="relative shrink-0 flex items-center justify-center w-8 h-8">
                        <span className={`w-3 h-3 rounded-full ${dotClass} ${dotAnim}`} />
                        {isISSUE && <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" style={{animationDuration:"2s"}} />}
                        {isOK && isInspectionActive && <span className="absolute inset-0 rounded-full bg-green-400/10" />}
                      </span>
                      <span className="flex-1 font-black text-sm md:text-base tracking-tight text-slate-800">{zone.name}</span>
                      {isISSUE && (() => {
                        const inspId = isInspectionActive ? currentInspection?.id : inspections.find((i: any) => !i.is_active)?.id;
                        if (!inspId) return null;
                        const count = allFindings.filter(f => f.inspection_id === inspId && f.zone_id === zone.id).length;
                        return count > 0 ? (
                          <span className="text-[9px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">⚠ {count}</span>
                        ) : null;
                      })()}
                      <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${badgeClass}`}>
                        {isOK ? "✓ OK" : isISSUE ? "ISSUE" : "PENDIENTE"}
                      </span>
                      {isClickable && (
                        <svg className="w-4 h-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  );
                };

                if (sections.length === 0) {
                  return (
                    <div className="space-y-2">
                      {zones.map((zone, idx) => renderZoneRow(zone, idx))}
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {sections.map(sec => {
                      const secZones = sec.zoneIds.map(id => zones.find(z => z.id === id)).filter(Boolean) as Zone[];
                      const isExpanded = !expandedSectionIds.has(sec.id);
                      const hasIssue   = secZones.some(z => z.status === "ISSUE");
                      const allOk      = secZones.length > 0 && secZones.every(z => z.status === "OK");
                      // Total de hallazgos reales en toda la sección (no solo zonas con issue)
                      const inspId = isInspectionActive ? currentInspection?.id : inspections.find((i: any) => !i.is_active)?.id;
                      const issueCount = inspId
                        ? allFindings.filter(f => f.inspection_id === inspId && secZones.some(z => z.id === f.zone_id)).length
                        : 0;
                      const evaluatedCount = secZones.filter(z => z.status !== "PENDING").length;
                      const totalCount     = secZones.length;
                      return (
                        <div key={sec.id} className={`rounded-2xl border-2 overflow-hidden transition-all ${hasIssue ? "border-red-200" : allOk ? "border-green-200" : "border-slate-200"}`}>
                          <button
                            onClick={() => toggleSection(sec.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${hasIssue ? "bg-red-50/60" : allOk ? "bg-green-50/60" : "bg-slate-50"}`}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${hasIssue ? "bg-red-500 animate-pulse" : allOk ? "bg-green-500" : "bg-slate-300"}`} />
                            <span className="flex-1 font-black text-sm text-slate-800 tracking-tight">{sec.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {issueCount > 0 && <span className="text-[8px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">⚠ {issueCount}</span>}
                              {allOk && <span className="text-[8px] font-black text-green-600 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">✓ OK</span>}
                              <span className="text-xs font-black text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full ml-1">{evaluatedCount}/{totalCount} evaluadas</span>
                              <svg className={`w-4 h-4 text-slate-400 transition-transform ml-1 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 space-y-2 bg-white">
                              {secZones.length === 0
                                ? <p className="text-xs text-slate-400 text-center py-3 font-bold uppercase">Sin zonas en esta sección</p>
                                : secZones.map((zone, idx) => renderZoneRow(zone, idx))
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {unassignedZones.length > 0 && (
                      <div className="rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                          <span className="flex-1 font-black text-sm text-slate-500 tracking-tight">Sin sección asignada</span>
                          <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠ {unassignedZones.length}</span>
                        </div>
                        <div className="px-3 pb-3 pt-1 space-y-2 bg-white">
                          {unassignedZones.map((zone, idx) => renderZoneRow(zone, idx))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {(() => {
              const evaluatedZones = zones.filter(z => z.status !== "PENDING").length;
              const totalZones = zones.length;
              const allDone = pendingZones === 0;
              if (!isInspectionActive || evaluatedZones === 0) return null;
              return (
                <div className={`p-6 md:p-8 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl border-b-4 ${allDone ? "bg-slate-900 border-blue-600" : "bg-slate-800 border-green-500"}`}>
                  <div>
                    <h3 className={`text-xl md:text-2xl font-black mb-1 ${allDone ? "text-blue-400" : "text-green-400"}`}>
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

                {/* ── Resumen Ejecutivo con componente reutilizable ── */}
                <ExecutiveSummary
                  inspection={lastCompleted}
                  inspFindings={inspFindings}
                  zonesData={lastZonesData.length > 0 ? lastZonesData : zones}
                  sections={sections}
                  aiSummary={lastCompleted.summary}
                />

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
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Hallazgos Registrados</p>
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

                    {inspFindings.length === 0 ? (
                      <p className="text-slate-400 text-sm text-center py-4">Sin hallazgos registrados</p>
                    ) : (() => {
                      // Tarjeta mini de hallazgo (click abre modal)
                      const renderSummaryCard = (f: Finding) => {
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
                              {isClosed && f.closed_at && (
                                <p className="text-blue-600 text-[9px] mt-0.5 font-black">
                                  Cerrado: {new Date(f.closed_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      };

                      // Agrupar por sección > zona
                      const bySec = new Map<string, { secName: string; byZone: Map<string, { zoneName: string; findings: Finding[] }> }>();
                      for (const f of inspFindings) {
                        const sec      = sections.find(s => s.zoneIds.includes(f.zone_id || ""));
                        const secKey   = sec?.id || "__sin_seccion__";
                        const secName  = sec?.name || "Sin sección";
                        const zoneKey  = f.zone_id || "__sin_zona__";
                        const zoneName = f.zone_name || "Sin zona";
                        if (!bySec.has(secKey)) bySec.set(secKey, { secName, byZone: new Map() });
                        const secEntry = bySec.get(secKey)!;
                        if (!secEntry.byZone.has(zoneKey)) secEntry.byZone.set(zoneKey, { zoneName, findings: [] });
                        secEntry.byZone.get(zoneKey)!.findings.push(f);
                      }

                      return (
                        <div className="space-y-3">
                          {Array.from(bySec.entries()).map(([secKey, { secName, byZone }]) => {
                            const secCollapsed  = summaryCollapsedKeys.has(`sum_sec:${secKey}`);
                            const secAllF       = Array.from(byZone.values()).flatMap(({ findings: ff }) => ff);
                            const secResueltos  = secAllF.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                            const secPendientes = secAllF.length - secResueltos;
                            return (
                              <div key={secKey} className="border-2 border-indigo-100 rounded-xl overflow-hidden">
                                {/* Cabecera sección */}
                                <button
                                  onClick={() => toggleSummaryKey(`sum_sec:${secKey}`)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-50/70 hover:bg-indigo-50 transition-all"
                                >
                                  <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                                  <span className="text-xs font-black text-indigo-700 uppercase tracking-wide flex-1 text-left">{secName}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {secPendientes > 0 && <span className="text-[8px] font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{secPendientes} pend.</span>}
                                    {secResueltos  > 0 && <span className="text-[8px] font-black text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{secResueltos} resuel.</span>}
                                  </div>
                                  <svg className={`w-3.5 h-3.5 text-indigo-300 transition-transform ml-1 ${secCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {/* Zonas dentro de la sección */}
                                {!secCollapsed && (
                                  <div className="px-3 pb-3 pt-2 space-y-3 bg-white">
                                    {Array.from(byZone.entries()).map(([zoneKey, { zoneName, findings: zoneFindings }]) => {
                                      const zoneCollapsed  = summaryCollapsedKeys.has(`sum_zone:${secKey}:${zoneKey}`);
                                      const zoneResueltos  = zoneFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                                      const zonePendientes = zoneFindings.length - zoneResueltos;
                                      return (
                                        <div key={zoneKey} className="space-y-2">
                                          {/* Cabecera zona */}
                                          <button
                                            onClick={() => toggleSummaryKey(`sum_zone:${secKey}:${zoneKey}`)}
                                            className="w-full flex items-center gap-2 pl-1 group"
                                          >
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">📍 {zoneName}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {zonePendientes > 0 && <span className="text-[8px] font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{zonePendientes} pend.</span>}
                                              {zoneResueltos  > 0 && <span className="text-[8px] font-black text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{zoneResueltos} resuel.</span>}
                                            </div>
                                            <div className="h-px flex-1 bg-slate-100" />
                                            <svg className={`w-3 h-3 text-slate-300 transition-transform ${zoneCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </button>
                                          {!zoneCollapsed && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              {zoneFindings.map(f => renderSummaryCard(f))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                </>
              );
            })()}
  );
}
