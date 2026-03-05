"use client";

import React from "react";
import type { Finding, Inspection, Section } from "./types";
import { InspectionReportCard } from "./InspectionReportCard";

export function HistoryView({
  inspections,
  allFindings,
  activeFindings,
  sections,
  setViewFinding,
  summaryCollapsedKeys,
  toggleSummaryKey,
  onDeleteFinding,
  onUpdateFinding,
}: {
  inspections: Inspection[];
  allFindings: Finding[];
  activeFindings: Finding[];
  sections: Section[];
  setViewFinding: (f: Finding | null) => void;
  summaryCollapsedKeys: Set<string>;
  toggleSummaryKey: (key: string) => void;
  onDeleteFinding?: (id: string) => Promise<void>;
  onUpdateFinding?: (id: string, description: string, itemLabel: string) => Promise<void>;
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

          return (
            <InspectionReportCard
              key={insp.id}
              inspection={insp}
              inspFindings={inspFindings}
              zonesData={Array.isArray(insp.zones_data) && insp.zones_data.length > 0 ? insp.zones_data : []}
              sections={sections}
              collapsedKeys={summaryCollapsedKeys}
              toggleKey={toggleSummaryKey}
              onViewFinding={setViewFinding}
              defaultCollapsed={true}
              onDeleteFinding={onDeleteFinding}
              onUpdateFinding={onUpdateFinding}
            />
          );
        })
      )}
    </div>
  );
}
