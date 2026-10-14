// Privilegios clínicos (credencialización): catálogo, textos y utilidades

export const GRUPO_PRIVILEGIO: Record<string, string> = {
  unidad: 'Unidades y gabinetes',
  hemodinamia: 'Hemodinamia',
  quirurgico: 'Quirúrgicos',
  anestesia: 'Anestesiología',
}

export const AUTORIZADO_POR: Record<string, string> = {
  ambos: 'Dirección Médica y Comité de Credenciales',
  comite_credenciales: 'Comité de Credenciales',
  direccion_medica: 'Dirección Médica',
}

export const TIPO_ESPECIALIDAD: Record<string, string> = {
  especialidad: 'Especialidad',
  subespecialidad: 'Subespecialidad',
  alta_especialidad: 'Curso de alta especialidad',
}

export const ESTADO_PRIVILEGIO: Record<string, { texto: string; color: string }> = {
  vigente: { texto: 'Vigente', color: 'bg-emerald-100 text-emerald-900' },
  por_vencer: { texto: 'Por vencer', color: 'bg-amber-100 text-amber-900' },
  vencido: { texto: 'Vencido', color: 'bg-red-100 text-red-900' },
  revocado: { texto: 'Revocado', color: 'bg-slate-200 text-slate-600 line-through' },
}

export type Privilegio = { clave: string; nombre: string; grupo: string; cie9_rangos: string | null; descripcion: string | null }

export type PrivilegioMedico = {
  id: string
  usuario_id: string
  medico: string
  usuario: string
  clave: string
  privilegio: string
  grupo: string
  cie9_rangos: string | null
  autorizado_por: string
  acta: string
  fecha_autorizacion: string
  vigencia_hasta: string | null
  restricciones: string | null
  otorgado_en: string
  otorgado_por_nombre: string | null
  revocado_en: string | null
  motivo_revocacion: string | null
  estado: string
}

export type Especialidad = { id: string; usuario_id: string; tipo: string; nombre: string; cedula: string | null; institucion: string | null }

// ¿El código CIE-9-MC (p. ej. "51.23") cae en los capítulos del privilegio ("42-54, 85-86")?
export function cie9EnRangos(codigo: string | null | undefined, rangos: string | null | undefined) {
  const cap = Number.parseInt((codigo ?? '').trim().slice(0, 2), 10)
  if (Number.isNaN(cap) || !rangos) return false
  return rangos.split(',').some((r) => {
    const [a, b] = r.split('-').map((x) => Number.parseInt(x.trim(), 10))
    return !Number.isNaN(a) && cap >= a && cap <= (Number.isNaN(b) ? a : b)
  })
}

// ---------------------------------------------------------------------
// Carga desde Excel (hojas "Privilegios" y "Especialidades")
// ---------------------------------------------------------------------
export type FilaPrivilegio = {
  fila: number
  usuario?: string
  privilegios?: string
  autorizado_por?: string
  acta?: string
  fecha?: string | null
  vigencia?: string | null
  restricciones?: string
  accion?: string
  motivo?: string
}
export type FilaEspecialidad = { fila: number; usuario?: string; tipo?: string; nombre?: string; cedula?: string; institucion?: string }
export type RevisionFila = { fila: number; usuario: string; medico: string | null; accion: string; detalle: string | null; errores: string | null }

const llano = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

function fechaTexto(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const t = String(v ?? '').trim()
  if (!t) return null
  const dmy = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return t // la base dirá si no es válida
}

function autorizo(v: unknown) {
  const s = llano(v)
  if (!s) return ''
  if (s.startsWith('ambos') || (s.includes('comite') && s.includes('direccion'))) return 'ambos'
  if (s.includes('comite')) return 'comite_credenciales'
  if (s.includes('direccion') || s.includes('medica')) return 'direccion_medica'
  return s
}
function accionDe(v: unknown) {
  const s = llano(v)
  if (!s || s.startsWith('otorg') || s === 'alta' || s === 'nuevo') return 'otorgar'
  if (s.startsWith('renov')) return 'renovar'
  if (s.startsWith('revoc') || s === 'baja' || s.startsWith('suspend')) return 'revocar'
  return s
}
function tipoEspecialidad(v: unknown) {
  const s = llano(v)
  if (!s || s === 'especialidad') return 'especialidad'
  if (s.startsWith('sub')) return 'subespecialidad'
  if (s.includes('alta')) return 'alta_especialidad'
  return s
}

