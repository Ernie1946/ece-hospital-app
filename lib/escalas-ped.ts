// Escalas pediátricas y neonatales: misma lógica que 36_escalas_pediatricas.sql,
// para la vista previa mientras se captura (la base guarda el resultado oficial).
import { pamDe, type Datos } from '@/lib/escalas'

const num = (d: Datos, k: string): number | null => {
  const v = d[k]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v)
  return null
}
const si = (d: Datos, k: string) => d[k] === true || d[k] === 'true' || d[k] === 'on'
const r1 = (x: number) => Math.round(x * 10) / 10
// Redondeo igual que PostgreSQL (mitades hacia afuera del cero)
const redondear = (x: number) => Math.sign(x) * Math.round(Math.abs(x))
const fraccion = (f: number | null) => (f !== null && f > 1 ? f / 100 : f)

export type Res = { puntaje: number; puntos: Record<string, number>; faltantes: string[]; mortalidad?: number | null; interpretacion?: string; sedacion?: number }

export function bandaEdad(meses: number | null) {
  if (meses === null) return 4
  return meses < 1 ? 0 : meses < 12 ? 1 : meses < 24 ? 2 : meses < 60 ? 3 : meses < 144 ? 4 : meses <= 216 ? 5 : 6
}

// ---------------------------------------------------------------- PIM3
export const PROCEDIMIENTO_PIM3: [string, string][] = [
  ['ninguno', 'No viene de procedimiento'],
  ['cardiaco_bomba', 'Posquirúrgico cardiaco con bomba'],
  ['cardiaco_sin_bomba', 'Posquirúrgico cardiaco sin bomba'],
  ['no_cardiaco', 'Otro procedimiento (no cardiaco)'],
]
export const RIESGO_DX_PIM3: [string, string][] = [
  ['ninguno', 'Ninguno de la lista'],
  ['muy_alto', 'Muy alto: paro previo al ingreso, inmunodeficiencia combinada grave, leucemia/linfoma tras 1.ª inducción, trasplante de médula, falla hepática'],
  ['alto', 'Alto: hemorragia cerebral espontánea, miocardiopatía o miocarditis, hipoplasia de VI, enfermedad neurodegenerativa, enterocolitis necrosante'],
  ['bajo', 'Bajo (motivo principal): asma, bronquiolitis, crup, apnea obstructiva, cetoacidosis diabética, crisis convulsivas'],
]
export function pim3(d: Datos): Res {
  const tas = num(d, 'tas') ?? 120
  const be = num(d, 'exceso_base') ?? 0
  const fio2 = fraccion(num(d, 'fio2')), pao2 = num(d, 'pao2')
  const oxi = fio2 !== null && pao2 !== null && pao2 > 0 ? (100 * fio2) / pao2 : 0
  const proc = String(d.procedimiento ?? 'ninguno'), dx = String(d.riesgo_dx ?? 'ninguno')
  const logit =
    3.8233 * +si(d, 'pupilas_fijas') - 0.5378 * +si(d, 'electivo') + 0.9763 * +si(d, 'ventilacion') +
    0.0671 * Math.abs(be) - 0.0431 * tas + 0.1716 * ((tas * tas) / 1000) + 0.4214 * oxi -
    1.2246 * +(proc === 'cardiaco_bomba') - 0.8762 * +(proc === 'cardiaco_sin_bomba') - 1.5164 * +(proc === 'no_cardiaco') +
    1.6225 * +(dx === 'muy_alto') + 1.0725 * +(dx === 'alto') - 2.1766 * +(dx === 'bajo') - 1.7928
  const prob = r1((100 * Math.exp(logit)) / (1 + Math.exp(logit)))
  const faltantes = [num(d, 'tas') === null && 'tas', num(d, 'exceso_base') === null && 'exceso_base', (fio2 === null || pao2 === null) && 'oxigenacion'].filter(Boolean) as string[]
  return { puntaje: redondear(prob), mortalidad: prob, puntos: {}, faltantes }
}

