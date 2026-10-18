// Escalas de gravedad y alerta temprana.
// La base de datos calcula y guarda el puntaje oficial (35_escalas_gravedad.sql);
// estas funciones son la misma lógica para mostrar el resultado mientras se captura.

export type Datos = Record<string, number | string | boolean | null | undefined>

const num = (d: Datos, k: string): number | null => {
  const v = d[k]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v)
  return null
}
const bool = (d: Datos, k: string) => d[k] === true || d[k] === 'true'

export function pamDe(d: Datos): number | null {
  const pam = num(d, 'pam')
  if (pam !== null) return pam
  const tas = num(d, 'tas'), tad = num(d, 'tad')
  return tas !== null && tad !== null ? Math.round((tas + 2 * tad) / 3) : null
}

// ---------------------------------------------------------------- NEWS2
export type RiesgoNews = 'bajo' | 'bajo_medio' | 'medio' | 'alto'
export function news2(s: { fr?: number | null; spo2?: number | null; o2?: boolean | null; tas?: number | null; fc?: number | null; conciencia?: string | null; temp?: number | null }) {
  let total = 0, max = 0, n = 0
  const sumar = (v: number, cuentaMax = true) => { total += v; if (cuentaMax) max = Math.max(max, v); n++ }
  if (s.fr != null) sumar(s.fr <= 8 ? 3 : s.fr <= 11 ? 1 : s.fr <= 20 ? 0 : s.fr <= 24 ? 2 : 3)
  if (s.spo2 != null) sumar(s.spo2 <= 91 ? 3 : s.spo2 <= 93 ? 2 : s.spo2 <= 95 ? 1 : 0)
  if (s.o2 != null) sumar(s.o2 ? 2 : 0, false)
  if (s.tas != null) sumar(s.tas <= 90 ? 3 : s.tas <= 100 ? 2 : s.tas <= 110 ? 1 : s.tas <= 219 ? 0 : 3)
  if (s.fc != null) sumar(s.fc <= 40 ? 3 : s.fc <= 50 ? 1 : s.fc <= 90 ? 0 : s.fc <= 110 ? 1 : s.fc <= 130 ? 2 : 3)
  if (s.conciencia != null) sumar(s.conciencia === 'A' ? 0 : 3)
  if (s.temp != null) sumar(s.temp <= 35 ? 3 : s.temp <= 36 ? 1 : s.temp <= 38 ? 0 : s.temp <= 39 ? 1 : 2)
  const riesgo: RiesgoNews | null = n === 0 ? null : total >= 7 ? 'alto' : total >= 5 ? 'medio' : max === 3 ? 'bajo_medio' : 'bajo'
  return { puntaje: total, parametros: n, completo: n === 7, riesgo }
}

