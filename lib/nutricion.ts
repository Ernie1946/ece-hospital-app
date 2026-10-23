// Nutrición: tiempos de comida, consistencias y restricciones frecuentes

export const TIEMPOS = [
  { clave: 'desayuno', nombre: 'Desayuno', hora: 8, colacion: false },
  { clave: 'colacion_matutina', nombre: 'Colación matutina', hora: 11, colacion: true },
  { clave: 'comida', nombre: 'Comida', hora: 14, colacion: false },
  { clave: 'colacion_vespertina', nombre: 'Colación vespertina', hora: 17, colacion: true },
  { clave: 'cena', nombre: 'Cena', hora: 20, colacion: false },
] as const
export type Tiempo = (typeof TIEMPOS)[number]['clave']

export const nombreTiempo = (t: string) => TIEMPOS.find((x) => x.clave === t)?.nombre ?? t

export const CONSISTENCIAS: Record<string, string> = {
  normal: 'Normal',
  blanda: 'Blanda',
  picada: 'Picada',
  licuada: 'Licuada',
  papilla: 'Papilla',
  liquida: 'Líquida',
}

export const RESTRICCIONES = [
  'sin lácteos',
  'sin gluten',
  'sin azúcar',
  'baja en sodio',
  'baja en grasa',
  'baja en potasio',
  'sin residuo',
  'sin irritantes',
  'vegetariana',
]

export type TipoDieta = { id: number; clave: string; nombre: string; es_ayuno: boolean; activo: boolean; concepto_cargo_id: number | null; cobro_aparte: boolean }

// Fecha de hoy y el siguiente tiempo de comida según la hora de Chihuahua
export function hoyChihuahua() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })
}
export function tiempoSiguiente(): Tiempo {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Chihuahua', hour: 'numeric', hour12: false })) % 24
  return (TIEMPOS.find((t) => t.hora > h - 1)?.clave ?? 'desayuno') as Tiempo
}