// ---------------------------------------------------------------- PELOD-2
export function pelod2(d: Datos, meses: number | null): Res {
  const b = Math.min(bandaEdad(meses), 5)
  const pamLim = [[46, 31, 17], [55, 39, 25], [60, 44, 31], [62, 46, 32], [65, 49, 36], [67, 52, 38]][b]
  const crLim = [70, 23, 35, 51, 59, 93][b]
  const puntos: Record<string, number> = {}, faltantes: string[] = []
  let total = 0
  const poner = (k: string, v: number) => { puntos[k] = v; total += v }
  const gcs = num(d, 'glasgow'), lac = num(d, 'lactato'), pam = pamDe(d), cr = num(d, 'creatinina'), paco2 = num(d, 'paco2')
  const leu = num(d, 'leucocitos'), plaq = num(d, 'plaquetas')
  const fio2 = fraccion(num(d, 'fio2')), pao2 = num(d, 'pao2')
  let pafi = num(d, 'pafi')
  if (pafi === null && pao2 !== null && fio2 !== null && fio2 > 0) pafi = Math.round(pao2 / fio2)
  if (gcs === null) faltantes.push('glasgow'); else poner('glasgow', gcs >= 11 ? 0 : gcs >= 5 ? 1 : 4)
  poner('pupilas', si(d, 'pupilas_fijas') ? 5 : 0)
  if (lac === null) faltantes.push('lactato'); else poner('lactato', lac >= 11 ? 4 : lac >= 5 ? 1 : 0)
  if (pam === null) faltantes.push('pam'); else poner('pam', pam >= pamLim[0] ? 0 : pam >= pamLim[1] ? 2 : pam >= pamLim[2] ? 3 : 6)
  if (cr === null) faltantes.push('creatinina'); else poner('creatinina', cr * 88.4 >= crLim ? 2 : 0)
  if (pafi === null) faltantes.push('oxigenacion'); else { poner('oxigenacion', pafi <= 60 ? 2 : 0); puntos.pafi = pafi }
  if (paco2 === null) faltantes.push('paco2'); else poner('paco2', paco2 >= 95 ? 3 : paco2 >= 59 ? 1 : 0)
  poner('ventilacion', si(d, 'ventilacion') ? 3 : 0)
  if (leu === null) faltantes.push('leucocitos'); else poner('leucocitos', leu <= 2 ? 2 : 0)
  if (plaq === null) faltantes.push('plaquetas'); else poner('plaquetas', plaq <= 76 ? 2 : plaq <= 141 ? 1 : 0)
  const logit = -6.61 + 0.47 * total
  return { puntaje: total, puntos, faltantes, mortalidad: r1(100 / (1 + Math.exp(-logit))) }
}

