// Escalas y cálculos de la valoración preanestésica (tomados de AnestesiApp)

export type OpcionEscala = { codigo: string; texto: string }
export type Escala = { clave: string; titulo: string; nota?: string; opciones: OpcionEscala[] }

const NE: OpcionEscala = { codigo: 'N/E', texto: 'Sin evaluar' }

export const ESCALAS_VIA_AEREA: Escala[] = [
  {
    clave: 'mallampati',
    titulo: 'Mallampati-Samsoon',
    nota: 'I: paladar blando + úvula + pilares · II: paladar + úvula · III: paladar + base de úvula · IV: solo paladar duro',
    opciones: [NE, { codigo: 'I', texto: 'I' }, { codigo: 'II', texto: 'II' }, { codigo: 'III', texto: 'III' }, { codigo: 'IV', texto: 'IV' }],
  },
  {
    clave: 'patil_aldreti',
    titulo: 'Distancia tiromentoniana (Patil-Aldreti)',
    opciones: [
      NE,
      { codigo: 'I', texto: '> 6.5 cm — Clase I (sin dificultad)' },
      { codigo: 'II', texto: '6-6.5 cm — Clase II (cierta dificultad)' },
      { codigo: 'III', texto: '< 6 cm — Clase III (muy difícil)' },
    ],
  },
  {
    clave: 'apertura_oral',
    titulo: 'Apertura oral / distancia interincisiva',
    opciones: [NE, { codigo: 'I', texto: '> 3.5 cm — Clase I (normal)' }, { codigo: 'II', texto: '≤ 3.5 cm — Clase II (limitada)' }],
  },
  {
    clave: 'protrusion',
    titulo: 'Protrusión mandibular',
    nota: 'Evalúa función de la ATM y subluxación mandibular',
    opciones: [
      NE,
      { codigo: 'I', texto: 'I — Incisivos inferiores sobrepasan a los superiores (fácil)' },
      { codigo: 'II', texto: 'II — Incisivos a nivel (moderado)' },
      { codigo: 'III', texto: 'III — No proyectan hacia adelante (difícil)' },
    ],
  },
  {
    clave: 'bellhouse_dore',
    titulo: 'Bellhouse-Doré (movilidad atlantooccipital)',
    nota: 'Ángulo normal 35° · < 30° dificulta la posición de olfateo',
    opciones: [
      NE,
      { codigo: 'I', texto: 'I — Sin limitación (≥ 35°)' },
      { codigo: 'II', texto: 'II — 1/3 de limitación' },
      { codigo: 'III', texto: 'III — 2/3 de limitación' },
      { codigo: 'IV', texto: 'IV — Limitación completa' },
    ],
  },
  {
    clave: 'esternomentoniana',
    titulo: 'Distancia esternomentoniana',
    opciones: [
      NE,
      { codigo: 'I', texto: '> 13 cm — Clase I (sin dificultad)' },
      { codigo: 'II', texto: '12-13 cm — Clase II (cierta dificultad)' },
      { codigo: 'III', texto: '11-12 cm — Clase III (difícil)' },
      { codigo: 'IV', texto: '< 11 cm — Clase IV (muy difícil)' },
    ],
  },
  {
    clave: 'cormack',
    titulo: 'Cormack-Lehane (si hay laringoscopia previa)',
    nota: 'Visualización de la glotis en laringoscopia directa',
    opciones: [
      NE,
      { codigo: 'I', texto: 'I — Anillo glótico completo (fácil)' },
      { codigo: 'II', texto: 'II — Solo comisura posterior (dificultad)' },
      { codigo: 'III', texto: 'III — Solo epiglotis (muy difícil)' },
      { codigo: 'IV', texto: 'IV — Sin visualización (técnicas especiales)' },
    ],
  },
]

export const ASA: OpcionEscala[] = [
  { codigo: 'I', texto: 'I — Sano' },
  { codigo: 'II', texto: 'II — Enfermedad sistémica leve' },
  { codigo: 'III', texto: 'III — Enfermedad sistémica grave' },
  { codigo: 'IV', texto: 'IV — Amenaza constante para la vida' },
  { codigo: 'V', texto: 'V — Moribundo' },
  { codigo: 'VI', texto: 'VI — Muerte cerebral (donador)' },
]

export const TECNICAS = [
  'General balanceada',
  'General endovenosa total (TIVA)',
  'Regional (espinal)',
  'Regional (epidural)',
  'Combinada espinal-epidural',
  'Bloqueo de nervio periférico',
  'Sedación',
  'Local + sedación',
]

export const INTERROGATORIO: [string, string, string][] = [
  ['cardiovascular', 'Cardiovascular', 'HTA, angina, disnea…'],
  ['respiratorio', 'Respiratorio', 'Asma, EPOC, tos…'],
  ['digestivo', 'Digestivo', 'Reflujo, náuseas…'],
  ['neurologico', 'Neurológico', 'Cefalea, convulsiones…'],
  ['endocrino', 'Endocrino', 'DM, hipotiroidismo…'],
  ['renal', 'Renal', 'Hematuria, disuria…'],
  ['musculoesqueletico', 'Musculoesquelético', 'Artritis, dolor…'],
  ['hematologico', 'Hematológico', 'Sangrado, anticoagulantes…'],
  ['otros', 'Otros', 'Otros antecedentes…'],
]

