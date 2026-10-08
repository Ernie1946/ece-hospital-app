// Catálogos y textos del módulo médico (notas y órdenes)

export const ROLES_MEDICOS = ['medico_tratante', 'medico_residente', 'anestesiologo']
export const esMedico = (rol: string) => ROLES_MEDICOS.includes(rol)

export type CampoNota = { clave: string; titulo: string; obligatorio?: boolean; filas?: number; ayuda?: string }

// Campos de cada tipo de nota (NOM-004-SSA3-2012). Las claves coinciden con
// las que la base exige al firmar (clinico.campos_obligatorios).
export const TIPOS_NOTA: Record<string, { nombre: string; campos: CampoNota[] }> = {
  nota_evolucion: {
    nombre: 'Nota de evolución',
    campos: [
      { clave: 'evolucion', titulo: 'Evolución y estado actual', obligatorio: true, filas: 4, ayuda: 'Síntomas, cambios desde la última nota…' },
      { clave: 'exploracion_fisica', titulo: 'Exploración física', filas: 3 },
      { clave: 'resultados_estudios', titulo: 'Resultados de estudios', filas: 2 },
      { clave: 'plan', titulo: 'Plan', obligatorio: true, filas: 3 },
    ],
  },
  nota_ingreso: {
    nombre: 'Nota de ingreso',
    campos: [
      { clave: 'motivo_ingreso', titulo: 'Motivo de ingreso', obligatorio: true, filas: 2 },
      { clave: 'padecimiento_actual', titulo: 'Padecimiento actual', filas: 4 },
      { clave: 'antecedentes', titulo: 'Antecedentes de importancia', filas: 2 },
      { clave: 'exploracion_fisica', titulo: 'Exploración física', obligatorio: true, filas: 3 },
      { clave: 'resultados_estudios', titulo: 'Resultados de estudios', filas: 2 },
      { clave: 'plan', titulo: 'Plan', obligatorio: true, filas: 3 },
    ],
  },
  nota_interconsulta: {
    nombre: 'Nota de interconsulta',
    campos: [
      { clave: 'motivo_interconsulta', titulo: 'Motivo de la interconsulta', obligatorio: true, filas: 2 },
      { clave: 'exploracion_fisica', titulo: 'Exploración física', filas: 3 },
      { clave: 'resultados_estudios', titulo: 'Resultados de estudios', filas: 2 },
      { clave: 'sugerencias', titulo: 'Sugerencias', obligatorio: true, filas: 3 },
    ],
  },
}

// Nombre de cada tipo de nota médica (incluye las de anestesia)
export const NOMBRE_NOTA: Record<string, string> = {
  nota_urgencias: 'Nota de urgencias',
  nota_preoperatoria: 'Nota preoperatoria',
  nota_postoperatoria: 'Nota postoperatoria',
  nota_preanestesica: 'Nota preanestésica',
  registro_anestesico: 'Registro transanestésico',
  nota_postanestesica: 'Nota postanestésica (alta de recuperación)',
  nota_traslado: 'Nota de traslado',
  nota_preegreso: 'Nota de preegreso',
  nota_egreso: 'Nota de egreso',
  historia_clinica: 'Historia clínica',
  nota_correccion: 'Nota de corrección',
  ...Object.fromEntries(Object.entries(TIPOS_NOTA).map(([k, v]) => [k, v.nombre])),
}
export const TIPOS_NOTA_MEDICA = Object.keys(NOMBRE_NOTA)

// Orden de presentación de cualquier contenido de nota
export const TITULOS_CAMPOS: Record<string, string> = {
  motivo_ingreso: 'Motivo de ingreso',
  motivo_interconsulta: 'Motivo de la interconsulta',
  padecimiento_actual: 'Padecimiento actual',
  antecedentes: 'Antecedentes',
  evolucion: 'Evolución',
  signos_vitales: 'Signos vitales',
  exploracion_fisica: 'Exploración física',
  resultados_estudios: 'Resultados de estudios',
  diagnostico: 'Diagnóstico',
  plan: 'Plan',
  sugerencias: 'Sugerencias',
  pronostico: 'Pronóstico',
}

export const TIPO_DIAGNOSTICO: Record<string, string> = {
  principal: 'Principal',
  secundario: 'Secundario',
  ingreso: 'De ingreso',
  complicacion: 'Complicación',
  egreso: 'De egreso',
}

export const TIPO_ORDEN: Record<string, string> = {
  medicamento: 'Medicamento',
  dieta: 'Dieta',
  estudio: 'Estudio',
  cuidado_enfermeria: 'Cuidados de enfermería',
  interconsulta: 'Interconsulta',
}