function tabla(hoja: unknown[][], titulos: Record<string, string[]>) {
  const indice = hoja.findIndex((f) => f.some((c) => llano(c) === 'usuario'))
  if (indice < 0) return null
  const cab = hoja[indice].map(llano)
  const col: Record<string, number> = {}
  for (const [clave, alias] of Object.entries(titulos)) {
    const i = cab.findIndex((t) => alias.some((a) => t === a || t.startsWith(a)))
    if (i >= 0) col[clave] = i
  }
  const filas: { numero: number; v: Record<string, unknown> }[] = []
  hoja.slice(indice + 1).forEach((f, i) => {
    if (!f.some((c) => String(c ?? '').trim() !== '')) return
    const v: Record<string, unknown> = {}
    for (const [clave, i2] of Object.entries(col)) v[clave] = f[i2]
    filas.push({ numero: indice + i + 2, v })
  })
  return { col, filas }
}
const txt = (v: unknown) => (v instanceof Date ? fechaTexto(v) ?? '' : String(v ?? '').trim())

export function interpretarPrivilegios(hoja: unknown[][]): { filas: FilaPrivilegio[]; avisos: string[] } {
  const t = tabla(hoja, {
    usuario: ['usuario'],
    privilegios: ['privilegios', 'claves'],
    autorizado_por: ['autorizo', 'autorizado'],
    acta: ['acta'],
    fecha: ['fecha de autorizacion', 'fecha'],
    vigencia: ['vigente hasta', 'vigencia'],
    restricciones: ['restricciones'],
    accion: ['accion'],
    motivo: ['motivo'],
  })
  if (!t) return { filas: [], avisos: ['En la hoja "Privilegios" no encontré la columna "Usuario". Usa la plantilla.'] }
  const avisos = t.col.privilegios === undefined ? ['Falta la columna "Privilegios (claves)".'] : []
  const filas = t.filas.map(({ numero, v }) => ({
    fila: numero,
    usuario: txt(v.usuario).toLowerCase(),
    privilegios: txt(v.privilegios).toUpperCase(),
    autorizado_por: autorizo(v.autorizado_por),
    acta: txt(v.acta),
    fecha: fechaTexto(v.fecha),
    vigencia: fechaTexto(v.vigencia),
    restricciones: txt(v.restricciones),
    accion: accionDe(v.accion),
    motivo: txt(v.motivo),
  }))
  if (filas.length > 3000) avisos.push('Más de 3,000 filas: divide el archivo.')
  return { filas: filas.slice(0, 3000), avisos }
}

export function interpretarEspecialidades(hoja: unknown[][]): { filas: FilaEspecialidad[]; avisos: string[] } {
  const t = tabla(hoja, {
    usuario: ['usuario'],
    tipo: ['tipo'],
    nombre: ['especialidad', 'nombre'],
    cedula: ['cedula'],
    institucion: ['institucion'],
  })
  if (!t) return { filas: [], avisos: ['En la hoja "Especialidades" no encontré la columna "Usuario".'] }
  const filas = t.filas.map(({ numero, v }) => ({
    fila: numero,
    usuario: txt(v.usuario).toLowerCase(),
    tipo: tipoEspecialidad(v.tipo),
    nombre: txt(v.nombre),
    cedula: txt(v.cedula),
    institucion: txt(v.institucion),
  }))
  return { filas: filas.slice(0, 3000), avisos: filas.length > 3000 ? ['Más de 3,000 filas: divide el archivo.'] : [] }
}

export const ACCION_REVISION: Record<string, { texto: string; color: string }> = {
  otorgar: { texto: 'Otorgar', color: 'bg-emerald-100 text-emerald-900' },
  renovar: { texto: 'Renovar', color: 'bg-sky-100 text-sky-900' },
  revocar: { texto: 'Revocar', color: 'bg-amber-100 text-amber-900' },
  agregar: { texto: 'Agregar', color: 'bg-emerald-100 text-emerald-900' },
  sin_cambios: { texto: 'Sin cambio', color: 'bg-slate-100 text-slate-600' },
  error: { texto: 'Error', color: 'bg-red-100 text-red-900' },
}
