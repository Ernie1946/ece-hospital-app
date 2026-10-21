// Catálogo maestro de cargos: columnas de la plantilla y lectura del Excel
export type FilaArticulo = {
  fila: number
  clave: string
  descripcion: string
  codigo_barras: string
  unidad: string
  tipo: string
  precio: string
  iva: string
  clave_sat: string
  unidad_sat: string
  requiere_lote: string
  activo: string
}
export type Revision = { fila: number; clave: string; accion: 'nuevo' | 'cambio' | 'precio' | 'cambio_precio' | 'sin_cambios' | 'error'; mensaje: string | null }

export const COLUMNAS: { clave: keyof Omit<FilaArticulo, 'fila'>; titulo: string; ancho: number; nota: string; alias: string[] }[] = [
  { clave: 'clave', titulo: 'Clave', ancho: 16, nota: 'Obligatoria. Clave interna del área (letras, números, guion).', alias: ['codigo', 'codigo interno', 'sku', 'clave interna'] },
  { clave: 'descripcion', titulo: 'Descripción', ancho: 48, nota: 'Obligatoria. Como debe aparecer en la cuenta del paciente.', alias: ['nombre', 'articulo', 'concepto', 'descripcion del articulo'] },
  { clave: 'codigo_barras', titulo: 'Código de barras', ancho: 18, nota: 'EAN/UPC o el código de la etiqueta. Opcional.', alias: ['codigo de barras', 'ean', 'upc', 'barras'] },
  { clave: 'unidad', titulo: 'Unidad', ancho: 12, nota: 'pieza, caja, paquete, estudio, hora, sesión…', alias: ['unidad de medida', 'um', 'presentacion'] },
  { clave: 'tipo', titulo: 'Tipo', ancho: 14, nota: 'insumo, estudio, procedimiento, servicio, alimento, quirofano, otro.', alias: [] },
  { clave: 'precio', titulo: 'Precio', ancho: 12, nota: 'Precio al público sin IVA. Un cambio de precio pasa a autorización de Costos.', alias: ['precio unitario', 'precio publico', 'importe', 'costo'] },
  { clave: 'iva', titulo: 'IVA', ancho: 8, nota: '16, 0 o exento.', alias: ['tasa iva', 'impuesto'] },
  { clave: 'clave_sat', titulo: 'Clave SAT', ancho: 12, nota: 'ClaveProdServ de 8 dígitos (para facturar).', alias: ['clave prod serv', 'claveprodserv', 'clave producto sat', 'sat'] },
  { clave: 'unidad_sat', titulo: 'Unidad SAT', ancho: 11, nota: 'H87 pieza, E48 servicio, XBX caja…', alias: ['clave unidad', 'clave unidad sat'] },
  { clave: 'requiere_lote', titulo: 'Requiere lote', ancho: 13, nota: 'Sí para material de alto costo (stents, prótesis, catéteres).', alias: ['lote', 'lote y serie', 'alto costo'] },
  { clave: 'activo', titulo: 'Activo', ancho: 8, nota: 'Sí o No. "No" lo retira del catálogo sin borrarlo.', alias: ['vigente'] },
]

const llano = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Lee la hoja: encuentra el renglón de encabezados (aunque haya títulos arriba) y mapea columnas por nombre
export function interpretarArticulos(datos: unknown[][]): { filas: FilaArticulo[]; avisos: string[] } {
  const avisos: string[] = []
  const buscar = (celda: unknown) => {
    const t = llano(celda)
    return COLUMNAS.find((c) => llano(c.titulo) === t || llano(c.clave) === t || c.alias.includes(t))?.clave
  }
  let inicio = -1
  let mapa: (keyof Omit<FilaArticulo, 'fila'> | undefined)[] = []
  for (let r = 0; r < Math.min(datos.length, 15); r++) {
    const m = (datos[r] ?? []).map(buscar)
    if (m.includes('clave') && m.includes('descripcion')) {
      inicio = r
      mapa = m
      break
    }
  }
  if (inicio < 0) return { filas: [], avisos: ['No encontré los encabezados "Clave" y "Descripción". Usa la plantilla.'] }
  const faltan = COLUMNAS.filter((c) => ['precio'].includes(c.clave) && !mapa.includes(c.clave))
  if (faltan.length) avisos.push(`No hay columna ${faltan.map((c) => `"${c.titulo}"`).join(', ')}: solo se actualizarán los datos, no los precios.`)
  const filas: FilaArticulo[] = []
  for (let r = inicio + 1; r < datos.length; r++) {
    const fila = datos[r] ?? []
    if (fila.every((v) => v === null || v === undefined || String(v).trim() === '')) continue
    const f = { fila: r + 1 } as FilaArticulo
    for (const c of COLUMNAS) (f as Record<string, unknown>)[c.clave] = ''
    mapa.forEach((k, i) => {
      if (!k) return
      const v = fila[i]
      ;(f as Record<string, unknown>)[k] = v === null || v === undefined ? '' : typeof v === 'number' && k === 'codigo_barras' ? v.toFixed(0) : String(v).trim()
    })
    filas.push(f)
  }
  if (filas.length === 0) avisos.push('La hoja no tiene artículos debajo de los encabezados.')
  return { filas, avisos }
}

export const ACCION: Record<Revision['accion'], { texto: string; clase: string }> = {
  nuevo: { texto: 'Nuevo (precio a autorizar)', clase: 'bg-sky-100 text-sky-800' },
  cambio: { texto: 'Cambia datos', clase: 'bg-amber-100 text-amber-800' },
  precio: { texto: 'Cambio de precio (a autorizar)', clase: 'bg-violet-100 text-violet-800' },
  cambio_precio: { texto: 'Datos y precio (a autorizar)', clase: 'bg-violet-100 text-violet-800' },
  sin_cambios: { texto: 'Sin cambios', clase: 'bg-slate-100 text-slate-600' },
  error: { texto: 'Error', clase: 'bg-red-100 text-red-800' },
}

export const TIPOS_ARTICULO: [string, string][] = [
  ['insumo', 'Insumo / material'],
  ['estudio', 'Estudio'],
  ['procedimiento', 'Procedimiento'],
  ['servicio', 'Servicio'],
  ['alimento', 'Alimento'],
  ['quirofano', 'Quirófano'],
  ['otro', 'Otro'],
]

export const pesos = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type Articulo = {
  id: number
  clave: string
  descripcion: string
  tipo: string
  unidad: string
  codigo_barras: string | null
  iva: string
  clave_sat: string | null
  unidad_sat: string | null
  requiere_lote: boolean
  activo: boolean
  estado: 'pendiente' | 'autorizado'
  area_cargo_id: number
  area_clave: string
  area_nombre: string
  precio: number | null
  precio_propuesto: number | null
  propuesto_desde: string | null
}