// ---------------------------------------------------------------- pSOFA
export function psofa(d: Datos, meses: number | null): Res {
  const b = bandaEdad(meses)
  const pamMin = [46, 55, 60, 62, 65, 67, 70][b]
  const crLim = [[0.8, 1.0, 1.2, 1.6], [0.3, 0.5, 0.8, 1.2], [0.4, 0.6, 1.1, 1.5], [0.6, 0.9, 1.6, 2.3], [0.7, 1.1, 1.8, 2.6], [1.0, 1.7, 2.9, 4.2], [1.2, 2.0, 3.5, 5.0]][b]
  const puntos: Record<string, number> = {}, faltantes: string[] = []
  let total = 0
  const poner = (k: string, v: number) => { puntos[k] = v; total += v }
  const fio2 = fraccion(num(d, 'fio2')), pao2 = num(d, 'pao2'), spo2 = num(d, 'spo2')
  let pafi = num(d, 'pafi')
  if (pafi === null && pao2 !== null && fio2 !== null && fio2 > 0) pafi = Math.round(pao2 / fio2)
  const safi = pafi === null && spo2 !== null && spo2 <= 97 && fio2 !== null && fio2 > 0 ? Math.round(spo2 / fio2) : null
  const vent = si(d, 'soporte_ventilatorio')
  if (pafi !== null) { poner('respiratorio', pafi < 100 && vent ? 4 : pafi < 200 && vent ? 3 : pafi < 300 ? 2 : pafi < 400 ? 1 : 0); puntos.pafi = pafi }
  else if (safi !== null) { poner('respiratorio', safi < 148 && vent ? 4 : safi <= 220 && vent ? 3 : safi <= 263 ? 2 : safi <= 291 ? 1 : 0); puntos.safi = safi }
  else faltantes.push('respiratorio')
  const plaq = num(d, 'plaquetas'), bili = num(d, 'bilirrubina'), gcs = num(d, 'glasgow'), cr = num(d, 'creatinina'), pam = pamDe(d)
  const vaso = String(d.vasopresor ?? 'ninguno')
  if (plaq === null) faltantes.push('coagulacion'); else poner('coagulacion', plaq < 20 ? 4 : plaq < 50 ? 3 : plaq < 100 ? 2 : plaq < 150 ? 1 : 0)
  if (bili === null) faltantes.push('higado'); else poner('higado', bili >= 12 ? 4 : bili >= 6 ? 3 : bili >= 2 ? 2 : bili >= 1.2 ? 1 : 0)
  if (vaso === 'ninguno' && pam === null) faltantes.push('cardiovascular')
  else poner('cardiovascular', vaso === 'dopa_mas15_o_nore_gt01' ? 4 : vaso === 'dopa_mas5_o_nore_le01' ? 3 : vaso === 'dopa5_dobuta' ? 2 : pam !== null && pam < pamMin ? 1 : 0)
  if (gcs === null) faltantes.push('neurologico'); else poner('neurologico', gcs < 6 ? 4 : gcs <= 9 ? 3 : gcs <= 12 ? 2 : gcs <= 14 ? 1 : 0)
  if (cr === null) faltantes.push('renal'); else poner('renal', cr >= crLim[3] ? 4 : cr >= crLim[2] ? 3 : cr >= crLim[1] ? 2 : cr >= crLim[0] ? 1 : 0)
  return { puntaje: total, puntos, faltantes }
}

// ---------------------------------------------------------------- Escalas por apartados
export type Apartado = { k: string; t: string; opciones: [number, string][] }

