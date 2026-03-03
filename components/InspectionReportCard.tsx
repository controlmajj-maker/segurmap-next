"use client";

import React, { useState } from "react";
import type { Finding, Zone, Section, Inspection } from "./types";
import { ExecutiveSummary } from "./ExecutiveSummary";

// ─── Tarjeta mini de hallazgo (compartida) ────────────────────────────────────
function FindingMiniCard({
  f,
  onView,
}: {
  f: Finding;
  onView: (f: Finding) => void;
}) {
  const isClosed = f.is_closed === true || (f as any).is_closed === "true";
  return (
    <div
      key={f.id}
      onClick={() => onView(f)}
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
}

// ─── Sección de hallazgos colapsable (compartida) ─────────────────────────────
function FindingsSection({
  inspFindings,
  sections,
  collapsedKeys,
  toggleKey,
  onViewFinding,
  keyPrefix,
}: {
  inspFindings: Finding[];
  sections: Section[];
  collapsedKeys: Set<string>;
  toggleKey: (k: string) => void;
  onViewFinding: (f: Finding) => void;
  keyPrefix: string;
}) {
  const openCount   = inspFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true").length;
  const closedCount = inspFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
  const isCollapsed = collapsedKeys.has(`${keyPrefix}:findings_section`);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header colapsable de la sección hallazgos */}
      <button
        onClick={() => toggleKey(`${keyPrefix}:findings_section`)}
        className="w-full flex items-center justify-between p-4 md:p-6 border-b border-slate-100 hover:bg-slate-50 transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hallazgos Registrados</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {openCount > 0 && (
                <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase">{openCount} ABIERTOS</span>
              )}
              {closedCount > 0 && (
                <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-lg text-[9px] font-black uppercase">{closedCount} CERRADOS</span>
              )}
              {inspFindings.length === 0 && (
                <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase">SIN HALLAZGOS</span>
              )}
            </div>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="px-4 md:px-6 pb-6 pt-4 space-y-4">
          {inspFindings.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">Sin hallazgos registrados</p>
          ) : (() => {
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
                  const secCollapsed  = collapsedKeys.has(`${keyPrefix}:sec:${secKey}`);
                  const secAllF       = Array.from(byZone.values()).flatMap(({ findings: ff }) => ff);
                  const secResueltos  = secAllF.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                  const secPendientes = secAllF.length - secResueltos;
                  return (
                    <div key={secKey} className="border-2 border-indigo-100 rounded-xl overflow-hidden">
                      <button
                        onClick={e => { e.stopPropagation(); toggleKey(`${keyPrefix}:sec:${secKey}`); }}
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

                      {!secCollapsed && (
                        <div className="px-3 pb-3 pt-2 space-y-3 bg-white">
                          {Array.from(byZone.entries()).map(([zoneKey, { zoneName, findings: zoneFindings }]) => {
                            const zoneCollapsed  = collapsedKeys.has(`${keyPrefix}:zone:${secKey}:${zoneKey}`);
                            const zoneResueltos  = zoneFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                            const zonePendientes = zoneFindings.length - zoneResueltos;
                            return (
                              <div key={zoneKey} className="space-y-2">
                                <button
                                  onClick={e => { e.stopPropagation(); toggleKey(`${keyPrefix}:zone:${secKey}:${zoneKey}`); }}
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
                                    {zoneFindings.map(f => (
                                      <FindingMiniCard key={f.id} f={f} onView={onViewFinding} />
                                    ))}
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
}

// ─── InspectionReportCard — fuente única de verdad visual ────────────────────
// Usado en CurrentView (última inspección) e HistoryView (cada auditoría).
// El header exterior (expand/collapse de la card entera) lo maneja el padre.
export function InspectionReportCard({
  inspection,
  inspFindings,
  zonesData,
  sections,
  collapsedKeys,
  toggleKey,
  onViewFinding,
  defaultCollapsed = false,
}: {
  inspection: Inspection;
  inspFindings: Finding[];
  zonesData: Zone[];
  sections: Section[];
  collapsedKeys: Set<string>;
  toggleKey: (k: string) => void;
  onViewFinding: (f: Finding) => void;
  defaultCollapsed?: boolean;
}) {
  const keyPrefix   = `report:${inspection.id}`;
  const openCount   = inspFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true").length;
  const closedCount = inspFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
  // defaultCollapsed=true → cerrada salvo que usuario la abra; false → abierta salvo que usuario la cierre
  const isCardCollapsed = defaultCollapsed
    ? !collapsedKeys.has(`${keyPrefix}:card:open`)
    : collapsedKeys.has(`${keyPrefix}:card`);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* ── Header principal: título del reporte, colapsable ── */}
      <button
        onClick={() => toggleKey(defaultCollapsed ? `${keyPrefix}:card:open` : `${keyPrefix}:card`)}
        className="w-full flex items-center justify-between p-4 md:p-6 border-b border-slate-100 hover:bg-slate-50 transition-all text-left"
      >
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white shrink-0">
            <span className="text-[9px] font-black uppercase opacity-50">
              {new Date(inspection.created_at).toLocaleString("default", { month: "short" })}
            </span>
            <span className="text-lg font-black leading-none">{new Date(inspection.created_at).getDate()}</span>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Auditoría</p>
            <h3 className="font-black text-slate-800 text-base leading-tight">{inspection.title}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase">{inspection.inspector} · {inspection.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {openCount > 0 && (
            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase">{openCount} ABIERTOS</span>
          )}
          {closedCount > 0 && (
            <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[9px] font-black uppercase">{closedCount} CERRADOS</span>
          )}
          {inspFindings.length === 0 && (
            <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase">SIN HALLAZGOS</span>
          )}
          <svg className={`w-4 h-4 text-slate-400 transition-transform ml-1 ${isCardCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Contenido: Resumen Ejecutivo + Hallazgos ── */}
      {!isCardCollapsed && (
        <div className="p-4 md:p-6 space-y-4">
          <ExecutiveSummary
            inspection={inspection}
            inspFindings={inspFindings}
            zonesData={zonesData}
            sections={sections}
            aiSummary={inspection.summary}
          />
          <FindingsSection
            inspFindings={inspFindings}
            sections={sections}
            collapsedKeys={collapsedKeys}
            toggleKey={toggleKey}
            onViewFinding={onViewFinding}
            keyPrefix={keyPrefix}
          />
        </div>
      )}
    </div>
  );
}
