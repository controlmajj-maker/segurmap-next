"use client";

import React from "react";
import type { Finding, Section } from "./types";

export function FindingsView({
  allFindings,
  activeFindings,
  closedFindings,
  sections,
  setClosureTarget,
  setViewFinding,
  setZoomImage,
  findingsCollapsedKeys,
  toggleFindingKey,
}: {
  allFindings: Finding[];
  activeFindings: Finding[];
  closedFindings: Finding[];
  sections: Section[];
  setClosureTarget: (f: Finding | null) => void;
  setViewFinding: (f: Finding | null) => void;
  setZoomImage: (url: string | null) => void;
  findingsCollapsedKeys: Set<string>;
  toggleFindingKey: (key: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">Hallazgos</h2>
        <div className="flex gap-2">
          <span className="bg-red-100 text-red-600 px-4 py-1.5 rounded-full font-black text-xs uppercase">
            {activeFindings.length} PENDIENTES
          </span>
          <span className="bg-green-100 text-green-600 px-4 py-1.5 rounded-full font-black text-xs uppercase">
            {closedFindings.length} RESUELTOS
          </span>
        </div>
      </div>

      {allFindings.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Sin hallazgos registrados</p>
        </div>
      ) : (() => {
        const isFClosed = (f: Finding) => f.is_closed === true || (f as any).is_closed === "true";

        // Tarjeta de hallazgo — pendiente en rojo, resuelto en verde
        const renderFindingCard = (f: Finding) => {
          const closed = isFClosed(f);
          return (
          <div key={f.id} className={`rounded-2xl shadow-lg border overflow-hidden flex flex-col ${closed ? "bg-green-50/40 border-green-200" : "bg-white border-slate-100"}`}>
            <div className={`p-4 border-b ${closed ? "bg-green-100/60 border-green-200" : "bg-red-50 border-red-100"}`}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {closed
                  ? <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white bg-green-600">✓ RESUELTO</span>
                  : <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${f.severity === "high" ? "bg-red-600" : f.severity === "medium" ? "bg-orange-500" : "bg-yellow-500"}`}>
                      {f.severity === "high" ? "ALTA" : f.severity === "medium" ? "MEDIA" : "BAJA"}
                    </span>
                }
                {f.zone_name && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-700 text-white">
                    📍 {f.zone_name}
                  </span>
                )}
                <span className="text-[9px] text-slate-400 font-bold ml-auto">{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              <h4 className="font-black text-slate-800 text-sm leading-tight">{f.item_label}</h4>
              {closed && f.closed_at && (
                <p className="text-xs font-black text-blue-600 mt-1">
                  Cerrado: {new Date(f.closed_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            {f.photo_url && (
              <div className="cursor-zoom-in" onClick={() => setZoomImage(f.photo_url!)}>
                <img src={f.photo_url} className="w-full h-36 object-cover border-b" alt="Evidencia" />
              </div>
            )}
            <div className="p-4 flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Observación:</p>
              <p className="text-xs text-slate-600 italic">"{f.description}"</p>
              {f.ai_analysis && (() => {
                const lines = f.ai_analysis.split("\n").filter(Boolean);
                const corrLine = lines.find(l => l.startsWith("✏️"));
                const recLine  = lines.find(l => l.startsWith("💡"));
                return (
                  <div className="mt-3 space-y-1.5">
                    {corrLine && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <p className="text-[8px] font-black text-blue-700 uppercase mb-0.5">✏️ Corrección IA:</p>
                        <p className="text-[9px] text-blue-800 leading-relaxed">{corrLine.replace("✏️ Corrección IA: ", "")}</p>
                      </div>
                    )}
                    {recLine && (
                      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2">
                        <p className="text-[8px] font-black text-cyan-700 uppercase mb-0.5">💡 Recomendación IA:</p>
                        <p className="text-[9px] text-cyan-900 leading-relaxed">{recLine.replace("💡 Recomendación: ", "")}</p>
                      </div>
                    )}
                    {!corrLine && !recLine && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Recomendación IA:</p>
                        <p className="text-[9px] text-slate-600 leading-relaxed">{f.ai_analysis}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              {closed && f.corrective_actions && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2">
                  <p className="text-[8px] font-black text-green-600 uppercase mb-0.5">✅ Acciones Correctivas:</p>
                  <p className="text-[9px] text-slate-700">{f.corrective_actions}</p>
                </div>
              )}
            </div>
            {!closed && (
              <div className="p-4 pt-0">
                <button
                  onClick={() => setClosureTarget(f)}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow hover:bg-green-700 transition-all"
                >
                  EJECUTAR CIERRE
                </button>
              </div>
            )}
          </div>
          );
        };

        // Agrupar por fecha (más reciente primero), usando TODOS los hallazgos
        const byDate = new Map<string, Finding[]>();
        const sortedFindings = [...allFindings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        for (const f of sortedFindings) {
          const dateKey = new Date(f.created_at).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          if (!byDate.has(dateKey)) byDate.set(dateKey, []);
          byDate.get(dateKey)!.push(f);
        }

        // Usa el estado del componente (hook en scope correcto)
        const collapsedKeys = findingsCollapsedKeys;
        const toggleKey = toggleFindingKey;

        return (
          <div className="space-y-6">
            {Array.from(byDate.entries()).map(([dateLabel, datefindings]) => {
              const dateCollapsed = collapsedKeys.has(`date:${dateLabel}`);
              // Dentro de cada fecha, agrupar por sección > zona
              const bySec = new Map<string, { secName: string; byZone: Map<string, { zoneName: string; findings: Finding[] }> }>();

              for (const f of datefindings) {
                const sec = sections.find(s => s.zoneIds.includes(f.zone_id || ""));
                const secKey  = sec?.id || "__sin_seccion__";
                const secName = sec?.name || "Sin sección";
                const zoneKey  = f.zone_id || "__sin_zona__";
                const zoneName = f.zone_name || "Sin zona";

                if (!bySec.has(secKey)) bySec.set(secKey, { secName, byZone: new Map() });
                const secEntry = bySec.get(secKey)!;
                if (!secEntry.byZone.has(zoneKey)) secEntry.byZone.set(zoneKey, { zoneName, findings: [] });
                secEntry.byZone.get(zoneKey)!.findings.push(f);
              }

              return (
                <div key={dateLabel} className="space-y-4">
                  {/* Cabecera de fecha — colapsable */}
                  <button
                    onClick={() => toggleKey(`date:${dateLabel}`)}
                    className="w-full flex items-center gap-3 group"
                  >
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full border border-slate-200 hover:bg-slate-200 transition-all">
                      📅 {dateLabel}
                      <span className="text-slate-400 text-[8px]">({datefindings.length})</span>
                      <svg className={`w-3 h-3 text-slate-400 transition-transform ${dateCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </button>

                  {!dateCollapsed && Array.from(bySec.entries()).map(([secKey, { secName, byZone }]) => {
                    const secCollapsed = collapsedKeys.has(`sec:${dateLabel}:${secKey}`);
                    const secAllFindings = Array.from(byZone.values()).flatMap(({ findings: ff }) => ff);
                    const secTotal    = secAllFindings.length;
                    const secResueltos = secAllFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                    const secPendientes = secTotal - secResueltos;
                    return (
                      <div key={secKey} className="space-y-3">
                        {/* Cabecera de sección — colapsable */}
                        <button
                          onClick={() => toggleKey(`sec:${dateLabel}:${secKey}`)}
                          className="w-full flex items-center gap-2 group"
                        >
                          <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                          <span className="text-xs font-black text-indigo-700 uppercase tracking-wide">{secName}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {secPendientes > 0 && <span className="text-[8px] font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{secPendientes} pend.</span>}
                            {secResueltos > 0 && <span className="text-[8px] font-black text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{secResueltos} resuel.</span>}
                            <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">{secTotal} total</span>
                          </div>
                          <div className="h-px flex-1 bg-indigo-100" />
                          <svg className={`w-3.5 h-3.5 text-indigo-300 transition-transform ${secCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {!secCollapsed && Array.from(byZone.entries()).map(([zoneKey, { zoneName, findings: zoneFindings }]) => {
                          const zoneCollapsed = collapsedKeys.has(`zone:${dateLabel}:${secKey}:${zoneKey}`);
                          const zoneResueltos  = zoneFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
                          const zonePendientes = zoneFindings.length - zoneResueltos;
                          return (
                            <div key={zoneKey} className="space-y-3">
                              {/* Cabecera de zona — colapsable */}
                              <button
                                onClick={() => toggleKey(`zone:${dateLabel}:${secKey}:${zoneKey}`)}
                                className="w-full flex items-center gap-2 pl-4 group"
                              >
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  📍 {zoneName}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {zonePendientes > 0 && <span className="text-[8px] font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{zonePendientes} pend.</span>}
                                  {zoneResueltos > 0 && <span className="text-[8px] font-black text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{zoneResueltos} resuel.</span>}
                                </div>
                                <div className="h-px flex-1 bg-slate-100" />
                                <svg className={`w-3 h-3 text-slate-300 transition-transform ${zoneCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {!zoneCollapsed && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                  {zoneFindings.map(f => renderFindingCard(f))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