export const COMFORT_B: Apartado[] = [
  { k: 'alerta', t: 'Alerta', opciones: [[1, 'Profundamente dormido'], [2, 'Ligeramente dormido'], [3, 'Somnoliento'], [4, 'Despierto y alerta'], [5, 'Hiperalerta']] },
  { k: 'calma', t: 'Calma / agitación', opciones: [[1, 'Calmado'], [2, 'Ligeramente ansioso'], [3, 'Ansioso'], [4, 'Muy ansioso'], [5, 'Pánico']] },
  { k: 'respiratoria', t: 'Respuesta respiratoria (ventilado) o llanto (no ventilado)', opciones: [[1, 'Sin respiración espontánea / sin llanto'], [2, 'Respiración espontánea / sollozo o quejido'], [3, 'Tos o resistencia ocasional / gimoteo'], [4, 'Respira contra el ventilador / llanto'], [5, 'Lucha contra el ventilador, tose / grita']] },
  { k: 'movimiento', t: 'Movimiento físico', opciones: [[1, 'Ninguno'], [2, 'Ocasional, leve'], [3, 'Frecuente, leve'], [4, 'Vigoroso, limitado a extremidades'], [5, 'Vigoroso, incluye tronco y cabeza']] },
  { k: 'tono', t: 'Tono muscular', opciones: [[1, 'Relajado'], [2, 'Reducido'], [3, 'Normal'], [4, 'Aumentado, flexión de dedos'], [5, 'Rigidez extrema']] },
  { k: 'tension_facial', t: 'Tensión facial', opciones: [[1, 'Totalmente relajada'], [2, 'Normal'], [3, 'Tensión en algunos músculos'], [4, 'Tensión en toda la cara'], [5, 'Muecas, gesto de dolor']] },
]
export const PEWS: Apartado[] = [
  { k: 'conducta', t: 'Conducta', opciones: [[0, 'Juega o actúa apropiadamente'], [1, 'Dormido'], [2, 'Irritable'], [3, 'Letárgico, confuso o respuesta reducida al dolor']] },
  { k: 'cardiovascular', t: 'Cardiovascular', opciones: [[0, 'Rosado, llenado capilar 1–2 s'], [1, 'Pálido o llenado capilar 3 s'], [2, 'Grisáceo, llenado 4 s o FC 20 sobre lo normal'], [3, 'Grisáceo y marmóreo, llenado ≥ 5 s, FC 30 sobre lo normal o bradicardia']] },
  { k: 'respiratorio', t: 'Respiratorio', opciones: [[0, 'FR normal, sin tiraje'], [1, 'FR > 10 sobre lo normal, músculos accesorios, FiO₂ ≥ 30 % o ≥ 3 L/min'], [2, 'FR > 20 sobre lo normal, tiraje, FiO₂ ≥ 40 % o ≥ 6 L/min'], [3, 'FR 5 bajo lo normal con tiraje o quejido, FiO₂ ≥ 50 % o ≥ 8 L/min']] },
]
export const SILVERMAN: Apartado[] = [
  { k: 'torax_abdomen', t: 'Movimiento tórax-abdomen', opciones: [[0, 'Rítmico y regular'], [1, 'Tórax inmóvil, abdomen en movimiento'], [2, 'Disociación toracoabdominal (bamboleo)']] },
  { k: 'tiraje_intercostal', t: 'Tiraje intercostal', opciones: [[0, 'No'], [1, 'Discreto'], [2, 'Acentuado y constante']] },
  { k: 'retraccion_xifoidea', t: 'Retracción xifoidea', opciones: [[0, 'No'], [1, 'Discreta'], [2, 'Muy marcada']] },
  { k: 'aleteo_nasal', t: 'Aleteo nasal', opciones: [[0, 'No'], [1, 'Discreto'], [2, 'Muy acentuado']] },
  { k: 'quejido', t: 'Quejido espiratorio', opciones: [[0, 'No'], [1, 'Audible con estetoscopio'], [2, 'Audible sin estetoscopio']] },
]
export const NPASS: Apartado[] = [
  { k: 'llanto', t: 'Llanto / irritabilidad', opciones: [[-2, 'Sin llanto al estímulo doloroso'], [-1, 'Gime o llora poco al estímulo'], [0, 'Llanto apropiado, no irritable'], [1, 'Irritable o llanto intermitente, consolable'], [2, 'Llanto agudo o continuo, inconsolable']] },
  { k: 'estado_conductual', t: 'Estado conductual', opciones: [[-2, 'No despierta, sin movimiento espontáneo'], [-1, 'Despierta poco, mínimo movimiento'], [0, 'Apropiado para su edad gestacional'], [1, 'Inquieto, se retuerce, despierta seguido'], [2, 'Arqueado, patea, siempre despierto (o inmóvil sin sedación)']] },
  { k: 'expresion', t: 'Expresión facial', opciones: [[-2, 'Boca laxa, sin expresión'], [-1, 'Mínima expresión al estímulo'], [0, 'Relajada, apropiada'], [1, 'Gesto de dolor intermitente'], [2, 'Gesto de dolor continuo']] },
  { k: 'extremidades', t: 'Extremidades / tono', opciones: [[-2, 'Sin prensión, flácido'], [-1, 'Prensión débil, tono disminuido'], [0, 'Manos y pies relajados, tono normal'], [1, 'Puños o dedos tensos intermitentes'], [2, 'Puños o dedos tensos continuos, cuerpo tenso']] },
  { k: 'signos_vitales', t: 'Signos vitales (FC, FR, TA, SatO₂)', opciones: [[-2, 'Sin variación al estímulo, hipoventilación o apnea'], [-1, 'Variación < 10 % al estímulo'], [0, 'En su basal o normales para su edad'], [1, '↑ 10–20 %, SatO₂ 76–85 % al estimular, recupera rápido'], [2, '↑ > 20 %, SatO₂ ≤ 75 % al estimular, recupera lento']] },
]

