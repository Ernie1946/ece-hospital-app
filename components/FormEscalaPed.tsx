'use client'

import { useMemo, useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { VASOPRESOR, type Datos } from '@/lib/escalas'
import {
  COMFORT_B, ESCALAS_GRAVEDAD, INTERPRETACION, NOMBRE_COMPONENTE_PED, NPASS, PEWS, PROCEDIMIENTO_PIM3, RIESGO_DX_PIM3, SILVERMAN,
  comfortB, crib2, nsofa, npass, pelod2, pews, pim3, psofa, silverman, snappe2,
  type Apartado, type ClaveEscala, type FilaCrib, type Res,
} from '@/lib/escalas-ped'

type Num = { k: string; t: string; u?: string; paso?: string }
type Si = { k: string; t: string }
type Sel = { k: string; t: string; opciones: [string, string][] }
type Campos = { nums?: Num[]; si?: Si[]; sel?: Sel[]; apartados?: Apartado[] }

const TAS: Num = { k: 'tas', t: 'TA sistólica', u: 'mmHg' }
const TAD: Num = { k: 'tad', t: 'TA diastólica', u: 'mmHg' }
const FIO2: Num = { k: 'fio2', t: 'FiO₂', u: '%' }
const PAO2: Num = { k: 'pao2', t: 'PaO₂', u: 'mmHg' }
const GCS: Num = { k: 'glasgow', t: 'Glasgow', u: '3–15' }
const CREAT: Num = { k: 'creatinina', t: 'Creatinina', u: 'mg/dL', paso: '0.01' }
const PLAQ: Num = { k: 'plaquetas', t: 'Plaquetas', u: '×10³/µL' }
const SPO2: Num = { k: 'spo2', t: 'SpO₂', u: '%' }
const TEMP: Num = { k: 'temperatura', t: 'Temperatura', u: '°C', paso: '0.1' }
const BE: Num = { k: 'exceso_base', t: 'Exceso de base', u: 'mmol/L', paso: '0.1' }
const PESO: Num = { k: 'peso_nacer', t: 'Peso al nacer', u: 'g' }

const CAMPOS: Record<Exclude<ClaveEscala, 'APACHE_II' | 'SOFA'>, Campos> = {
  PIM3: {
    nums: [TAS, BE, FIO2, PAO2],
    si: [{ k: 'pupilas_fijas', t: 'Pupilas fijas a la luz (> 3 mm, ambas)' }, { k: 'ventilacion', t: 'Ventilación mecánica en la 1.ª hora (incluye CPAP/VNI)' }, { k: 'electivo', t: 'Ingreso programado (electivo)' }],
    sel: [{ k: 'procedimiento', t: 'Recuperación de procedimiento', opciones: PROCEDIMIENTO_PIM3 }, { k: 'riesgo_dx', t: 'Diagnóstico de riesgo', opciones: RIESGO_DX_PIM3 }],
  },
  PELOD2: {
    nums: [GCS, { k: 'lactato', t: 'Lactato', u: 'mmol/L', paso: '0.1' }, TAS, TAD, CREAT, PAO2, FIO2, { k: 'paco2', t: 'PaCO₂', u: 'mmHg' }, { k: 'leucocitos', t: 'Leucocitos', u: '×10³/µL', paso: '0.1' }, PLAQ],
    si: [{ k: 'pupilas_fijas', t: 'Ambas pupilas fijas' }, { k: 'ventilacion', t: 'Ventilación mecánica invasiva' }],
  },
  PSOFA: {
    nums: [PAO2, FIO2, { ...SPO2, t: 'SpO₂ (si no hay gasometría)' }, PLAQ, { k: 'bilirrubina', t: 'Bilirrubina', u: 'mg/dL', paso: '0.1' }, TAS, TAD, GCS, CREAT],
    si: [{ k: 'soporte_ventilatorio', t: 'Con soporte ventilatorio (necesario para 3–4 puntos respiratorios)' }],
    sel: [{ k: 'vasopresor', t: 'Vasopresores (µg/kg/min)', opciones: VASOPRESOR }],
  },
  COMFORT_B: { apartados: COMFORT_B },
  PEWS: { apartados: PEWS, si: [{ k: 'nebulizaciones', t: 'Nebulizaciones cada 15 min (+2)' }, { k: 'vomito_posqx', t: 'Vómito persistente posquirúrgico (+2)' }] },
  SNAPPE_II: {
    nums: [TAS, TAD, { ...TEMP, t: 'Temperatura más baja' }, PAO2, FIO2, { k: 'ph', t: 'pH más bajo', paso: '0.01' }, { k: 'uresis_ml_kg_h', t: 'Uresis', u: 'mL/kg/h', paso: '0.1' }, PESO, { k: 'apgar5', t: 'Apgar a los 5 min' }],
    si: [{ k: 'convulsiones', t: 'Crisis convulsivas múltiples' }, { k: 'pequeno_eg', t: 'Pequeño para edad gestacional (< percentil 3)' }],
  },
  CRIB_II: {
    nums: [PESO, { k: 'semanas_gestacion', t: 'Semanas de gestación' }, { ...TEMP, t: 'Temperatura al ingreso' }, { ...BE, t: 'Exceso de base (1.ª hora)' }],
    sel: [{ k: 'sexo', t: 'Sexo', opciones: [['H', 'Masculino'], ['M', 'Femenino']] }],
  },
  NSOFA: {
    nums: [SPO2, FIO2, PLAQ],
    si: [{ k: 'intubado', t: 'Intubado' }, { k: 'esteroides', t: 'Corticoesteroide sistémico (choque)' }],
    sel: [{ k: 'inotropicos', t: 'Inotrópicos / vasopresores', opciones: [['0', 'Ninguno'], ['1', 'Uno'], ['2', 'Dos o más']] }],
  },
  SILVERMAN: { apartados: SILVERMAN },
  NPASS: { apartados: NPASS, nums: [{ k: 'semanas_corregidas', t: 'Semanas de gestación corregidas' }] },
}

type ClavePed = keyof typeof CAMPOS

function calcular(e: ClavePed, d: Datos, meses: number | null, tabla: FilaCrib[]): Res & { error?: string } {
  switch (e) {
    case 'PIM3': return pim3(d)
    case 'PELOD2': return pelod2(d, meses)
    case 'PSOFA': return psofa(d, meses)
    case 'COMFORT_B': return comfortB(d)
    case 'PEWS': return pews(d)
    case 'SNAPPE_II': return snappe2(d)
    case 'CRIB_II': return crib2(d, tabla)
    case 'NSOFA': return nsofa(d)
    case 'SILVERMAN': return silverman(d)
    case 'NPASS': return npass(d)
  }
}

// Solo las claves de la escala elegida, con números como números
function datosDe(e: ClavePed, d: Datos) {
  const c = CAMPOS[e]
  const out: Record<string, number | string | boolean> = {}
  for (const n of [...(c.nums ?? []), ...(c.apartados ?? [])]) {
    const v = d[n.k]
    if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))) out[n.k] = Number(v)
  }
  for (const s of c.si ?? []) out[s.k] = d[s.k] === true
  for (const s of c.sel ?? []) if (typeof d[s.k] === 'string' && d[s.k] !== '') out[s.k] = s.k === 'inotropicos' ? Number(d[s.k]) : String(d[s.k])
  return out
}

