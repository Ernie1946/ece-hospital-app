// ---------------------------------------------------------------------
// Referencias clínicas de enfermería (adultos).
// Ajustar aquí a los protocolos del hospital; pediatría y neonatos
// necesitarán rangos propios.
// ---------------------------------------------------------------------

export type Signos = {
  ta_sistolica: number | null
  ta_diastolica: number | null
  frecuencia_cardiaca: number | null
  frecuencia_respiratoria: number | null
  temperatura: number | null
  spo2: number | null
  dolor_eva: number | null
  glucosa_capilar: number | null
}

// Rango fuera del cual el valor se marca en rojo
export const RANGO_ALERTA: Record<keyof Signos, { min?: number; max?: number; unidad: string; nombre: string }> = {
  ta_sistolica: { min: 90, max: 160, unidad: 'mmHg', nombre: 'TA sistólica' },
  ta_diastolica: { min: 50, max: 100, unidad: 'mmHg', nombre: 'TA diastólica' },
  frecuencia_cardiaca: { min: 50, max: 120, unidad: 'lpm', nombre: 'FC' },
  frecuencia_respiratoria: { min: 10, max: 24, unidad: 'rpm', nombre: 'FR' },
  temperatura: { min: 35.5, max: 38.0, unidad: '°C', nombre: 'Temperatura' },
  spo2: { min: 92, unidad: '%', nombre: 'SpO₂' },
  dolor_eva: { max: 6, unidad: '/10', nombre: 'Dolor (EVA)' },
  glucosa_capilar: { min: 70, max: 250, unidad: 'mg/dL', nombre: 'Glucosa capilar' },
}

export function fueraDeRango(campo: keyof Signos, valor: number | null | undefined) {
  if (valor === null || valor === undefined) return false
  const r = RANGO_ALERTA[campo]
  return (r.min !== undefined && valor < r.min) || (r.max !== undefined && valor > r.max)
}

// Signos fuera de rango de un registro, en texto ("T 38.6 °C, SpO₂ 89 %")
export function alertasSignos(s: Partial<Signos>) {
  return (Object.keys(RANGO_ALERTA) as (keyof Signos)[])
    .filter((c) => fueraDeRango(c, s[c]))
    .map((c) => `${RANGO_ALERTA[c].nombre} ${s[c]} ${RANGO_ALERTA[c].unidad}`)
}

// Horas sin signos vitales a partir de las cuales el tablero avisa
export const HORAS_SIN_SIGNOS = 4

// ---------------------------------------------------------------------
// Escalas
// ---------------------------------------------------------------------
export type TipoEscala = 'caidas_morse' | 'braden' | 'dolor_eva' | 'glasgow'

export const ESCALAS: Record<TipoEscala, { nombre: string; min: number; max: number; paso: number }> = {
  caidas_morse: { nombre: 'Riesgo de caídas (Morse)', min: 0, max: 125, paso: 5 },
  braden: { nombre: 'Riesgo de úlceras por presión (Braden)', min: 6, max: 23, paso: 1 },
  dolor_eva: { nombre: 'Dolor (EVA)', min: 0, max: 10, paso: 1 },
  glasgow: { nombre: 'Coma de Glasgow', min: 3, max: 15, paso: 1 },
}

export type Nivel = 'bajo' | 'moderado' | 'alto'

export function interpretarEscala(tipo: string, puntaje: number): { texto: string; nivel: Nivel } {
  switch (tipo) {
    case 'caidas_morse':
      if (puntaje >= 45) return { texto: 'Riesgo alto de caída', nivel: 'alto' }
      if (puntaje >= 25) return { texto: 'Riesgo moderado de caída', nivel: 'moderado' }
      return { texto: 'Riesgo bajo de caída', nivel: 'bajo' }
    case 'braden':
      if (puntaje <= 12) return { texto: 'Riesgo alto de úlcera', nivel: 'alto' }
      if (puntaje <= 14) return { texto: 'Riesgo moderado de úlcera', nivel: 'moderado' }
      if (puntaje <= 18) return { texto: 'Riesgo bajo de úlcera', nivel: 'bajo' }
      return { texto: 'Sin riesgo de úlcera', nivel: 'bajo' }
    case 'dolor_eva':
      if (puntaje >= 7) return { texto: 'Dolor severo', nivel: 'alto' }
      if (puntaje >= 4) return { texto: 'Dolor moderado', nivel: 'moderado' }
      if (puntaje >= 1) return { texto: 'Dolor leve', nivel: 'bajo' }
      return { texto: 'Sin dolor', nivel: 'bajo' }
    case 'glasgow':
      if (puntaje <= 8) return { texto: 'Deterioro grave', nivel: 'alto' }
      if (puntaje <= 12) return { texto: 'Deterioro moderado', nivel: 'moderado' }
      return { texto: 'Deterioro leve o normal', nivel: 'bajo' }
    default:
      return { texto: '', nivel: 'bajo' }
  }
}