function porApartados(d: Datos, lista: Apartado[], min: number, max: number) {
  const puntos: Record<string, number> = {}, faltantes: string[] = []
  for (const a of lista) {
    const v = num(d, a.k)
    if (v === null || v < min || v > max) faltantes.push(a.k)
    else puntos[a.k] = Math.trunc(v)
  }
  return { puntos, faltantes }
}

export function comfortB(d: Datos): Res {
  const { puntos, faltantes } = porApartados(d, COMFORT_B, 1, 5)
  const t = Object.values(puntos).reduce((a, b) => a + b, 0)
  return { puntaje: t, puntos, faltantes, interpretacion: t <= 10 ? 'sobresedacion' : t <= 22 ? 'adecuada' : 'sedacion_insuficiente' }
}
export function pews(d: Datos): Res {
  const { puntos, faltantes } = porApartados(d, PEWS, 0, 3)
  const max = Math.max(0, ...Object.values(puntos))
  if (si(d, 'nebulizaciones')) puntos.nebulizaciones = 2
  if (si(d, 'vomito_posqx')) puntos.vomito_posqx = 2
  const t = Object.values(puntos).reduce((a, b) => a + b, 0)
  return { puntaje: t, puntos, faltantes, interpretacion: t >= 5 ? 'urgente' : t >= 4 || max === 3 ? 'aviso_medico' : t === 3 ? 'vigilancia' : 'rutina' }
}
export function silverman(d: Datos): Res {
  const { puntos, faltantes } = porApartados(d, SILVERMAN, 0, 2)
  const t = Object.values(puntos).reduce((a, b) => a + b, 0)
  return { puntaje: t, puntos, faltantes, interpretacion: t === 0 ? 'sin_dificultad' : t <= 3 ? 'leve' : t <= 6 ? 'moderada' : 'grave' }
}
export function npass(d: Datos): Res {
  const { puntos, faltantes } = porApartados(d, NPASS, -2, 2)
  let dolor = 0, sed = 0
  for (const v of Object.values(puntos)) { dolor += Math.max(v, 0); sed += Math.min(v, 0) }
  const sem = num(d, 'semanas_corregidas')
  const corr = sem === null || sem >= 36 ? 0 : sem < 28 ? 3 : sem < 32 ? 2 : 1
  if (corr) puntos.prematurez = corr
  dolor += corr
  return { puntaje: dolor, sedacion: sed, puntos, faltantes, interpretacion: dolor > 3 ? 'dolor' : sed <= -5 ? 'sedacion_profunda' : sed <= -2 ? 'sedacion_ligera' : 'sin_dolor' }
}