export const ESTADO_ORDEN: Record<string, { texto: string; color: string }> = {
  solicitada: { texto: 'Por validar', color: 'bg-amber-100 text-amber-900' },
  validada: { texto: 'Validada', color: 'bg-sky-100 text-sky-900' },
  en_proceso: { texto: 'En curso', color: 'bg-emerald-100 text-emerald-900' },
  completada: { texto: 'Completada', color: 'bg-slate-100 text-slate-700' },
  rechazada: { texto: 'Devuelta', color: 'bg-red-100 text-red-800' },
  suspendida: { texto: 'Suspendida', color: 'bg-slate-200 text-slate-600 line-through' },
  cancelada: { texto: 'Cancelada', color: 'bg-slate-200 text-slate-600' },
  borrador: { texto: 'Borrador', color: 'bg-slate-100 text-slate-600' },
}

// Las órdenes que no son de medicamento no requieren validación de enfermería
export function estadoOrden(tipo: string, estado: string) {
  if (estado === 'solicitada' && tipo !== 'medicamento') return { texto: 'Activa', color: 'bg-emerald-100 text-emerald-900' }
  return ESTADO_ORDEN[estado] ?? { texto: estado, color: 'bg-slate-100 text-slate-700' }
}

export const PRIORIDADES: Record<string, string> = { rutina: 'Rutina', urgente: 'Urgente', inmediata: 'Inmediata' }

export const VIAS = ['IV', 'IM', 'SC', 'VO', 'SL', 'Inhalada', 'Tópica', 'Rectal', 'Oftálmica', 'Ótica']
export const FRECUENCIAS: { horas: number | null; texto: string }[] = [
  { horas: null, texto: 'Dosis única' },
  { horas: 4, texto: 'Cada 4 h' },
  { horas: 6, texto: 'Cada 6 h' },
  { horas: 8, texto: 'Cada 8 h' },
  { horas: 12, texto: 'Cada 12 h' },
  { horas: 24, texto: 'Cada 24 h' },
]

export type Medicamento = {
  id: number
  denominacion_generica: string
  concentracion: string
  forma_farmaceutica: string
  via_default: string
  unidad_dosis: string
  alto_riesgo: boolean
  grupo_controlado: string | null
}

export type Cie10 = { codigo: string; descripcion: string; afeccion_principal: boolean; notificacion_inmediata: boolean }

export type DxElegido = { cie10: string; descripcion: string; tipo: string }

export type OrdenNueva =
  | {
      tipo: 'medicamento'
      medicamento_id: number
      nombre: string
      dosis: number
      unidad: string
      via: string
      frecuencia_horas: number | null
      prn: boolean
      duracion_dias: number | null
      indicaciones: string
      prioridad: string
      justificacion_duplicado?: string
    }
  | { tipo: 'dieta' | 'estudio' | 'cuidado_enfermeria' | 'interconsulta'; descripcion: string; prioridad: string }

export function resumenOrden(o: OrdenNueva) {
  if (o.tipo !== 'medicamento') return `${TIPO_ORDEN[o.tipo]}: ${o.descripcion}`
  const frec = o.prn
    ? `PRN${o.frecuencia_horas ? ` cada ${o.frecuencia_horas} h` : ''}`
    : o.frecuencia_horas
      ? `cada ${o.frecuencia_horas} h`
      : 'dosis única'
  return `${o.nombre} · ${o.dosis} ${o.unidad} ${o.via} ${frec}${o.duracion_dias ? ` por ${o.duracion_dias} días` : ''}${
    o.indicaciones ? ` (${o.indicaciones})` : ''
  }${o.justificacion_duplicado ? ` · Duplicada: ${o.justificacion_duplicado}` : ''}`
}

// Medicamento ya ordenado y vigente en el ingreso (para detectar duplicados)
export type MedVigente = { medicamento_id: number; descripcion: string }

// Órdenes de medicamento vigentes que repiten el mismo medicamento.
// Devuelve id → justificación del médico (la de cualquiera de las órdenes del grupo) o null.
export function idsDuplicadas(ordenes: { id: string; medicamento_id: number; justificacion?: string | null }[]) {
  const grupos = new Map<number, typeof ordenes>()
  for (const o of ordenes) grupos.set(o.medicamento_id, [...(grupos.get(o.medicamento_id) ?? []), o])
  const r = new Map<string, string | null>()
  for (const g of grupos.values()) {
    if (g.length < 2) continue
    const j = g.find((o) => o.justificacion)?.justificacion ?? null
    for (const o of g) r.set(o.id, j)
  }
  return r
}
