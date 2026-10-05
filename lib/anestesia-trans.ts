// Hoja transanestésica, salida de quirófano y recuperación (tomado de AnestesiApp)

export const TIEMPOS: [string, string][] = [
  ['inicio_anestesia', 'Inicio de anestesia'],
  ['inicio_cirugia', 'Inicio de cirugía'],
  ['fin_cirugia', 'Fin de cirugía'],
  ['fin_anestesia', 'Fin de anestesia'],
]

export const VIAS_TRANS = ['IV', 'IM', 'SC', 'Inhalada', 'Intratecal', 'Epidural', 'Perineural', 'Infiltración', 'VO']
export const UNIDADES_DOSIS = ['mg', 'mcg', 'g', 'mL', 'UI', 'mEq', 'mcg/kg/min', 'mg/h', '%']

export const INGRESOS_TRANS = [
  'Sol. Hartmann',
  'Sol. salina 0.9%',
  'Sol. glucosada 5%',
  'Sol. mixta',
  'Coloide (gelatina / almidón)',
  'Albúmina',
  'Concentrado eritrocitario',
  'Plasma fresco congelado',
  'Concentrado plaquetario',
  'Crioprecipitado',
  'Sangre recuperada (cell saver)',
]
export const EGRESOS_TRANS = ['Sangrado', 'Diuresis', 'Sonda nasogástrica', 'Drenaje', 'Líquido de irrigación no recuperado']

// Fármacos frecuentes con dosis por peso (calculadora de AnestesiApp)
export type FarmacoRef = { nombre: string; min: number; max: number; unidad: string; porKg: boolean; via: string; nota: string }
export const FARMACOS_ANESTESIA: { grupo: string; items: FarmacoRef[] }[] = [
  {
    grupo: 'Inductores',
    items: [
      { nombre: 'Propofol', min: 1.5, max: 2.5, unidad: 'mg', porKg: true, via: 'IV', nota: 'Reducir en ancianos y ASA alto' },
      { nombre: 'Tiopental', min: 3, max: 5, unidad: 'mg', porKg: true, via: 'IV', nota: 'Reducir en hipovolemia' },
      { nombre: 'Ketamina', min: 1, max: 2, unidad: 'mg', porKg: true, via: 'IV', nota: '2-4 mg/kg IM' },
      { nombre: 'Etomidato', min: 0.2, max: 0.3, unidad: 'mg', porKg: true, via: 'IV', nota: 'Útil en inestabilidad hemodinámica' },
      { nombre: 'Midazolam', min: 0.05, max: 0.1, unidad: 'mg', porKg: true, via: 'IV', nota: 'Sedación / premedicación' },
    ],
  },
  {
    grupo: 'Opioides y analgésicos',
    items: [
      { nombre: 'Fentanilo', min: 1, max: 3, unidad: 'mcg', porKg: true, via: 'IV', nota: 'Bolos de 25-50 mcg en mantenimiento' },
      { nombre: 'Morfina', min: 0.05, max: 0.1, unidad: 'mg', porKg: true, via: 'IV', nota: 'Inicio lento, útil postoperatorio' },
      { nombre: 'Remifentanilo', min: 0.1, max: 0.5, unidad: 'mcg/kg/min', porKg: false, via: 'IV', nota: 'Infusión continua, titulable' },
      { nombre: 'Tramadol', min: 1, max: 2, unidad: 'mg', porKg: true, via: 'IV', nota: 'Máximo 100 mg por dosis' },
      { nombre: 'Ketorolaco', min: 15, max: 30, unidad: 'mg', porKg: false, via: 'IV', nota: 'Dosis fija' },
    ],
  },
  {
    grupo: 'Relajantes musculares',
    items: [
      { nombre: 'Succinilcolina', min: 1, max: 1.5, unidad: 'mg', porKg: true, via: 'IV', nota: 'Secuencia rápida, inicio 60 s' },
      { nombre: 'Rocuronio', min: 0.6, max: 1.2, unidad: 'mg', porKg: true, via: 'IV', nota: '1.2 mg/kg en secuencia rápida' },
      { nombre: 'Vecuronio', min: 0.08, max: 0.1, unidad: 'mg', porKg: true, via: 'IV', nota: 'Mantenimiento 0.01-0.015 mg/kg' },
      { nombre: 'Cisatracurio', min: 0.15, max: 0.2, unidad: 'mg', porKg: true, via: 'IV', nota: 'Útil en falla renal o hepática' },
      { nombre: 'Atracurio', min: 0.4, max: 0.5, unidad: 'mg', porKg: true, via: 'IV', nota: 'Mantenimiento 0.1 mg/kg' },
    ],
  },
  {
    grupo: 'Reversión y vasoactivos',
    items: [
      { nombre: 'Neostigmina', min: 0.03, max: 0.07, unidad: 'mg', porKg: true, via: 'IV', nota: 'Siempre con atropina 0.01-0.02 mg/kg' },
      { nombre: 'Sugammadex', min: 2, max: 16, unidad: 'mg', porKg: true, via: 'IV', nota: '2 mg/kg TOF≥2 · 4 mg/kg TOF=1 · 16 mg/kg rescate' },
      { nombre: 'Atropina', min: 0.01, max: 0.02, unidad: 'mg', porKg: true, via: 'IV', nota: 'Bradicardia y junto con neostigmina' },
      { nombre: 'Efedrina', min: 5, max: 10, unidad: 'mg', porKg: false, via: 'IV', nota: 'Dosis fija, para hipotensión' },
      { nombre: 'Norepinefrina', min: 0.01, max: 0.5, unidad: 'mcg/kg/min', porKg: false, via: 'IV', nota: 'Soporte vasopresor en infusión' },
    ],
  },
  {
    grupo: 'Antieméticos y profilaxis',
    items: [
      { nombre: 'Ondansetrón', min: 4, max: 8, unidad: 'mg', porKg: false, via: 'IV', nota: 'Al final de la cirugía' },
      { nombre: 'Dexametasona', min: 0.1, max: 0.15, unidad: 'mg', porKg: true, via: 'IV', nota: 'Al inicio de la anestesia' },
      { nombre: 'Metoclopramida', min: 10, max: 10, unidad: 'mg', porKg: false, via: 'IV', nota: 'Dosis fija 10 mg' },
      { nombre: 'Cefazolina', min: 2, max: 2, unidad: 'g', porKg: false, via: 'IV', nota: '3 g si > 120 kg; 30-60 min antes de la incisión' },
    ],
  },
]
export const LISTA_FARMACOS = FARMACOS_ANESTESIA.flatMap((g) => g.items)