// ---------------------------------------------------------------- SNAPPE-II
export function snappe2(d: Datos): Res {
  const puntos: Record<string, number> = {}, faltantes: string[] = []
  let total = 0
  const poner = (k: string, v: number) => { puntos[k] = v; total += v }
  const pam = pamDe(d), t = num(d, 'temperatura'), pao2 = num(d, 'pao2'), ph = num(d, 'ph')
  const ur = num(d, 'uresis_ml_kg_h'), peso = num(d, 'peso_nacer'), apgar = num(d, 'apgar5')
  let fio2 = num(d, 'fio2')
  if (fio2 !== null && fio2 <= 1) fio2 = fio2 * 100
  if (pam === null) faltantes.push('pam'); else poner('pam', pam >= 30 ? 0 : pam >= 20 ? 9 : 19)
  if (t === null) faltantes.push('temperatura'); else poner('temperatura', t > 35.6 ? 0 : t >= 35 ? 8 : 15)
  if (pao2 === null || fio2 === null || fio2 === 0) faltantes.push('oxigenacion')
  else { const r = Math.round((pao2 / fio2) * 100) / 100; poner('oxigenacion', r > 2.49 ? 0 : r >= 1 ? 5 : r >= 0.3 ? 16 : 28); puntos.razon_po2_fio2 = r }
  if (ph === null) faltantes.push('ph'); else poner('ph', ph >= 7.2 ? 0 : ph >= 7.1 ? 7 : 16)
  poner('convulsiones', si(d, 'convulsiones') ? 19 : 0)
  if (ur === null) faltantes.push('uresis'); else poner('uresis', ur >= 1 ? 0 : ur >= 0.1 ? 5 : 18)
  if (peso === null) faltantes.push('peso_nacer'); else poner('peso_nacer', peso >= 1000 ? 0 : peso >= 750 ? 10 : 17)
  poner('pequeno_eg', si(d, 'pequeno_eg') ? 12 : 0)
  if (apgar === null) faltantes.push('apgar5'); else poner('apgar5', apgar < 7 ? 18 : 0)
  return { puntaje: total, puntos, faltantes, interpretacion: total >= 40 ? 'alto' : total >= 20 ? 'intermedio' : 'bajo' }
}

// ---------------------------------------------------------------- CRIB II
export type FilaCrib = { sexo: 'H' | 'M'; peso_min: number; peso_max: number; semanas: number; puntos: number }
export function crib2(d: Datos, tabla: FilaCrib[]): Res & { error?: string } {
  const puntos: Record<string, number> = {}, faltantes: string[] = []
  let total = 0
  const sexo = d.sexo === 'H' || d.sexo === 'M' ? d.sexo : null
  const peso = num(d, 'peso_nacer'), sem = num(d, 'semanas_gestacion'), t = num(d, 'temperatura'), be = num(d, 'exceso_base')
  if (!sexo) faltantes.push('sexo')
  if (peso === null) faltantes.push('peso_nacer')
  if (sem === null) faltantes.push('semanas_gestacion')
  let error: string | undefined
  if (sexo && peso !== null && sem !== null) {
    if (sem > 32) error = 'CRIB II es para recién nacidos de 32 semanas o menos'
    else {
      const f = tabla.find((x) => x.sexo === sexo && Math.trunc(peso) >= x.peso_min && Math.trunc(peso) <= x.peso_max && x.semanas === Math.trunc(sem))
      if (!f) error = `CRIB II no tiene valor para ${peso} g con ${Math.trunc(sem)} semanas (fuera de la tabla)`
      else { puntos.peso_eg = f.puntos; total += f.puntos }
    }
  }
  if (t === null) faltantes.push('temperatura')
  else { const v = t <= 29.6 ? 5 : t <= 31.2 ? 4 : t <= 32.8 ? 3 : t <= 34.4 ? 2 : t <= 36 ? 1 : t <= 37.5 ? 0 : t <= 39.1 ? 1 : t <= 40.7 ? 2 : 3; puntos.temperatura = v; total += v }
  if (be === null) faltantes.push('exceso_base')
  else { const v = be < -26 ? 7 : be <= -23 ? 6 : be <= -18 ? 5 : be <= -13 ? 4 : be <= -8 ? 3 : be <= -3 ? 2 : be < 3 ? 1 : 0; puntos.exceso_base = v; total += v }
  const logit = -6.476 + 0.45 * total
  return { puntaje: total, puntos, faltantes, error, mortalidad: faltantes.length || error ? null : r1((100 * Math.exp(logit)) / (1 + Math.exp(logit))) }
}

