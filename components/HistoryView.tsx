"use client";

import React from "react";
import type { Finding, Inspection, Section } from "./types";
import { ExecutiveSummary } from "./ExecutiveSummary";

export function HistoryView({
  inspections,
  allFindings,
  activeFindings,
  sections,
  expandedInspectionId,
  setExpandedInspectionId,
  setViewFinding,
  summaryCollapsedKeys,
  toggleSummaryKey,
}: {
  inspections: Inspection[];
  allFindings: Finding[];
  activeFindings: Finding[];
  sections: Section[];
  expandedInspectionId: string | null;
  setExpandedInspectionId: (id: string | null) => void;
  setViewFinding: (f: Finding | null) => void;
  summaryCollapsedKeys: Set<string>;
  toggleSummaryKey: (key: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">Historial de Auditorías</h2>

      {/* Stats: Auditorías totales + Hallazgos abiertos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center justify-center text-center">
          <p className="text-3xl font-black text-slate-800 leading-none">{inspections.filter((i: any) => !i.is_active).length}</p>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-tight">Auditorías<br/>totales</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 flex flex-col items-center justify-center text-center ${activeFindings.length > 0 ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`}>
          <p className={`text-3xl font-black leading-none ${activeFindings.length > 0 ? "text-red-600" : "text-slate-800"}`}>{activeFindings.length}</p>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-tight">Hallazgos<br/>abiertos</p>
        </div>
      </div>

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
                  {/* ── Resumen Ejecutivo reutilizable ── */}
                  <ExecutiveSummary
                    inspection={insp}
                    inspFindings={inspFindings}
                    zonesData={Array.isArray(insp.zones_data) && insp.zones_data.length > 0 ? insp.zones_data : []}
                    sections={sections}
                    aiSummary={insp.summary}
                  />

                  {inspFindings.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">Sin hallazgos registrados</p>
                  ) : (() => {
                    // Tarjeta mini de hallazgo
                    const renderHistCard = (f: Finding) => {
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

                    // Estado de colapso por inspección (prefijo con insp.id para no mezclar entre auditorías)
                    const inspPrefix = `hist:${insp.id}`;

                    return (
                      <div className="space-y-3">
                        {Array.from(bySec.entries()).map(([secKey, { secName, byZone }]) => {
                          const secCollapsed  = summaryCollapsedKeys.has(`${inspPrefix}:sec:${secKey}`);
                          const secAllF       = Array.from(byZone.values()).flatMap(({ findings: ff }) => ff);
                          const secResueltos  = secAllF.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                          const secPendientes = secAllF.length - secResueltos;
                          return (
                            <div key={secKey} className="border-2 border-indigo-100 rounded-xl overflow-hidden">
                              {/* Cabecera sección */}
                              <button
                                onClick={e => { e.stopPropagation(); toggleSummaryKey(`${inspPrefix}:sec:${secKey}`); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-50/70 hover:bg-indigo-50 transition-all"
                              >
                                <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                                <span className="text-xs font-black text-indigo-700 uppercase tracking-wide flex-1 text-left">{secName}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {secPendientes > 0 && <span className="text-[8px] font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{secPendientes} pend.</span>}
                                  {secResueltos  > 0 && <span className="text-[8px] font-black text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{secResueltos} resuel.</span>}
                                  <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">{secAllF.length} total</span>
                                </div>
                                <svg className={`w-3.5 h-3.5 text-indigo-300 transition-transform ml-1 ${secCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {/* Zonas dentro de la sección */}
                              {!secCollapsed && (
                                <div className="px-3 pb-3 pt-2 space-y-3 bg-white">
                                  {Array.from(byZone.entries()).map(([zoneKey, { zoneName, findings: zoneFindings }]) => {
                                    const zoneCollapsed  = summaryCollapsedKeys.has(`${inspPrefix}:zone:${secKey}:${zoneKey}`);
                                    const zoneResueltos  = zoneFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                                    const zonePendientes = zoneFindings.length - zoneResueltos;
                                    return (
                                      <div key={zoneKey} className="space-y-2">
                                        {/* Cabecera zona */}
                                        <button
                                          onClick={e => { e.stopPropagation(); toggleSummaryKey(`${inspPrefix}:zone:${secKey}:${zoneKey}`); }}
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
                                            {zoneFindings.map(f => renderHistCard(f))}
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
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