export const COLOR_NIVEL: Record<Nivel, string> = {
  bajo: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  moderado: 'bg-amber-50 text-amber-900 border-amber-300',
  alto: 'bg-red-50 text-red-800 border-red-300',
}

// ---------------------------------------------------------------------
// Turnos de enfermería (hora de Chihuahua)
// ---------------------------------------------------------------------
export const TURNOS = [
  { clave: 'matutino', nombre: 'Matutino (7:00–15:00)' },
  { clave: 'vespertino', nombre: 'Vespertino (15:00–21:00)' },
  { clave: 'nocturno', nombre: 'Nocturno (21:00–7:00)' },
] as const

export function turnoActual(): string {
  const hora = Number(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chihuahua', hour: 'numeric', hour12: false })
  )
  if (hora >= 7 && hora < 15) return 'matutino'
  if (hora >= 15 && hora < 21) return 'vespertino'
  return 'nocturno'
}

export const CONCEPTOS_INGRESO = ['Vía oral', 'Solución intravenosa', 'Medicamentos IV', 'Sonda / nutrición enteral', 'Hemoderivados']
export const CONCEPTOS_EGRESO = ['Diuresis', 'Evacuaciones', 'Vómito', 'Drenaje', 'Sonda nasogástrica', 'Sangrado']
export const OTRO = 'Otro'

// Producto por concepto de ingreso (la lista termina con "Otro", que abre un campo libre)
export const PRODUCTOS: Record<string, string[]> = {
  'Solución intravenosa': [
    'NaCl 0.9 %',
    'NaCl 0.45 %',
    'Hartmann',
    'Glucosa 5 %',
    'Glucosa 10 %',
    'Glucosa 50 %',
    'Mixta (glucosa 5 % + NaCl 0.9 %)',
  ],
  'Vía oral': ['Agua', 'Dieta líquida', 'Suero oral', 'Leche / fórmula'],
  'Sonda / nutrición enteral': ['Fórmula enteral', 'Agua libre'],
  Hemoderivados: ['Paquete globular', 'Plasma fresco congelado', 'Concentrado plaquetario', 'Crioprecipitado', 'Albúmina'],
}

// Aditivos frecuentes de soluciones IV con su unidad habitual
export const ADITIVOS: { nombre: string; unidad: string }[] = [
  { nombre: 'Cloruro de potasio (KCl)', unidad: 'mEq' },
  { nombre: 'Sulfato de magnesio', unidad: 'g' },
  { nombre: 'Gluconato de calcio', unidad: 'g' },
  { nombre: 'Bicarbonato de sodio', unidad: 'mEq' },
  { nombre: 'Cloruro de sodio 17.7 %', unidad: 'mEq' },
  { nombre: 'Fosfato de potasio', unidad: 'mmol' },
  { nombre: 'Insulina rápida', unidad: 'UI' },
  { nombre: 'Multivitamínico', unidad: 'ámpula' },
]
export const UNIDADES_ADITIVO = ['mEq', 'mmol', 'g', 'mg', 'UI', 'mL', 'ámpula']

export type Aditivo = { nombre: string; cantidad: number; unidad: string }

// "Solución intravenosa: Hartmann + KCl 20 mEq · 125 mL/h"
export function describirLiquido(l: {
  concepto: string
  producto?: string | null
  aditivos?: Aditivo[] | null
  velocidad_ml_h?: number | null
}): string {
  let texto = l.concepto
  if (l.producto) texto += `: ${l.producto}`
  for (const a of l.aditivos ?? []) texto += ` + ${a.nombre} ${Number(a.cantidad).toLocaleString('es-MX')} ${a.unidad}`
  if (l.velocidad_ml_h) texto += ` · ${Number(l.velocidad_ml_h).toLocaleString('es-MX')} mL/h`
  return texto
}