// ---------------------------------------------------------------- nSOFA
export function nsofa(d: Datos): Res {
  const puntos: Record<string, number> = {}, faltantes: string[] = []
  let total = 0
  const intubado = si(d, 'intubado'), spo2 = num(d, 'spo2'), fio2 = fraccion(num(d, 'fio2'))
  const inot = Math.min(Math.trunc(num(d, 'inotropicos') ?? 0), 2), ester = si(d, 'esteroides'), plaq = num(d, 'plaquetas')
  if (!intubado) puntos.respiratorio = 0
  else if (spo2 === null || fio2 === null || fio2 === 0) faltantes.push('respiratorio')
  else {
    const safi = Math.round(spo2 / fio2)
    const v = safi < 100 ? 8 : safi < 150 ? 6 : safi < 200 ? 4 : safi < 300 ? 2 : 0
    puntos.respiratorio = v; puntos.safi = safi; total += v
  }
  const cv = inot === 0 && !ester ? 0 : inot === 0 ? 1 : inot === 1 && !ester ? 2 : inot === 2 && ester ? 4 : 3
  puntos.cardiovascular = cv; total += cv
  if (plaq === null) faltantes.push('hematologico')
  else { const v = plaq < 50 ? 3 : plaq < 100 ? 2 : plaq < 150 ? 1 : 0; puntos.hematologico = v; total += v }
  return { puntaje: total, puntos, faltantes }
}

// ---------------------------------------------------------------- Catálogo de escalas
export type ClaveEscala =
  | 'APACHE_II' | 'SOFA' | 'PIM3' | 'PELOD2' | 'PSOFA' | 'COMFORT_B' | 'PEWS' | 'SNAPPE_II' | 'CRIB_II' | 'NSOFA' | 'SILVERMAN' | 'NPASS'

export const ESCALAS_GRAVEDAD: Record<ClaveEscala, { nombre: string; grupo: 'adulto' | 'pediatrico' | 'neonatal'; cuando: string; enfermeria?: boolean; cita: string }> = {
  APACHE_II: { nombre: 'APACHE II', grupo: 'adulto', cuando: 'Ingreso (peores valores 24 h)', cita: 'Knaus 1985' },
  SOFA: { nombre: 'SOFA', grupo: 'adulto', cuando: 'Diario', cita: 'Vincent 1996' },
  PIM3: { nombre: 'PIM3', grupo: 'pediatrico', cuando: 'Ingreso (primera hora)', cita: 'Straney 2013' },
  PELOD2: { nombre: 'PELOD-2', grupo: 'pediatrico', cuando: 'Diario', cita: 'Leteurtre 2013' },
  PSOFA: { nombre: 'pSOFA', grupo: 'pediatrico', cuando: 'Diario', cita: 'Matics 2017' },
  COMFORT_B: { nombre: 'COMFORT-B', grupo: 'pediatrico', cuando: 'Sedación, por turno', enfermeria: true, cita: 'van Dijk 2005' },
  PEWS: { nombre: 'PEWS', grupo: 'pediatrico', cuando: 'Alerta temprana, con signos', enfermeria: true, cita: 'Monaghan 2005 (Brighton)' },
  SNAPPE_II: { nombre: 'SNAPPE-II', grupo: 'neonatal', cuando: 'Primeras 12 h de vida', cita: 'Richardson 2001' },
  CRIB_II: { nombre: 'CRIB II', grupo: 'neonatal', cuando: 'Primera hora, ≤ 32 semanas', cita: 'Parry 2003' },
  NSOFA: { nombre: 'nSOFA', grupo: 'neonatal', cuando: 'Diario', cita: 'Wynn 2020' },
  SILVERMAN: { nombre: 'Silverman-Andersen', grupo: 'neonatal', cuando: 'Dificultad respiratoria, por turno', enfermeria: true, cita: 'Silverman 1956' },
  NPASS: { nombre: 'N-PASS', grupo: 'neonatal', cuando: 'Dolor y sedación, por turno', enfermeria: true, cita: 'Hummel 2008' },
}