export function FormEscalaPed({
  accion,
  escalas,
  meses,
  sexo,
  tablaCrib,
  inicial,
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  escalas: ClavePed[]
  meses: number | null
  sexo: string | null
  tablaCrib: FilaCrib[]
  inicial: Record<string, number | null>
}) {
  const [escala, setEscala] = useState<ClavePed>(escalas[0])
  const [d, setD] = useState<Datos>(() => {
    const x: Datos = { procedimiento: 'ninguno', riesgo_dx: 'ninguno', vasopresor: 'ninguno', inotropicos: '0' }
    if (sexo === 'H' || sexo === 'M') x.sexo = sexo
    for (const [k, v] of Object.entries(inicial)) if (v !== null) x[k] = String(v)
    return x
  })
  const poner = (k: string, v: string | boolean) => setD((p) => ({ ...p, [k]: v }))
  const res = useMemo(() => calcular(escala, d, meses, tablaCrib), [escala, d, meses, tablaCrib])
  const c = CAMPOS[escala]
  const info = ESCALAS_GRAVEDAD[escala]
  const interp = res.interpretacion ? INTERPRETACION[res.interpretacion] : null

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <FormAccion
        accion={accion}
        boton={`Guardar ${info.nombre}`}
        className="space-y-3"
        alGuardar={() => setD((p) => { const x = { ...p }; for (const a of c.apartados ?? []) delete x[a.k]; return x })}
      >
        <input type="hidden" name="escala" value={escala} />
        <input type="hidden" name="datos" value={JSON.stringify(datosDe(escala, d))} />
        <div className="flex flex-wrap gap-2" role="tablist">
          {escalas.map((e) => (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={escala === e}
              onClick={() => setEscala(e)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${escala === e ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
            >
              {ESCALAS_GRAVEDAD[e].nombre}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {info.nombre}: {info.cuando.toLowerCase()}. {c.nums?.some((n) => n.k === 'tas') ? 'Se precargan los últimos signos vitales.' : ''}
        </p>

        {c.apartados?.map((a) => (
          <fieldset key={a.k} className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">{a.t}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {a.opciones.map(([v, t]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-sm ${String(d[a.k]) === String(v) ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <input type="radio" name={`r_${a.k}`} checked={String(d[a.k]) === String(v)} onChange={() => poner(a.k, String(v))} className="mt-0.5" />
                  <span><b className="tabular-nums">{v > 0 && a.opciones.some(([x]) => x < 0) ? `+${v}` : v}</b> · {t}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        {c.sel?.map((s) => (
          <label key={s.k} className={claseEtiqueta}>
            {s.t}
            <select value={String(d[s.k] ?? '')} onChange={(e) => poner(s.k, e.target.value)} className={claseCampo}>
              {s.k === 'sexo' && <option value="">—</option>}
              {s.opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
        ))}

        {c.nums && c.nums.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {c.nums.map((n) => (
              <label key={n.k} className={claseEtiqueta}>
                {n.t} {n.u && <span className="font-normal text-slate-400">({n.u})</span>}
                <input
                  type="number"
                  inputMode="decimal"
                  step={n.paso ?? '1'}
                  aria-label={n.t}
                  value={typeof d[n.k] === 'string' || typeof d[n.k] === 'number' ? String(d[n.k]) : ''}
                  onChange={(e) => poner(n.k, e.target.value)}
                  className={claseCampo}
                />
              </label>
            ))}
          </div>
        )}

        {c.si?.map((s) => (
          <label key={s.k} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={d[s.k] === true} onChange={(e) => poner(s.k, e.target.checked)} className="h-4 w-4" /> {s.t}
          </label>
        ))}

        <label className={`${claseEtiqueta} max-w-xs`}>
          Fecha y hora de la evaluación <span className="font-normal text-slate-400">(vacío = ahora)</span>
          <input type="datetime-local" name="evaluado_en" className={claseCampo} />
        </label>
      </FormAccion>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4" aria-live="polite">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{info.nombre} (vista previa)</p>
        {escala === 'PIM3' ? (
          <p className="mt-1 text-4xl font-semibold text-slate-900">{res.mortalidad} %</p>
        ) : (
          <p className="mt-1 text-4xl font-semibold text-slate-900">{res.puntaje}</p>
        )}
        {escala === 'PIM3' ? (
          <p className="text-sm text-slate-700">Mortalidad estimada</p>
        ) : (
          res.mortalidad != null && <p className="text-sm text-slate-700">Mortalidad estimada ≈ {res.mortalidad} %</p>
        )}
        {escala === 'NPASS' && <p className="text-sm text-slate-700">Dolor {res.puntaje} · Sedación {res.sedacion}</p>}
        {interp && !res.faltantes.length && <p className={`mt-2 inline-block rounded px-2 py-0.5 text-sm font-medium ${interp.clase}`}>{interp.texto}</p>}
        {escala !== 'PIM3' && (
          <ul className="mt-3 space-y-0.5 text-sm">
            {Object.entries(res.puntos)
              .filter(([k]) => k in NOMBRE_COMPONENTE_PED)
              .map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-slate-600">{NOMBRE_COMPONENTE_PED[k]}</span>
                  <span className={v !== 0 ? 'font-semibold text-slate-900' : 'text-slate-400'}>{v}</span>
                </li>
              ))}
          </ul>
        )}
        {'pafi' in res.puntos && <p className="mt-1 text-xs text-slate-500">PaO₂/FiO₂ {res.puntos.pafi}</p>}
        {'safi' in res.puntos && <p className="mt-1 text-xs text-slate-500">SpO₂/FiO₂ {res.puntos.safi}</p>}
        {res.error && <p className="mt-3 text-xs font-medium text-red-700">{res.error}</p>}
        {res.faltantes.length > 0 && (
          <p className="mt-3 text-xs text-amber-800">
            {escala === 'PIM3' ? 'Sin dato (se usa el valor normal): ' : 'Faltan: '}
            {res.faltantes.map((f) => NOMBRE_COMPONENTE_PED[f] ?? f).join(', ')}.
          </p>
        )}
        <p className="mt-3 text-[11px] leading-snug text-slate-400">{info.cita}. Orienta, no sustituye el juicio clínico.</p>
      </aside>
    </div>
  )
}
