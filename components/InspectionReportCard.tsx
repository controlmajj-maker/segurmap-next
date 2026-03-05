"use client";

import React, { useState } from "react";
import type { Finding, Zone, Section, Inspection } from "./types";
import { ExecutiveSummary } from "./ExecutiveSummary";

// ─── Tarjeta mini de hallazgo (compartida) ────────────────────────────────────
function FindingMiniCard({
  f,
  onView,
  editMode,
  onRequestDelete,
}: {
  f: Finding;
  onView: (f: Finding) => void;
  editMode?: boolean;
  onRequestDelete?: (f: Finding) => void;
}) {
  const isClosed = f.is_closed === true || (f as any).is_closed === "true";
  return (
    <div
      className={`rounded-xl border-2 transition-all overflow-hidden ${
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
        {/* Botones de acción: ver siempre, eliminar solo en editMode */}
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => onView(f)}
            className="flex-1 py-1.5 text-[9px] font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
          >
            Ver detalle
          </button>
          {editMode && onRequestDelete && (
            <button
              onClick={() => onRequestDelete(f)}
              className="py-1.5 px-2.5 text-[9px] font-black uppercase bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all"
            >
              🗑 Eliminar
            </button>
          )}
        </div>
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
  editMode,
  onRequestDelete,
}: {
  inspFindings: Finding[];
  sections: Section[];
  collapsedKeys: Set<string>;
  toggleKey: (k: string) => void;
  onViewFinding: (f: Finding) => void;
  keyPrefix: string;
  editMode?: boolean;
  onRequestDelete?: (f: Finding) => void;
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
              {editMode && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[9px] font-black uppercase">✏️ MODO EDICIÓN</span>
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
                                      <FindingMiniCard
                                        key={f.id}
                                        f={f}
                                        onView={onViewFinding}
                                        editMode={editMode}
                                        onRequestDelete={onRequestDelete}
                                      />
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
  onDeleteFinding,
  onUpdateFinding,
}: {
  inspection: Inspection;
  inspFindings: Finding[];
  zonesData: Zone[];
  sections: Section[];
  collapsedKeys: Set<string>;
  toggleKey: (k: string) => void;
  onViewFinding: (f: Finding) => void;
  defaultCollapsed?: boolean;
  onDeleteFinding?: (id: string) => Promise<void>;
  onUpdateFinding?: (id: string, description: string, itemLabel: string) => Promise<void>;
}) {
  const keyPrefix   = `report:${inspection.id}`;
  const openCount   = inspFindings.filter(f => f.is_closed !== true && (f as any).is_closed !== "true").length;
  const closedCount = inspFindings.filter(f => f.is_closed === true || (f as any).is_closed === "true").length;
  const isCardCollapsed = defaultCollapsed
    ? !collapsedKeys.has(`${keyPrefix}:card:open`)
    : collapsedKeys.has(`${keyPrefix}:card`);

  // ── Edit mode state (local to this card) ──
  const [showAuthModal, setShowAuthModal]   = useState(false);
  const [authPassword, setAuthPassword]     = useState("");
  const [authError, setAuthError]           = useState(false);
  const [editMode, setEditMode]             = useState(false);

  // ── Delete finding state ──
  const [findingToDelete, setFindingToDelete] = useState<Finding | null>(null);
  const [deleteWord, setDeleteWord]           = useState("");
  const [isDeleting, setIsDeleting]           = useState(false);

  const handleConfirmDelete = async () => {
    if (!findingToDelete || deleteWord !== "BORRAR" || !onDeleteFinding) return;
    setIsDeleting(true);
    await onDeleteFinding(findingToDelete.id);
    setIsDeleting(false);
    setFindingToDelete(null);
    setDeleteWord("");
  };

  // onViewFinding wrapper: pass editMode + onUpdateFinding context via a synthetic finding object extension
  // We use a closure to inject editMode into the view modal via page.tsx state
  // The cleanest approach: wrap onViewFinding to also carry editMode signal — but FindingViewModal
  // receives finding + onUpdateFinding separately. So we lift: when editMode, open a local view modal instead.
  const [localViewFinding, setLocalViewFinding] = useState<Finding | null>(null);

  const handleViewFinding = (f: Finding) => {
    if (editMode) {
      // In edit mode, open local modal that has edit capability
      setLocalViewFinding(f);
    } else {
      onViewFinding(f);
    }
  };

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
          {/* Botón de edición — no propaga el click al collapse */}
          {onDeleteFinding && (
            <span
              onClick={e => {
                e.stopPropagation();
                if (editMode) {
                  setEditMode(false);
                } else {
                  setAuthPassword(""); setAuthError(false); setShowAuthModal(true);
                }
              }}
              className={`cursor-pointer px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${
                editMode
                  ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
              }`}
            >
              {editMode ? "✓ SALIR EDICIÓN" : "✏️ EDITAR"}
            </span>
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
            onViewFinding={handleViewFinding}
            keyPrefix={keyPrefix}
            editMode={editMode}
            onRequestDelete={onDeleteFinding ? (f) => { setFindingToDelete(f); setDeleteWord(""); } : undefined}
          />
        </div>
      )}

      {/* ── Modal contraseña para habilitar edición ── */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4" onClick={() => setShowAuthModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-slate-50 border-b text-center">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-800">Habilitar Edición</h3>
              <p className="text-slate-500 text-sm mt-1">Introduce la contraseña de admin para editar esta auditoría</p>
            </div>
            <div className="p-6 space-y-4">
              <input
                autoFocus
                type="password"
                value={authPassword}
                onChange={e => { setAuthPassword(e.target.value); setAuthError(false); }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    if (authPassword === "admin") { setEditMode(true); setShowAuthModal(false); }
                    else setAuthError(true);
                  }
                }}
                placeholder="Contraseña"
                className={`w-full px-4 py-3 bg-slate-50 border-2 rounded-xl text-center font-black text-lg tracking-widest outline-none transition-all ${authError ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-slate-900"}`}
              />
              {authError && <p className="text-red-500 text-[10px] font-black uppercase text-center">Contraseña incorrecta</p>}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowAuthModal(false)} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
              <button
                onClick={() => {
                  if (authPassword === "admin") { setEditMode(true); setShowAuthModal(false); }
                  else setAuthError(true);
                }}
                className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-black shadow-lg"
              >INGRESAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminar hallazgo ── */}
      {findingToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-4 border-red-200 overflow-hidden">
            <div className="p-6 bg-red-600 text-white text-center">
              <p className="text-4xl mb-2">🗑</p>
              <h3 className="text-xl font-black">¿Eliminar hallazgo?</h3>
              <p className="text-red-100 text-sm mt-1 font-bold truncate px-4">"{findingToDelete.item_label}"</p>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-500 text-center">Se eliminará el hallazgo completo incluyendo foto y análisis IA. Esta acción no se puede deshacer.</p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Escribe <span className="text-red-600 font-black">BORRAR</span> para confirmar
                </label>
                <input
                  autoFocus
                  value={deleteWord}
                  onChange={e => setDeleteWord(e.target.value)}
                  placeholder="BORRAR"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-black text-lg tracking-widest focus:border-red-400 outline-none"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setFindingToDelete(null); setDeleteWord(""); }} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CANCELAR</button>
              <button
                disabled={deleteWord !== "BORRAR" || isDeleting}
                onClick={handleConfirmDelete}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white ${deleteWord === "BORRAR" && !isDeleting ? "bg-red-600 hover:bg-red-700 shadow" : "bg-slate-300"}`}
              >
                {isDeleting ? "ELIMINANDO..." : "ELIMINAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ver hallazgo en modo edición (con edición de texto) ── */}
      {localViewFinding && onUpdateFinding && (
        <EditableFindingViewModal
          finding={localViewFinding}
          sectionName={sections.find(s => s.zoneIds.includes(localViewFinding.zone_id || ""))?.name}
          onClose={() => setLocalViewFinding(null)}
          onSave={async (description, itemLabel) => {
            await onUpdateFinding(localViewFinding.id, description, itemLabel);
            setLocalViewFinding(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal de hallazgo editable (solo se muestra en modo edición) ─────────────
function EditableFindingViewModal({
  finding,
  sectionName,
  onClose,
  onSave,
}: {
  finding: Finding;
  sectionName?: string;
  onClose: () => void;
  onSave: (description: string, itemLabel: string) => Promise<void>;
}) {
  const isClosed = finding.is_closed === true || (finding as any).is_closed === "true";
  const [isEditing, setIsEditing]     = useState(false);
  const [description, setDescription] = useState(finding.description);
  const [itemLabel, setItemLabel]     = useState(finding.item_label);
  const [isSaving, setIsSaving]       = useState(false);

  const handleSave = async () => {
    if (!description.trim() || !itemLabel.trim()) return;
    setIsSaving(true);
    await onSave(description.trim(), itemLabel.trim());
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur flex items-center justify-center z-[250] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-4 border-amber-100">
        <div className={`p-5 border-b flex justify-between items-start ${isClosed ? "bg-green-50" : "bg-red-50"}`}>
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${isClosed ? "bg-green-600" : "bg-red-600"}`}>
                {isClosed ? "RESUELTO" : "PENDIENTE"}
              </span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">✏️ MODO EDICIÓN</span>
            </div>
            {sectionName && <p className="text-sm font-black text-slate-700 mt-2"><span className="text-slate-400 font-bold text-sm">Sección:</span> {sectionName}</p>}
            {finding.zone_name && <p className="text-sm font-black text-slate-700 mt-1"><span className="text-slate-400 font-bold text-sm">Zona:</span> 📍 {finding.zone_name}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-slate-400 shrink-0">✕</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Título / item_label editable */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hallazgo:</p>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg hover:bg-amber-100 transition-all"
                >✏️ Editar</button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  value={itemLabel}
                  onChange={e => setItemLabel(e.target.value)}
                  placeholder="Título del hallazgo"
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-amber-300 rounded-xl text-sm font-black outline-none focus:border-amber-500"
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Descripción del hallazgo"
                  className="w-full px-3 py-2.5 bg-slate-50 border-2 border-amber-300 rounded-xl text-sm outline-none focus:border-amber-500 resize-none"
                />
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-slate-300">
                <p className="text-xs font-black text-slate-700 mb-1">{itemLabel}</p>
                <p className="text-sm text-slate-700 italic">"{description}"</p>
              </div>
            )}
          </div>

          {finding.photo_url && (
            <div className="rounded-xl overflow-hidden border-4 border-slate-50 shadow">
              <img src={finding.photo_url} alt="Evidencia" className="w-full object-cover max-h-56" />
            </div>
          )}

          {finding.ai_analysis && (() => {
            const lines = finding.ai_analysis.split("\n").filter(Boolean);
            const corrLine = lines.find(l => l.startsWith("✏️"));
            const recLine  = lines.find(l => l.startsWith("💡"));
            return (
              <div className="space-y-2">
                {corrLine && (
                  <div className="bg-blue-50 border-2 border-blue-200 p-3 rounded-xl">
                    <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1">✏️ Corrección IA</p>
                    <p className="text-xs text-blue-800 leading-relaxed">{corrLine.replace("✏️ Corrección IA: ", "")}</p>
                  </div>
                )}
                {recLine && (
                  <div className="bg-cyan-50 border-2 border-cyan-200 p-3 rounded-xl">
                    <p className="text-[9px] font-black text-cyan-700 uppercase tracking-widest mb-1">💡 Recomendación IA</p>
                    <p className="text-xs text-cyan-900 leading-relaxed">{recLine.replace("💡 Recomendación: ", "")}</p>
                  </div>
                )}
                {!corrLine && !recLine && (
                  <div className="bg-slate-50 border-2 border-slate-200 p-3 rounded-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">🤖 Análisis IA:</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{finding.ai_analysis}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {isClosed && finding.corrective_actions && (
            <div className="bg-green-50 p-4 rounded-xl border-2 border-green-100">
              <p className="text-[9px] font-black text-green-600 uppercase mb-1">✅ Acciones Correctivas:</p>
              <p className="text-sm text-slate-700">{finding.corrective_actions}</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500">CERRAR</button>
          {isEditing && (
            <button
              disabled={!description.trim() || !itemLabel.trim() || isSaving}
              onClick={handleSave}
              className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white transition-all ${description.trim() && itemLabel.trim() && !isSaving ? "bg-amber-500 hover:bg-amber-600 shadow" : "bg-slate-300"}`}
            >
              {isSaving ? "GUARDANDO..." : "💾 GUARDAR CAMBIOS"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