export const INTERPRETACION: Record<string, { texto: string; clase: string }> = {
  sobresedacion: { texto: 'Sobresedación', clase: 'bg-amber-100 text-amber-800' },
  adecuada: { texto: 'Sedación adecuada', clase: 'bg-emerald-100 text-emerald-800' },
  sedacion_insuficiente: { texto: 'Sedación insuficiente / distrés', clase: 'bg-red-100 text-red-800' },
  rutina: { texto: 'Vigilancia de rutina', clase: 'bg-emerald-100 text-emerald-800' },
  vigilancia: { texto: 'Aumentar vigilancia', clase: 'bg-amber-100 text-amber-800' },
  aviso_medico: { texto: 'Avisar al médico', clase: 'bg-orange-100 text-orange-800' },
  urgente: { texto: 'Valoración médica urgente', clase: 'bg-red-100 text-red-800' },
  sin_dificultad: { texto: 'Sin dificultad respiratoria', clase: 'bg-emerald-100 text-emerald-800' },
  leve: { texto: 'Dificultad leve', clase: 'bg-amber-100 text-amber-800' },
  moderada: { texto: 'Dificultad moderada', clase: 'bg-orange-100 text-orange-800' },
  grave: { texto: 'Dificultad grave', clase: 'bg-red-100 text-red-800' },
  dolor: { texto: 'Dolor: tratar (> 3)', clase: 'bg-red-100 text-red-800' },
  sedacion_profunda: { texto: 'Sedación profunda', clase: 'bg-amber-100 text-amber-800' },
  sedacion_ligera: { texto: 'Sedación ligera', clase: 'bg-sky-100 text-sky-800' },
  sin_dolor: { texto: 'Sin dolor', clase: 'bg-emerald-100 text-emerald-800' },
  bajo: { texto: 'Riesgo bajo', clase: 'bg-emerald-100 text-emerald-800' },
  intermedio: { texto: 'Riesgo intermedio', clase: 'bg-amber-100 text-amber-800' },
  alto: { texto: 'Riesgo alto', clase: 'bg-red-100 text-red-800' },
}

export const NOMBRE_COMPONENTE_PED: Record<string, string> = {
  pupilas: 'Pupilas', lactato: 'Lactato', paco2: 'PaCO₂', ventilacion: 'Ventilación invasiva', leucocitos: 'Leucocitos', plaquetas: 'Plaquetas',
  glasgow: 'Glasgow', pam: 'Presión arterial media', creatinina: 'Creatinina', oxigenacion: 'Oxigenación',
  respiratorio: 'Respiratorio', coagulacion: 'Coagulación', higado: 'Hígado', cardiovascular: 'Cardiovascular', neurologico: 'Neurológico', renal: 'Renal',
  hematologico: 'Hematológico', temperatura: 'Temperatura', ph: 'pH', convulsiones: 'Convulsiones', uresis: 'Uresis', peso_nacer: 'Peso al nacer',
  pequeno_eg: 'Pequeño para edad gestacional', apgar5: 'Apgar 5 min', peso_eg: 'Peso / edad gestacional / sexo', exceso_base: 'Exceso de base',
  nebulizaciones: 'Nebulizaciones frecuentes', vomito_posqx: 'Vómito posquirúrgico', prematurez: 'Corrección por prematurez',
  tas: 'TA sistólica', sexo: 'Sexo', semanas_gestacion: 'Semanas de gestación',
  ...Object.fromEntries([...COMFORT_B, ...PEWS, ...SILVERMAN, ...NPASS].map((a) => [a.k, a.t])),
}
