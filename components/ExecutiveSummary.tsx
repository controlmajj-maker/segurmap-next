"use client";

import React from "react";
import type { Finding, Zone, Section, Inspection } from "./types";

// ─── Executive Summary Component ──────────────────────────────────────────────
// Se muestra siempre. La IA complementa, no reemplaza.
export function ExecutiveSummary({
  inspection, inspFindings, zonesData, sections, aiSummary,
}: {
  inspection: Inspection;
  inspFindings: Finding[];
  zonesData: Zone[];
  sections: Section[];
  aiSummary?: string;
}) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const toggle = (k: string) => setCollapsed(prev => {
    const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n;
  });

  const totalZones     = zonesData.length;
  const evaluatedZones = zonesData.filter(z => z.status !== "PENDING");
  const okZones        = zonesData.filter(z => z.status === "OK");
  const issueZones     = zonesData.filter(z => z.status === "ISSUE");
  const pendingZones   = zonesData.filter(z => z.status === "PENDING");
  const compliancePct  = totalZones > 0 ? Math.round((evaluatedZones.length / totalZones) * 100) : 0;
  const hasIssues      = issueZones.length > 0;
  const closedFindings = inspFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true");
  const openFindings   = inspFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true");

  // Agrupar zonas por sección para el listado
  const zoneBySec: Array<{ secName: string; zones: Zone[] }> = [];
  const assignedIds = new Set(sections.flatMap(s => s.zoneIds));
  sections.forEach(sec => {
    const secZones = sec.zoneIds.map(id => zonesData.find(z => z.id === id)).filter(Boolean) as Zone[];
    if (secZones.length > 0) zoneBySec.push({ secName: sec.name, zones: secZones });
  });
  const unassigned = zonesData.filter(z => !assignedIds.has(z.id));
  if (unassigned.length > 0) zoneBySec.push({ secName: "Sin sección", zones: unassigned });

  const statusBadge = (z: Zone) => {
    if (z.status === "OK")      return <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">✓ OK</span>;
    if (z.status === "ISSUE")   return <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">⚠ HALLAZGOS</span>;
    return <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">PENDIENTE</span>;
  };

  const isMainCollapsed = collapsed.has("main");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header del resumen — siempre visible, clic para colapsar todo */}
      <button
        onClick={() => toggle("main")}
        className="w-full flex items-center justify-between p-4 md:p-6 border-b border-slate-100 hover:bg-slate-50 transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resumen Ejecutivo</p>
            <h3 className="font-black text-slate-800 text-base leading-tight">{inspection.title}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase">{inspection.inspector} · {inspection.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${compliancePct === 100 ? "bg-green-50 text-green-700 border-green-200" : compliancePct >= 50 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
            {compliancePct}% EVALUADO
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isMainCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!isMainCollapsed && (
        <div className="p-4 md:p-6 space-y-5">

          {/* ── Dashboard de métricas ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Gauge cumplimiento */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1">
              {(() => {
                const r = 26; const cx = 32; const cy = 32;
                const circ = 2 * Math.PI * r;
                const offset = circ * (1 - compliancePct / 100);
                const color = compliancePct === 100 ? "#16a34a" : compliancePct >= 50 ? "#2563eb" : "#f97316";
                return (
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
                      strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                      transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="900" fill="#1e293b">{compliancePct}%</text>
                  </svg>
                );
              })()}
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-tight">Cobertura<br/>evaluación</p>
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3 flex flex-col items-center justify-center text-center">
              <p className="text-2xl font-black text-slate-800 leading-none">{evaluatedZones.length}<span className="text-slate-300 text-lg">/{totalZones}</span></p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-tight">Zonas<br/>evaluadas</p>
            </div>
            <div className={`rounded-2xl border p-3 flex flex-col items-center justify-center text-center ${hasIssues ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
              <p className={`text-2xl font-black leading-none ${hasIssues ? "text-red-600" : "text-green-600"}`}>{issueZones.length}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-tight">Zonas con<br/>hallazgos</p>
            </div>
            <div className={`rounded-2xl border p-3 flex flex-col items-center justify-center text-center ${pendingZones.length > 0 ? "bg-orange-50 border-orange-100" : "bg-white border-slate-100"}`}>
              <p className={`text-2xl font-black leading-none ${pendingZones.length > 0 ? "text-orange-600" : "text-slate-800"}`}>{pendingZones.length}</p>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-tight">Zonas sin<br/>revisar</p>
            </div>
          </div>

          {/* ── Texto de cumplimiento ── */}
          <div className={`rounded-2xl p-4 border-l-4 ${compliancePct === 100 ? "bg-green-50 border-green-500" : compliancePct >= 50 ? "bg-blue-50 border-blue-500" : "bg-orange-50 border-orange-500"}`}>
            <p className="text-sm font-black text-slate-800 leading-relaxed">
              La inspección realizada concluye con un cumplimiento del{" "}
              <span className={`font-black ${compliancePct === 100 ? "text-green-700" : compliancePct >= 50 ? "text-blue-700" : "text-orange-700"}`}>
                {compliancePct}%
              </span>{" "}
              en los protocolos de seguridad.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {evaluatedZones.length} de {totalZones} zona{totalZones !== 1 ? "s" : ""} evaluada{evaluatedZones.length !== 1 ? "s" : ""} ·{" "}
              {okZones.length} sin hallazgos · {issueZones.length} con hallazgos{pendingZones.length > 0 ? ` · ${pendingZones.length} sin revisar` : ""}
            </p>
          </div>

          {/* ── Lista colapsable de zonas por sección ── */}
          <div className="space-y-2">
            <button onClick={() => toggle("zones-list")} className="w-full flex items-center gap-2 group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detalle por sección y zona</span>
              <div className="h-px flex-1 bg-slate-100" />
              <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${collapsed.has("zones-list") ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!collapsed.has("zones-list") && (
              <div className="space-y-2">
                {zoneBySec.map(({ secName, zones: secZones }, si) => (
                  <div key={si} className="border-2 border-slate-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggle(`sec-${si}`)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-all text-left"
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                      <span className="flex-1 text-xs font-black text-slate-700 uppercase tracking-wide">{secName}</span>
                      <span className="text-[8px] font-black text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{secZones.length} zonas</span>
                      <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ml-1 ${collapsed.has(`sec-${si}`) ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {!collapsed.has(`sec-${si}`) && (
                      <div className="px-3 pb-2 pt-1 space-y-1 bg-white">
                        {secZones.map(z => (
                          <div key={z.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${z.status === "OK" ? "bg-green-500" : z.status === "ISSUE" ? "bg-red-500 animate-pulse" : "bg-slate-300"}`} />
                            <span className="flex-1 text-xs font-bold text-slate-700">{z.name}</span>
                            {statusBadge(z)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── No se detectaron / Sí se detectaron desviaciones ── */}
          <div className={`rounded-2xl p-4 border-2 ${hasIssues ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            {hasIssues ? (
              <>
                <p className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-1">⚠ Condiciones inseguras detectadas</p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Se detectaron condiciones inseguras y/o desviaciones en <strong>{issueZones.length}</strong> zona{issueZones.length !== 1 ? "s" : ""}: {issueZones.map(z => z.name).join(", ")}.
                  Se registraron <strong>{inspFindings.length}</strong> hallazgo{inspFindings.length !== 1 ? "s" : ""} ({openFindings.length} abierto{openFindings.length !== 1 ? "s" : ""}, {closedFindings.length} resuelto{closedFindings.length !== 1 ? "s" : ""}).
                </p>
              </>
            ) : (
              <>
                <p className="text-[9px] font-black uppercase tracking-widest text-green-700 mb-1">✓ Sin desviaciones detectadas</p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  No se detectaron desviaciones ni condiciones inseguras en las zonas evaluadas durante este recorrido.
                </p>
              </>
            )}
          </div>

          {/* ── CONCLUSIÓN ── */}
          <div className="space-y-1">
            <button onClick={() => toggle("conclusion")} className="w-full flex items-center gap-2 group">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Conclusión</span>
              <div className="h-px flex-1 bg-slate-200" />
              <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${collapsed.has("conclusion") ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!collapsed.has("conclusion") && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-700 leading-relaxed">
                  {compliancePct === 100
                    ? `Se completó el recorrido de seguridad con una cobertura del 100%. Todas las zonas fueron evaluadas el ${new Date(inspection.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}. ${hasIssues ? `Se identificaron ${inspFindings.length} hallazgo${inspFindings.length !== 1 ? "s" : ""} que requieren atención.` : "No se identificaron condiciones inseguras."}`
                    : `Se completó el recorrido de seguridad con una cobertura del ${compliancePct}% (${evaluatedZones.length} de ${totalZones} zonas) el ${new Date(inspection.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}. ${pendingZones.length} zona${pendingZones.length !== 1 ? "s quedan" : " queda"} pendiente${pendingZones.length !== 1 ? "s" : ""} de revisión. ${hasIssues ? `Se identificaron ${inspFindings.length} hallazgo${inspFindings.length !== 1 ? "s" : ""} en las zonas evaluadas.` : "No se identificaron condiciones inseguras en las zonas evaluadas."}`
                  }
                </p>
              </div>
            )}
          </div>

          {/* ── Resumen IA — complementario, solo si existe ── */}
          {aiSummary && (
            <div className="space-y-1">
              <button onClick={() => toggle("ai-summary")} className="w-full flex items-center gap-2 group">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">🤖 Análisis IA Adicional</span>
                <div className="h-px flex-1 bg-blue-100" />
                <svg className={`w-3.5 h-3.5 text-blue-300 transition-transform ${collapsed.has("ai-summary") ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!collapsed.has("ai-summary") && (
                <div className="bg-slate-800 rounded-2xl p-4 text-white">
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{aiSummary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
