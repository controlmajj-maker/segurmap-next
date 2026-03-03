import type { ChecklistGroup, Zone, ZoneStatus } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
export const SAFETY_CHECKLIST: ChecklistGroup[] = [
  { id: "nom-001", title: "NOM-001: Condiciones del lugar", items: [
    { id: "c1", label: "Edificios e instalaciones libres de daños estructurales" },
    { id: "c2", label: "Pasillos y salidas libres de obstrucciones" },
    { id: "c3", label: "Iluminación suficiente" },
    { id: "c4", label: "Pisos en buen estado (sin derrames, hoyos, desniveles)" },
    { id: "c5", label: "Señalización clara y visible" },
    { id: "c6", label: "Orden y limpieza general" },
  ]},
  { id: "nom-002", title: "NOM-002: Protección contra incendios", items: [
    { id: "f1", label: "Extintores vigentes, señalizados, visibles y de fácil acceso" },
    { id: "f2", label: "Rutas de evacuación y salidas de emergencia despejadas" },
    { id: "f3", label: "Sistema de alarma accesible y sin obstrucciones" },
    { id: "f4", label: "Botiquín disponible y completo" },
  ]},
  { id: "nom-004", title: "NOM-004/006/029: Maquinaria y Equipos", items: [
    { id: "m1", label: "Guardas y protecciones instaladas en máquinas" },
    { id: "m2", label: "Mantenimiento visible y vigente" },
    { id: "m3", label: "Equipos de manejo de cargas verificados" },
    { id: "m4", label: "Herramientas adecuadas para la tarea" },
    { id: "m5", label: "Riesgos eléctricos controlados (tableros etiquetados)" },
    { id: "m6", label: "Instalaciones eléctricas en buen estado" },
  ]},
  { id: "nom-017", title: "NOM-017: Equipo de Protección Personal", items: [
    { id: "p1", label: "Uso adecuado de EPP de acuerdo al área" },
    { id: "p2", label: "EPP disponible y en buen estado" },
    { id: "p3", label: "Señalización de EPP obligatorio" },
  ]},
  { id: "nom-026", title: "NOM-026: Señalización y Colores", items: [
    { id: "s1", label: "Señales visibles de acuerdo a colores estandarizados" },
    { id: "s2", label: "Tubería indica claramente nombre y dirección del fluido" },
  ]},
  { id: "otros", title: "Otros", items: [
    { id: "o1", label: "Observaciones adicionales de seguridad" },
  ]},
];

export const INITIAL_ZONES: Zone[] = [
  { id: "z1", name: "Almacén",      status: "PENDING" as ZoneStatus, x: 5,  y: 5,  width: 38, height: 42, findings: {} },
  { id: "z2", name: "Producción",   status: "PENDING" as ZoneStatus, x: 48, y: 5,  width: 47, height: 42, findings: {} },
  { id: "z3", name: "Mantenimiento",status: "PENDING" as ZoneStatus, x: 5,  y: 52, width: 38, height: 42, findings: {} },
  { id: "z4", name: "Oficinas",     status: "PENDING" as ZoneStatus, x: 48, y: 52, width: 47, height: 42, findings: {} },
];