const redondear = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10)

export function buscarFarmacoRef(nombre: string) {
  const n = nombre.trim().toLowerCase()
  if (!n) return null
  return LISTA_FARMACOS.find((f) => n.startsWith(f.nombre.toLowerCase())) ?? null
}

// "Propofol para 65 kg: 98–163 mg (IV) · Reducir en ancianos…"
export function dosisSugerida(f: FarmacoRef, peso: number | null) {
  if (f.porKg) {
    if (!peso) return `${f.min}–${f.max} ${f.unidad}/kg ${f.via} · ${f.nota} (falta el peso para calcular)`
    return `Para ${peso} kg: ${redondear(f.min * peso)}–${redondear(f.max * peso)} ${f.unidad} ${f.via} (${f.min}–${f.max} ${f.unidad}/kg) · ${f.nota}`
  }
  return `${f.min === f.max ? f.min : `${f.min}–${f.max}`} ${f.unidad} ${f.via} · ${f.nota}`
}

// ---------------------------------------------------------------------
// Técnica anestésica (secciones de la hoja de AnestesiApp)
// ---------------------------------------------------------------------
export type CampoTecnica = {
  clave: string
  etiqueta: string
  tipo: 'texto' | 'numero' | 'opciones' | 'casillas' | 'largo'
  opciones?: string[]
  placeholder?: string
}
export type SeccionTecnica = { clave: string; titulo: string; campos: CampoTecnica[] }

const SINO = ['Sí', 'No']