export const EXPLORACION: [string, string][] = [
  ['habitus', 'Habitus exterior'],
  ['cabeza', 'Cabeza'],
  ['cuello', 'Cuello'],
  ['torax', 'Tórax / corazón / pulmón'],
  ['abdomen', 'Abdomen'],
  ['extremidades', 'Extremidades'],
  ['neurologico', 'Neurológico'],
]

export const LABORATORIOS: [string, string][] = [
  ['hb', 'Hb (g/dL)'],
  ['hto', 'Hto (%)'],
  ['plaquetas', 'Plaquetas'],
  ['leucocitos', 'Leucocitos'],
  ['glucosa', 'Glucosa (mg/dL)'],
  ['creatinina', 'Creatinina'],
  ['bun', 'BUN'],
  ['sodio', 'Sodio'],
  ['potasio', 'Potasio'],
  ['albumina', 'Albúmina'],
  ['tp', 'TP (s)'],
  ['ttp', 'TTP (s)'],
  ['inr', 'INR'],
]

// Factores predictores de vía aérea difícil (mismo criterio que AnestesiApp)
export function factoresVAD(v: Record<string, string | undefined>) {
  return [
    v.mallampati === 'III' || v.mallampati === 'IV',
    v.patil_aldreti === 'II' || v.patil_aldreti === 'III',
    v.apertura_oral === 'II',
    v.bellhouse_dore === 'III' || v.bellhouse_dore === 'IV',
    v.protrusion === 'III',
    v.esternomentoniana === 'III' || v.esternomentoniana === 'IV',
    v.cormack === 'III' || v.cormack === 'IV',
  ].filter(Boolean).length
}

export function textoVAD(n: number) {
  return n === 0 ? '✓ Vía aérea sin factores de riesgo' : n <= 2 ? `⚠ ${n} factor(es) de riesgo` : `🚨 ${n} factores — VAD probable`
}

export function imc(peso?: number | null, talla?: number | null) {
  if (!peso || !talla) return null
  return Math.round((peso / (talla / 100) ** 2) * 10) / 10
}

// Sangrado permisible: Gross y Bourke-Smith, Hb mínima 8 g/dL; transfusión a Hb 7
export function sangradoPermisible(peso: number, hb: number, sexo: string) {
  if (!peso || !hb || hb <= 0) return null
  const hbMin = 8
  const hbObj = 7
  const vse = Math.round(peso * (sexo === 'H' ? 70 : 65))
  const gross = Math.round((vse * (hb - hbMin)) / ((hb + hbMin) / 2))
  const bourke = Math.round((vse * (hb * 3 - hbMin * 3)) / (hb * 3))
  const transfusion = Math.round((vse * (hb - hbObj)) / ((hb + hbObj) / 2))
  return { vse, gross, bourke, transfusion }
}

export function alertasLaboratorio(l: Record<string, string | undefined>) {
  const n = (k: string) => (l[k] ? Number(String(l[k]).replace(',', '.')) : NaN)
  const a: string[] = []
  if (n('hb') < 10) a.push(`Anemia severa (Hb ${l.hb})`)
  else if (n('hb') < 12) a.push(`Anemia leve (Hb ${l.hb})`)
  if (n('potasio') < 3.5 || n('potasio') > 5.5) a.push(`K⁺ fuera de rango (${l.potasio} mEq/L)`)
  if (n('glucosa') > 200) a.push(`Hiperglucemia (${l.glucosa} mg/dL)`)
  if (n('inr') > 1.5) a.push(`INR elevado (${l.inr}): riesgo de sangrado`)
  if (n('plaquetas') > 0 && n('plaquetas') < 100000) a.push(`Plaquetopenia (${l.plaquetas})`)
  return a
}

export const ESTADO_CIRUGIA: Record<string, { texto: string; color: string }> = {
  programada: { texto: 'Programada', color: 'bg-sky-100 text-sky-900' },
  en_quirofano: { texto: 'En quirófano', color: 'bg-emerald-100 text-emerald-900' },
  en_recuperacion: { texto: 'En recuperación', color: 'bg-violet-100 text-violet-900' },
  terminada: { texto: 'Terminada', color: 'bg-slate-100 text-slate-700' },
  cancelada: { texto: 'Cancelada', color: 'bg-red-100 text-red-800 line-through' },
}

export const COLOR_ASA: Record<string, string> = {
  I: 'bg-emerald-100 text-emerald-900',
  II: 'bg-sky-100 text-sky-900',
  III: 'bg-amber-100 text-amber-900',
  IV: 'bg-red-100 text-red-800',
  V: 'bg-red-200 text-red-900',
  VI: 'bg-slate-200 text-slate-800',
}