export const RIESGO_NEWS: Record<RiesgoNews, { texto: string; accion: string; clase: string }> = {
  bajo: { texto: 'Riesgo bajo', accion: 'Vigilancia habitual de enfermería', clase: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  bajo_medio: { texto: 'Riesgo bajo-medio', accion: 'Un parámetro en 3: valoración médica pronta', clase: 'bg-amber-50 text-amber-800 border-amber-300' },
  medio: { texto: 'Riesgo medio', accion: 'Valoración médica urgente; signos al menos cada hora', clase: 'bg-orange-50 text-orange-800 border-orange-300' },
  alto: { texto: 'Riesgo alto', accion: 'Valoración inmediata por médico con experiencia en paciente crítico; considerar UCI', clase: 'bg-red-50 text-red-800 border-red-300' },
}

export const AVPU: [string, string][] = [
  ['A', 'Alerta'],
  ['C', 'Confusión nueva'],
  ['V', 'Responde a la voz'],
  ['P', 'Responde al dolor'],
  ['U', 'No responde'],
]

// ---------------------------------------------------------------- APACHE II
export const TIPO_INGRESO: [string, string][] = [
  ['no_quirurgico', 'Médico (no quirúrgico)'],
  ['urgencia_postqx', 'Posquirúrgico de urgencia'],
  ['electivo_postqx', 'Posquirúrgico electivo'],
]

export function apache2(d: Datos, edad: number | null) {
  const puntos: Record<string, number> = {}
  const faltantes: string[] = []
  let fisio = 0
  const poner = (k: string, v: number) => { puntos[k] = v; fisio += v }

  const t = num(d, 'temperatura')
  if (t === null) faltantes.push('temperatura')
  else poner('temperatura', t >= 41 ? 4 : t >= 39 ? 3 : t >= 38.5 ? 1 : t >= 36 ? 0 : t >= 34 ? 1 : t >= 32 ? 2 : t >= 30 ? 3 : 4)
  const pam = pamDe(d)
  if (pam === null) faltantes.push('pam')
  else poner('pam', pam >= 160 ? 4 : pam >= 130 ? 3 : pam >= 110 ? 2 : pam >= 70 ? 0 : pam >= 50 ? 2 : 4)
  const fc = num(d, 'fc')
  if (fc === null) faltantes.push('fc')
  else poner('fc', fc >= 180 ? 4 : fc >= 140 ? 3 : fc >= 110 ? 2 : fc >= 70 ? 0 : fc >= 55 ? 2 : fc >= 40 ? 3 : 4)
  const fr = num(d, 'fr')
  if (fr === null) faltantes.push('fr')
  else poner('fr', fr >= 50 ? 4 : fr >= 35 ? 3 : fr >= 25 ? 1 : fr >= 12 ? 0 : fr >= 10 ? 1 : fr >= 6 ? 2 : 4)

  let fio2 = num(d, 'fio2')
  if (fio2 !== null && fio2 > 1) fio2 = fio2 / 100
  const pao2 = num(d, 'pao2'), paco2 = num(d, 'paco2'), patm = num(d, 'patm') ?? 760
  let aado2 = num(d, 'aado2')
  if (fio2 !== null && fio2 >= 0.5) {
    if (aado2 === null && pao2 !== null && paco2 !== null) aado2 = Math.round(fio2 * (patm - 47) - paco2 / 0.8 - pao2)
    if (aado2 === null) faltantes.push('oxigenacion')
    else { poner('oxigenacion', aado2 >= 500 ? 4 : aado2 >= 350 ? 3 : aado2 >= 200 ? 2 : 0); puntos.aado2 = aado2 }
  } else if (pao2 === null) faltantes.push('oxigenacion')
  else poner('oxigenacion', pao2 > 70 ? 0 : pao2 >= 61 ? 1 : pao2 >= 55 ? 3 : 4)

  const ph = num(d, 'ph'), hco3 = num(d, 'hco3')
  if (ph !== null) poner('acido_base', ph >= 7.7 ? 4 : ph >= 7.6 ? 3 : ph >= 7.5 ? 1 : ph >= 7.33 ? 0 : ph >= 7.25 ? 2 : ph >= 7.15 ? 3 : 4)
  else if (hco3 !== null) poner('acido_base', hco3 >= 52 ? 4 : hco3 >= 41 ? 3 : hco3 >= 32 ? 1 : hco3 >= 22 ? 0 : hco3 >= 18 ? 2 : hco3 >= 15 ? 3 : 4)
  else faltantes.push('acido_base')

  const na = num(d, 'sodio')
  if (na === null) faltantes.push('sodio')
  else poner('sodio', na >= 180 ? 4 : na >= 160 ? 3 : na >= 155 ? 2 : na >= 150 ? 1 : na >= 130 ? 0 : na >= 120 ? 2 : na >= 111 ? 3 : 4)
  const k = num(d, 'potasio')
  if (k === null) faltantes.push('potasio')
  else poner('potasio', k >= 7 ? 4 : k >= 6 ? 3 : k >= 5.5 ? 1 : k >= 3.5 ? 0 : k >= 3 ? 1 : k >= 2.5 ? 2 : 4)
  const cr = num(d, 'creatinina')
  if (cr === null) faltantes.push('creatinina')
  else {
    let v = cr >= 3.5 ? 4 : cr >= 2 ? 3 : cr >= 1.5 ? 2 : cr >= 0.6 ? 0 : 2
    if (bool(d, 'ira')) v *= 2
    poner('creatinina', v)
  }
  const hto = num(d, 'hematocrito')
  if (hto === null) faltantes.push('hematocrito')
  else poner('hematocrito', hto >= 60 ? 4 : hto >= 50 ? 2 : hto >= 46 ? 1 : hto >= 30 ? 0 : hto >= 20 ? 2 : 4)
  const leu = num(d, 'leucocitos')
  if (leu === null) faltantes.push('leucocitos')
  else poner('leucocitos', leu >= 40 ? 4 : leu >= 20 ? 2 : leu >= 15 ? 1 : leu >= 3 ? 0 : leu >= 1 ? 2 : 4)
  const gcs = num(d, 'glasgow')
  if (gcs === null) faltantes.push('glasgow')
  else poner('glasgow', 15 - Math.max(3, Math.min(15, Math.trunc(gcs))))

  const ped = edad === null ? 0 : edad <= 44 ? 0 : edad <= 54 ? 2 : edad <= 64 ? 3 : edad <= 74 ? 5 : 6
  const tipo = typeof d.tipo_ingreso === 'string' ? d.tipo_ingreso : 'no_quirurgico'
  const cronico = bool(d, 'cronico') ? (tipo === 'electivo_postqx' ? 2 : 5) : 0
  const total = fisio + ped + cronico
  const tabla = tipo === 'no_quirurgico' ? [4, 8, 15, 24, 40, 55, 73, 85] : [1, 3, 7, 12, 30, 35, 73, 88]
  const mortalidad = tabla[Math.min(7, Math.floor(total / 5))]
  return { puntaje: total, fisiologico: fisio, edad: ped, cronico, puntos, faltantes, mortalidad }
}

// ---------------------------------------------------------------- SOFA
export const VASOPRESOR: [string, string][] = [
  ['ninguno', 'Sin vasopresor'],
  ['dopa5_dobuta', 'Dopamina ≤ 5 o dobutamina (cualquier dosis)'],
  ['dopa_mas5_o_nore_le01', 'Dopamina > 5, o norepinefrina/epinefrina ≤ 0.1'],
  ['dopa_mas15_o_nore_gt01', 'Dopamina > 15, o norepinefrina/epinefrina > 0.1'],
]

export function sofa(d: Datos) {
  const puntos: Record<string, number> = {}
  const faltantes: string[] = []
  let total = 0
  const poner = (k: string, v: number) => { puntos[k] = v; total += v }
  let fio2 = num(d, 'fio2')
  if (fio2 !== null && fio2 > 1) fio2 = fio2 / 100
  let pafi = num(d, 'pafi')
  const pao2 = num(d, 'pao2')
  if (pafi === null && pao2 !== null && fio2 !== null && fio2 > 0) pafi = Math.round(pao2 / fio2)
  const vent = bool(d, 'soporte_ventilatorio')
  if (pafi === null) faltantes.push('respiratorio')
  else { poner('respiratorio', pafi < 100 && vent ? 4 : pafi < 200 && vent ? 3 : pafi < 300 ? 2 : pafi < 400 ? 1 : 0); puntos.pafi = pafi }
  const plaq = num(d, 'plaquetas')
  if (plaq === null) faltantes.push('coagulacion')
  else poner('coagulacion', plaq < 20 ? 4 : plaq < 50 ? 3 : plaq < 100 ? 2 : plaq < 150 ? 1 : 0)
  const bili = num(d, 'bilirrubina')
  if (bili === null) faltantes.push('higado')
  else poner('higado', bili >= 12 ? 4 : bili >= 6 ? 3 : bili >= 2 ? 2 : bili >= 1.2 ? 1 : 0)
  const vaso = typeof d.vasopresor === 'string' ? d.vasopresor : 'ninguno'
  const pam = pamDe(d)
  if (vaso === 'ninguno' && pam === null) faltantes.push('cardiovascular')
  else poner('cardiovascular', vaso === 'dopa_mas15_o_nore_gt01' ? 4 : vaso === 'dopa_mas5_o_nore_le01' ? 3 : vaso === 'dopa5_dobuta' ? 2 : (pam ?? 70) < 70 ? 1 : 0)
  const gcs = num(d, 'glasgow')
  if (gcs === null) faltantes.push('neurologico')
  else poner('neurologico', gcs < 6 ? 4 : gcs <= 9 ? 3 : gcs <= 12 ? 2 : gcs <= 14 ? 1 : 0)
  const cr = num(d, 'creatinina'), ur = num(d, 'uresis_ml_dia')
  if (cr === null && ur === null) faltantes.push('renal')
  else poner('renal', Math.max(
    cr === null ? 0 : cr >= 5 ? 4 : cr >= 3.5 ? 3 : cr >= 2 ? 2 : cr >= 1.2 ? 1 : 0,
    ur === null ? 0 : ur < 200 ? 4 : ur < 500 ? 3 : 0))
  return { puntaje: total, puntos, faltantes }
}

export const NOMBRE_COMPONENTE: Record<string, string> = {
  temperatura: 'Temperatura', pam: 'Presión arterial media', fc: 'Frecuencia cardiaca', fr: 'Frecuencia respiratoria',
  oxigenacion: 'Oxigenación', acido_base: 'pH / HCO₃', sodio: 'Sodio', potasio: 'Potasio', creatinina: 'Creatinina',
  hematocrito: 'Hematocrito', leucocitos: 'Leucocitos', glasgow: 'Glasgow',
  respiratorio: 'Respiratorio', coagulacion: 'Coagulación', higado: 'Hígado', cardiovascular: 'Cardiovascular',
  neurologico: 'Neurológico', renal: 'Renal',
}