export const TECNICA_SECCIONES: SeccionTecnica[] = [
  {
    clave: 'preinduccion',
    titulo: 'Verificación y pre-inducción',
    campos: [
      { clave: 'check_maquina', etiqueta: 'Verificación de máquina de anestesia', tipo: 'opciones', opciones: SINO },
      { clave: 'riesgo_broncoaspiracion', etiqueta: 'Riesgo de broncoaspiración', tipo: 'opciones', opciones: ['Bajo', 'Alto'] },
      {
        clave: 'posicion',
        etiqueta: 'Posición',
        tipo: 'opciones',
        opciones: ['Supino', 'Decúbito lateral derecho', 'Decúbito lateral izquierdo', 'Prono', 'Trendelenburg', 'Trendelenburg inverso', 'Litotomía', 'Sentado'],
      },
      { clave: 'antibiotico', etiqueta: 'Profilaxis antibiótica', tipo: 'texto', placeholder: 'Ej. Cefazolina 2 g IV 08:15' },
      { clave: 'induccion', etiqueta: 'Inducción', tipo: 'opciones', opciones: ['Intravenosa', 'Inhalatoria', 'Secuencia rápida', 'Intubación despierto'] },
    ],
  },
  {
    clave: 'via_aerea',
    titulo: 'Vía aérea',
    campos: [
      {
        clave: 'dispositivo',
        etiqueta: 'Dispositivo',
        tipo: 'opciones',
        opciones: ['Tubo endotraqueal', 'Tubo reforzado', 'Mascarilla laríngea', 'Mascarilla facial', 'Intubación nasotraqueal', 'Traqueostomía', 'Ninguno (ventilación espontánea)'],
      },
      { clave: 'laringoscopio', etiqueta: 'Laringoscopio', tipo: 'opciones', opciones: ['Macintosh', 'Miller', 'McCoy', 'Videolaringoscopio', 'Fibrobroncoscopio'] },
      { clave: 'hoja', etiqueta: 'Hoja No.', tipo: 'numero', placeholder: '3' },
      { clave: 'tubo', etiqueta: 'Tubo / ML No.', tipo: 'numero', placeholder: '7.5' },
      { clave: 'globo', etiqueta: 'Globo', tipo: 'opciones', opciones: ['Con globo', 'Sin globo'] },
      { clave: 'fijacion_cm', etiqueta: 'Fijación (cm)', tipo: 'numero', placeholder: '21' },
      { clave: 'cormack', etiqueta: 'Cormack-Lehane', tipo: 'opciones', opciones: ['I', 'II', 'III', 'IV'] },
      { clave: 'intentos', etiqueta: 'Intentos', tipo: 'numero', placeholder: '1' },
      { clave: 'auxiliares', etiqueta: 'Auxiliares', tipo: 'casillas', opciones: ['Guía / estilete', 'Bougie', 'Cánula de Guedel', 'Presión cricoidea'] },
      { clave: 'dificultad', etiqueta: 'Dificultad técnica', tipo: 'texto', placeholder: 'Anotar si hubo dificultad' },
    ],
  },
  {
    clave: 'ventilacion',
    titulo: 'Ventilación y gases',
    campos: [
      { clave: 'modo', etiqueta: 'Modo', tipo: 'opciones', opciones: ['VCV', 'PCV', 'SIMV', 'Presión soporte', 'PRVC', 'Espontánea'] },
      { clave: 'vt', etiqueta: 'VT (mL)', tipo: 'numero', placeholder: '450' },
      { clave: 'fr', etiqueta: 'FR (rpm)', tipo: 'numero', placeholder: '12' },
      { clave: 'peep', etiqueta: 'PEEP (cmH₂O)', tipo: 'numero', placeholder: '5' },
      { clave: 'fio2', etiqueta: 'FiO₂ (%)', tipo: 'numero', placeholder: '50' },
      { clave: 'circuito', etiqueta: 'Circuito', tipo: 'opciones', opciones: ['Circular', 'Bain', 'Mapleson', 'Jackson-Rees'] },
      { clave: 'agente', etiqueta: 'Agente inhalado', tipo: 'opciones', opciones: ['Ninguno', 'Sevoflurano', 'Desflurano', 'Isoflurano'] },
      { clave: 'concentracion', etiqueta: 'Concentración (%)', tipo: 'texto', placeholder: '1.5 – 2.0' },
    ],
  },
  {
    clave: 'monitoreo',
    titulo: 'Monitoreo',
    campos: [
      {
        clave: 'monitores',
        etiqueta: 'Monitores',
        tipo: 'casillas',
        opciones: ['ECG', 'PANI', 'SpO₂', 'Capnografía', 'Temperatura', 'BIS', 'TOF', 'Línea arterial', 'PVC', 'Gasto cardiaco', 'Sonda vesical'],
      },
    ],
  },
  {
    clave: 'neuroaxial',
    titulo: 'Bloqueo neuroaxial',
    campos: [
      { clave: 'tipo', etiqueta: 'Tipo', tipo: 'opciones', opciones: ['Subaracnoideo', 'Epidural', 'Mixto', 'Caudal'] },
      { clave: 'nivel', etiqueta: 'Nivel de punción', tipo: 'texto', placeholder: 'L3-L4' },
      { clave: 'aguja', etiqueta: 'Aguja', tipo: 'texto', placeholder: 'Whitacre 25G' },
      { clave: 'cateter', etiqueta: 'Catéter', tipo: 'opciones', opciones: SINO },
      { clave: 'farmacos', etiqueta: 'Fármacos y dosis', tipo: 'texto', placeholder: 'Bupivacaína pesada 12.5 mg + fentanilo 25 mcg' },
      { clave: 'nivel_sensitivo', etiqueta: 'Nivel sensitivo alcanzado', tipo: 'texto', placeholder: 'T4' },
      { clave: 'latencia', etiqueta: 'Latencia (min)', tipo: 'numero', placeholder: '5' },
      { clave: 'complicaciones', etiqueta: 'Complicaciones', tipo: 'texto', placeholder: 'Punción advertida, parestesia…' },
    ],
  },
  {
    clave: 'regional',
    titulo: 'Bloqueo regional periférico',
    campos: [
      { clave: 'bloqueo', etiqueta: 'Bloqueo', tipo: 'texto', placeholder: 'Plexo braquial interescalénico, femoral…' },
      { clave: 'lado', etiqueta: 'Lado', tipo: 'opciones', opciones: ['Izquierdo', 'Derecho', 'Bilateral'] },
      { clave: 'guia', etiqueta: 'Guía', tipo: 'opciones', opciones: ['Ultrasonido', 'Neuroestimulador', 'Referencias anatómicas'] },
      { clave: 'anestesico', etiqueta: 'Anestésico local', tipo: 'texto', placeholder: 'Ropivacaína 0.5%' },
      { clave: 'volumen', etiqueta: 'Volumen (mL)', tipo: 'numero', placeholder: '20' },
    ],
  },
  {
    clave: 'emersion',
    titulo: 'Emersión y eventos',
    campos: [
      { clave: 'reversion', etiqueta: 'Reversión del bloqueo neuromuscular', tipo: 'texto', placeholder: 'Sugammadex 200 mg / neostigmina + atropina' },
      { clave: 'extubacion', etiqueta: 'Extubación', tipo: 'opciones', opciones: ['Despierto', 'Plano profundo', 'Sale intubado', 'No aplica'] },
      {
        clave: 'condicion',
        etiqueta: 'Condición transanestésica',
        tipo: 'opciones',
        opciones: ['Satisfactoria', 'Hipotensión', 'Hipertensión', 'Bradicardia', 'Taquicardia', 'Arritmia', 'Broncoespasmo', 'Laringoespasmo', 'Broncoaspiración', 'Choque', 'Paro cardiaco'],
      },
      { clave: 'incidentes', etiqueta: 'Incidentes y accidentes', tipo: 'largo', placeholder: 'Eventos relevantes atribuibles a la anestesia…' },
    ],
  },
]

