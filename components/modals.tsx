"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Zone, Finding, ZoneStatus, Severity } from "./types";
import { SAFETY_CHECKLIST } from "./constants";

// ─── New Inspection Modal ─────────────────────────────────────────────────────
export function NewInspectionModal({ onConfirm, onClose }: {
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
export function InspectionModal({ zone, inspectionId, existingFindings, onClose, onSave, onFindingSaved }: {
  zone: Zone;
  inspectionId: string;
  existingFindings: Finding[];
  onClose: () => void;
  onSave: (zoneId: string, zoneName: string, status: ZoneStatus, checklistResults: Record<string, boolean>, findings: Record<string, Finding>) => Promise<void>;
  onFindingSaved?: (zoneId: string, inspectionId: string) => Promise<void>;
}) {
  const [results, setResults] = useState<Record<string, boolean>>(zone.checklistResults || {});
  const [findings, setFindings] = useState<Record<string, Finding>>(zone.findings || {});
  const [expandedGroup, setExpandedGroup] = useState<string | null>(SAFETY_CHECKLIST[0].id);
  const [itemToReport, setItemToReport] = useState<{ id: string; label: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [viewFinding, setViewFinding] = useState<Finding | null>(null);

  useEffect(() => {
    if (Object.keys(results).length === 0) {
      const initial: Record<string, boolean> = {};
      SAFETY_CHECKLIST.forEach(g => g.items.forEach(i => { initial[i.id] = true; }));
      setResults(initial);
    }
  }, []);

  const hasAnyFail = Object.values(results).some(v => v === false) || Object.keys(findings).some(k => k.startsWith("manual_")) || existingFindings.length > 0;

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
          <button
            onClick={() => {
              const hasNewFindings = Object.keys(findings).some(k => k.startsWith("manual_") || k.startsWith("local_"));
              if (hasNewFindings) {
                setShowCloseConfirm(true);
              } else {
                onClose();
              }
            }}
            className="w-9 h-9 bg-white border rounded-xl flex items-center justify-center text-slate-400"
          >✕</button>
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
                    onClick={() => setFindingToDelete(key)}
                    className="shrink-0 w-5 h-5 bg-red-100 text-red-500 rounded-md text-[10px] flex items-center justify-center hover:bg-red-200 font-black"
                  >✕</button>
                </div>
              ))
            }

            {/* ── Hallazgos ya guardados (vienen de DB) ── */}
            {existingFindings.length > 0 && (
              <div className="mt-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Hallazgos guardados · {existingFindings.length}
                </p>
                <div className="space-y-1.5">
                  {existingFindings.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setViewFinding(f)}
                      className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-100 transition-all"
                    >
                      <span className="text-slate-400 text-sm">📋</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-700 truncate">{f.item_label}</p>
                        <p className="text-[9px] text-slate-400 italic truncate">"{f.description}"</p>
                      </div>
                      <span className={`shrink-0 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                        f.severity === "high" ? "bg-red-100 text-red-600" :
                        f.severity === "medium" ? "bg-orange-100 text-orange-600" :
                        "bg-yellow-100 text-yellow-600"
                      }`}>
                        {f.severity === "high" ? "ALTA" : f.severity === "medium" ? "MEDIA" : "BAJA"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            // Persistir inmediatamente en DB para no perder datos al refrescar
            try {
              const res = await fetch("/api/findings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...finding, zone_id: zone.id }),
              });
              const saved = await res.json();
              setFindings(prev => ({ ...prev, [key]: { ...finding, id: saved.id, created_at: saved.created_at } as Finding }));
              // Notificar a page.tsx: zona tiene hallazgo → actualizar status y contadores
              if (onFindingSaved) await onFindingSaved(zone.id, finding.inspection_id);
            } catch {
              // Fallback local si falla la red
              setFindings(prev => ({ ...prev, [key]: { ...finding, id: `local_${Date.now()}`, created_at: new Date().toISOString() } as Finding }));
            }
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

      {showCloseConfirm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border-4 border-orange-100 overflow-hidden">
            <div className="p-5 bg-orange-50 border-b text-center">
              <p className="text-2xl mb-1">⚠️</p>
              <h3 className="text-base font-black text-slate-800">¿Cerrar sin guardar?</h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                Los hallazgos que agregaste en esta sesión <span className="font-black text-red-600">se perderán</span>. Para guardarlos, regresa y da clic en <span className="font-black text-slate-800">Validar Zona</span>.
              </p>
            </div>
            <div className="p-4 flex gap-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 transition-all"
              >
                CANCELAR
              </button>
              <button
                onClick={() => { setShowCloseConfirm(false); onClose(); }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 transition-all shadow"
              >
                CERRAR SIN GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}

      {findingToDelete && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs border-4 border-red-100 overflow-hidden">
            <div className="p-5 bg-red-50 border-b text-center">
              <p className="text-2xl mb-1">🗑</p>
              <h3 className="text-base font-black text-slate-800">¿Eliminar hallazgo?</h3>
              <p className="text-slate-500 text-xs mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <div className="p-4 flex gap-2">
              <button
                onClick={() => setFindingToDelete(null)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 transition-all"
              >
                CANCELAR
              </button>
              <button
                onClick={() => {
                  const updated = { ...findings };
                  delete updated[findingToDelete];
                  setFindings(updated);
                  setFindingToDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 transition-all shadow"
              >
                ELIMINAR
              </button>
            </div>
          </div>
        </div>
      )}

      {viewFinding && (
        <FindingViewModal
          finding={viewFinding}
          onClose={() => setViewFinding(null)}
        />
      )}
    </div>
  );
}

// ─── Finding Detail Modal ─────────────────────────────────────────────────────
export function FindingDetailModal({ item, zoneName, inspectionId, existing, onSave, onClear, onCancel }: {
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

    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Upload error: ${res.status}`);
        const data = await res.json();
        photo_url = data.url;
      }
    } catch (err) {
      console.error("Error uploading photo:", err);
      // Continuar sin foto si el upload falla — no bloquear al usuario
      photo_url = existing?.photo_url || null;
    } finally {
      setIsUploading(false);
    }

    // Save finding immediately — AI analysis runs at inspection close, not per-finding
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
export function ClosureModal({ finding, sectionName, onClose, onConfirm }: {
  finding: Finding;
  sectionName?: string;
  onClose: () => void;
  onConfirm: (id: string, correctiveActions: string, closurePhotoUrl?: string) => void;
}) {
  const [actions, setActions] = useState("");
  const [zoomPhoto, setZoomPhoto] = useState(false);
  const [zoomClosurePhoto, setZoomClosurePhoto] = useState(false);

  // Closure photo state
  const [closureFile, setClosureFile] = useState<File | null>(null);
  const [closurePreview, setClosurePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const closureFileRef = useRef<HTMLInputElement>(null);

  const canSubmit = actions.trim() && closurePreview;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsUploading(true);
    let closurePhotoUrl: string | undefined;
    if (closureFile) {
      const formData = new FormData();
      formData.append("file", closureFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      closurePhotoUrl = data.url;
    }
    setIsUploading(false);
    onConfirm(finding.id, actions, closurePhotoUrl);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur flex items-center justify-center z-[120] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-4 border-green-50 overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Encabezado ── */}
        <div className="p-5 bg-green-50 border-b shrink-0">
          <span className="text-[9px] font-black uppercase text-green-600 bg-green-100 px-2 py-0.5 rounded tracking-widest">Protocolo de Cierre</span>
          {sectionName && (
            <p className="text-sm font-black text-slate-700 mt-2">
              <span className="text-slate-400 font-bold text-sm">Sección:</span> {sectionName}
            </p>
          )}
          {finding.zone_name && (
            <p className="text-sm font-black text-slate-700 mt-1">
              <span className="text-slate-400 font-bold text-sm">Zona:</span> 📍 {finding.zone_name}
            </p>
          )}
          <h3 className="text-2xl font-black text-slate-800 mt-3">Cerrar Hallazgo</h3>
        </div>

        {/* ── Cuerpo scrollable ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Descripción del hallazgo */}
          <div className="bg-slate-50 p-3 rounded-xl border">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Descripción del Hallazgo:</p>
            <p className="text-sm text-slate-700 italic">"{finding.description}"</p>
          </div>

          {/* Foto de evidencia original */}
          {finding.photo_url && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">Evidencia Original:</p>
              <div
                className="relative rounded-xl overflow-hidden border-2 border-slate-100 cursor-zoom-in"
                onClick={() => setZoomPhoto(true)}
              >
                <img src={finding.photo_url} alt="Evidencia" className="w-full max-h-48 object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-black/40 text-center py-1">
                  <p className="text-[8px] font-black text-white uppercase tracking-widest">Toca para ampliar</p>
                </div>
              </div>
            </div>
          )}

          {/* Corrección IA */}
          {(() => {
            const corrLine = finding.ai_analysis?.split("\n").find(l => l.startsWith("✏️"));
            const corrText = corrLine ? corrLine.replace("✏️ Corrección IA: ", "") : null;
            if (!corrText) return null;
            return (
              <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
                <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1.5">✏️ Corrección IA</p>
                <p className="text-xs text-blue-800 leading-relaxed">{corrText}</p>
              </div>
            );
          })()}

          {/* Recomendaciones */}
          {(() => {
            const recLine = finding.ai_analysis?.split("\n").find(l => l.startsWith("💡"));
            const recText = recLine ? recLine.replace("💡 Recomendación: ", "") : null;
            return (
              <div className={`border-2 rounded-xl p-4 ${recText ? "bg-cyan-50 border-cyan-200" : "bg-blue-50 border-blue-100"}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${recText ? "text-cyan-700" : "text-blue-600"}`}>
                  💡 Recomendación IA
                </p>
                {recText
                  ? <p className="text-xs text-cyan-900 leading-relaxed">{recText}</p>
                  : <p className="text-xs text-blue-400 italic">Sin recomendaciones disponibles por el momento.</p>
                }
              </div>
            );
          })()}

          {/* Acciones Correctivas */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Acciones Correctivas <span className="text-red-500">(Obligatorio)</span>
            </label>
            <textarea
              rows={4}
              value={actions}
              onChange={e => setActions(e.target.value)}
              placeholder="Describe cómo se solucionó el riesgo..."
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-green-500 outline-none text-sm resize-none transition-all"
            />
          </div>

          {/* Foto de cierre — OBLIGATORIA */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Evidencia de Cierre <span className="text-red-500">(Obligatoria)</span>
            </label>
            <div
              onClick={() => closureFileRef.current?.click()}
              className={`relative rounded-xl overflow-hidden border-4 border-dashed cursor-pointer transition-all ${
                closurePreview
                  ? "border-green-300"
                  : "border-slate-200 hover:border-green-400"
              }`}
            >
              {closurePreview ? (
                <div className="relative">
                  <img src={closurePreview} alt="Evidencia de cierre" className="w-full max-h-52 object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white font-black text-xs uppercase bg-black/50 px-3 py-1.5 rounded-lg">Cambiar foto</p>
                  </div>
                  <div className="absolute top-2 right-2 bg-green-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                    ✓ Foto lista
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Capturar / Subir foto</p>
                  <p className="text-[9px] text-slate-400">Evidencia de que el problema fue resuelto</p>
                </div>
              )}
              <input
                ref={closureFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setClosureFile(f);
                    const r = new FileReader();
                    r.onloadend = () => setClosurePreview(r.result as string);
                    r.readAsDataURL(f);
                  }
                }}
              />
            </div>
            {!closurePreview && (
              <p className="text-[9px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                <span>⚠</span> Se requiere foto de evidencia para validar el cierre
              </p>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-5 bg-slate-50 border-t flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-black text-xs uppercase text-slate-400">CANCELAR</button>
          <button
            disabled={!canSubmit || isUploading}
            onClick={handleConfirm}
            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white transition-all flex items-center justify-center gap-2 ${canSubmit && !isUploading ? "bg-green-600 hover:bg-green-700 shadow-lg" : "bg-slate-300"}`}
          >
            {isUploading
              ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> SUBIENDO...</>
              : "VALIDAR CIERRE"
            }
          </button>
        </div>
      </div>

      {/* Zoom foto original */}
      {zoomPhoto && finding.photo_url && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomPhoto(false)}
        >
          <img src={finding.photo_url} alt="Evidencia ampliada" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}

      {/* Zoom foto cierre */}
      {zoomClosurePhoto && closurePreview && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomClosurePhoto(false)}
        >
          <img src={closurePreview} alt="Evidencia de cierre ampliada" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
export function FindingViewModal({ finding, sectionName, onClose, onImageZoom }: {
  finding: Finding;
  sectionName?: string;
  onClose: () => void;
  onImageZoom?: (url: string) => void;
}) {
  const isClosed = finding.is_closed === true || (finding as any).is_closed === "true";
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-4 border-slate-100">
        <div className={`p-5 border-b flex justify-between items-start ${isClosed ? "bg-green-50" : "bg-red-50"}`}>
          <div className="flex-1 min-w-0 pr-3">
            {/* Status */}
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${isClosed ? "bg-green-600" : "bg-red-600"}`}>
              {isClosed ? "RESUELTO" : "PENDIENTE"}
            </span>
            {/* Sección y Zona — homologados con ClosureModal */}
            {sectionName && (
              <p className="text-sm font-black text-slate-700 mt-2">
                <span className="text-slate-400 font-bold text-sm">Sección:</span> {sectionName}
              </p>
            )}
            {finding.zone_name && (
              <p className="text-sm font-black text-slate-700 mt-1">
                <span className="text-slate-400 font-bold text-sm">Zona:</span> 📍 {finding.zone_name}
              </p>
            )}
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
                {/* Fallback: si ai_analysis tiene formato antiguo (texto plano) */}
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
              {finding.closure_photo_url && (
                <div className="mt-3">
                  <p className="text-[9px] font-black text-green-600 uppercase mb-1.5">📸 Evidencia de Cierre:</p>
                  <div
                    className="cursor-zoom-in rounded-xl overflow-hidden border-2 border-green-200 shadow-sm"
                    onClick={() => onImageZoom?.(finding.closure_photo_url!)}
                  >
                    <img src={finding.closure_photo_url} alt="Evidencia de cierre" className="w-full object-cover max-h-48" />
                    <p className="text-center text-[8px] text-green-600 py-1 bg-green-50 font-black uppercase">Toca para ampliar</p>
                  </div>
                </div>
              )}
              {finding.closed_at && (
                <p className="text-sm font-black text-blue-600 mt-2">
                  Cerrado el {new Date(finding.closed_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                </p>
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



