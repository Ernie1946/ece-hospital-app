// Farmacia: estados de cada dosis unitaria y formato del catálogo para importar

export const ESTADO_DOSIS: Record<string, { texto: string; color: string }> = {
  programada: { texto: 'Por preparar', color: 'bg-slate-100 text-slate-700' },
  preparada: { texto: 'Preparada', color: 'bg-sky-100 text-sky-900' },
  enviada: { texto: 'En tubo', color: 'bg-violet-100 text-violet-900' },
  recibida: { texto: 'En piso', color: 'bg-amber-100 text-amber-900' },
  administrada: { texto: 'Administrada', color: 'bg-emerald-100 text-emerald-900' },
  omitida: { texto: 'Omitida', color: 'bg-red-100 text-red-800' },
  devuelta: { texto: 'Devuelta', color: 'bg-slate-200 text-slate-700' },
  cancelada: { texto: 'Cancelada', color: 'bg-slate-200 text-slate-500 line-through' },
}

export const horaCorta = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', {
        timeZone: 'America/Chihuahua',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—'

export const cantidad = (n: number | string | null | undefined) =>
  n === null || n === undefined ? '' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 3 })

// ---------------------------------------------------------------------
// Plantilla de Excel del catálogo de medicamentos.
// Primera fila = encabezados (se aceptan sin acentos y en mayúsculas).
// ---------------------------------------------------------------------
export type FilaCatalogo = {
  fila: number
  clave: string
  generico: string
  comercial?: string
  forma: string
  concentracion: string
  presentacion?: string
  via: string
  unidad: string
  dosis_max_dia?: number | null
  controlado?: string
  alto_riesgo?: string
  precio: number | null
  activo?: string
  lote?: string
  caducidad?: string | null
  existencia?: number | null
}

export const COLUMNAS_CATALOGO: { clave: keyof FilaCatalogo; titulo: string; obligatoria?: boolean; nota: string }[] = [
  { clave: 'clave', titulo: 'Clave', obligatoria: true, nota: 'Clave interna o del Compendio Nacional; si ya existe, se actualiza' },
  { clave: 'generico', titulo: 'Denominación genérica', obligatoria: true, nota: 'Ej. Ceftriaxona' },
  { clave: 'comercial', titulo: 'Nombre comercial', nota: 'Opcional' },
  { clave: 'forma', titulo: 'Forma farmacéutica', obligatoria: true, nota: 'Ej. Solución inyectable, tableta' },
  { clave: 'concentracion', titulo: 'Concentración', obligatoria: true, nota: 'Ej. 1 g, 40 mg / 0.4 mL' },
  { clave: 'presentacion', titulo: 'Presentación', nota: 'Ej. Frasco ámpula, caja con 10 tabletas' },
  { clave: 'via', titulo: 'Vía', obligatoria: true, nota: 'IV, IM, SC, VO, SL, INH, TOP, RECTAL…' },
  { clave: 'unidad', titulo: 'Unidad de dosis', obligatoria: true, nota: 'Unidad en que el médico ordena: mg, g, mcg, UI, mEq, mL' },
  { clave: 'dosis_max_dia', titulo: 'Dosis máxima al día', nota: 'En la unidad de dosis; vacío = sin tope. Bloquea órdenes que la excedan' },
  { clave: 'controlado', titulo: 'Grupo controlado', nota: 'I, II o III (vacío si no es controlado)' },
  { clave: 'alto_riesgo', titulo: 'Alto riesgo', nota: 'Sí / No. Exige doble verificación al administrar' },
  { clave: 'precio', titulo: 'Precio', obligatoria: true, nota: 'Precio por dosis unitaria que se carga a la cuenta' },
  { clave: 'activo', titulo: 'Activo', nota: 'Sí / No (vacío = Sí)' },
  { clave: 'lote', titulo: 'Lote', nota: 'Opcional: carga inicial de inventario' },
  { clave: 'caducidad', titulo: 'Caducidad', nota: 'Fecha del lote' },
  { clave: 'existencia', titulo: 'Existencia', nota: 'Unidades del lote' },
]

const sinAcentos = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Encabezado del Excel → clave de columna
export function columnaDeEncabezado(titulo: unknown): keyof FilaCatalogo | null {
  if (typeof titulo !== 'string') return null
  const t = sinAcentos(titulo)
  const alias: Record<string, keyof FilaCatalogo> = {
    generico: 'generico',
    'nombre generico': 'generico',
    sustancia: 'generico',
    comercial: 'comercial',
    marca: 'comercial',
    forma: 'forma',
    concentracion: 'concentracion',
    presentacion: 'presentacion',
    via: 'via',
    'via de administracion': 'via',
    unidad: 'unidad',
    'dosis maxima': 'dosis_max_dia',
    'dosis maxima dia': 'dosis_max_dia',
    controlado: 'controlado',
    'precio unitario': 'precio',
  }
  for (const c of COLUMNAS_CATALOGO) if (sinAcentos(c.titulo) === t || c.clave === t) return c.clave
  return alias[t] ?? null
}

function fechaISO(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') {
    const s = v.trim()
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

const num = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}
const txt = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? (fechaISO(v) ?? '') : String(v).trim())

// Convierte las filas leídas del Excel en filas del catálogo, con avisos
export function interpretarHoja(filas: unknown[][]) {
  const avisos: string[] = []
  const iEncabezado = filas.findIndex((f) => f.filter((c) => columnaDeEncabezado(c)).length >= 3)
  if (iEncabezado < 0) return { filas: [] as FilaCatalogo[], avisos: ['No encontré la fila de encabezados (Clave, Denominación genérica, …). Usa la plantilla.'], errores: [] }
  const mapa = filas[iEncabezado].map(columnaDeEncabezado)
  const faltan = COLUMNAS_CATALOGO.filter((c) => c.obligatoria && !mapa.includes(c.clave)).map((c) => c.titulo)
  if (faltan.length) avisos.push(`Faltan columnas obligatorias: ${faltan.join(', ')}`)

  const resultado: FilaCatalogo[] = []
  const errores: { fila: number; error: string }[] = []
  filas.slice(iEncabezado + 1).forEach((f, j) => {
    if (f.every((c) => c === null || c === undefined || String(c).trim() === '')) return
    const numero = iEncabezado + j + 2
    const o: Record<string, unknown> = { fila: numero }
    mapa.forEach((k, i) => {
      if (!k) return
      const v = f[i]
      if (k === 'precio' || k === 'dosis_max_dia' || k === 'existencia') o[k] = num(v)
      else if (k === 'caducidad') o[k] = fechaISO(v)
      else o[k] = txt(v)
    })
    const fila = o as FilaCatalogo
    const falta = COLUMNAS_CATALOGO.filter((c) => c.obligatoria && (fila[c.clave] === '' || fila[c.clave] === null || fila[c.clave] === undefined))
    if (falta.length) errores.push({ fila: numero, error: `Falta: ${falta.map((c) => c.titulo).join(', ')}` })
    else if (fila.lote && (!fila.caducidad || !fila.existencia)) errores.push({ fila: numero, error: 'El lote necesita caducidad (fecha) y existencia' })
    else resultado.push(fila)
  })
  return { filas: resultado, avisos, errores }
}