// Texto corto de una sección guardada: "Dispositivo: Tubo endotraqueal · Tubo No.: 7.5 · …"
export function resumenSeccion(s: SeccionTecnica, datos: Record<string, string> | undefined) {
  if (!datos) return ''
  return s.campos
    .filter((c) => datos[c.clave])
    .map((c) => `${c.etiqueta}: ${datos[c.clave]}`)
    .join(' · ')
}

// ---------------------------------------------------------------------
// Salida de quirófano
// ---------------------------------------------------------------------
export const DESTINOS_SALIDA = ['UCPA', 'Piso', 'UCI', 'UCI neonatal', 'Domicilio (ambulatorio)']
export const CONDICIONES_SALIDA = ['Estable', 'Satisfactoria', 'Reservada', 'Crítica']
export const CONSCIENCIA_SALIDA = ['Despierto y orientado', 'Somnoliento', 'Sedado', 'Intubado']

// ---------------------------------------------------------------------
// Escala de Aldrete modificada
// ---------------------------------------------------------------------
export const ALDRETE: { clave: string; titulo: string; opciones: [string, string, string] }[] = [
  { clave: 'actividad', titulo: 'Actividad', opciones: ['No mueve extremidades', 'Mueve 2 extremidades', 'Mueve 4 extremidades'] },
  { clave: 'respiracion', titulo: 'Respiración', opciones: ['Apnea', 'Disnea o respiración limitada', 'Respira profundo y tose'] },
  { clave: 'circulacion', titulo: 'Circulación', opciones: ['TA ± 50% de la basal', 'TA ± 20-50% de la basal', 'TA ± 20% de la basal'] },
  { clave: 'conciencia', titulo: 'Conciencia', opciones: ['No responde', 'Responde al llamado', 'Despierto y orientado'] },
  { clave: 'saturacion', titulo: 'SpO₂', opciones: ['< 90% con oxígeno', '≥ 90% con oxígeno', '≥ 92% al aire ambiente'] },
]

export function textoAldrete(total: number) {
  return total >= 9 ? 'Criterios de alta' : total >= 7 ? 'En observación' : 'No apto para alta'
}
export function colorAldrete(total: number) {
  return total >= 9 ? 'bg-emerald-100 text-emerald-900' : total >= 7 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'
}

export const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('es-MX', { timeZone: 'America/Chihuahua', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'

export function duracion(desde: string | null | undefined, hasta: string | null | undefined) {
  if (!desde || !hasta) return null
  const min = Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}
