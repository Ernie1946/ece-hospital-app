'use client'

import { useMemo, useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { NOMBRE_COMPONENTE, TIPO_INGRESO, VASOPRESOR, apache2, sofa, type Datos } from '@/lib/escalas'

type Campo = { k: string; t: string; u?: string; paso?: string }

const VITALES: Campo[] = [
  { k: 'temperatura', t: 'Temperatura', u: '°C', paso: '0.1' },
  { k: 'tas', t: 'TA sistólica', u: 'mmHg' },
  { k: 'tad', t: 'TA diastólica', u: 'mmHg' },
  { k: 'fc', t: 'FC', u: 'lpm' },
  { k: 'fr', t: 'FR', u: 'rpm' },
  { k: 'glasgow', t: 'Glasgow', u: '3–15' },
]
const GASES: Campo[] = [
  { k: 'fio2', t: 'FiO₂', u: '%' },
  { k: 'pao2', t: 'PaO₂', u: 'mmHg' },
  { k: 'paco2', t: 'PaCO₂', u: 'mmHg' },
  { k: 'ph', t: 'pH arterial', paso: '0.01' },
  { k: 'hco3', t: 'HCO₃ (si no hay gasometría)', u: 'mEq/L', paso: '0.1' },
]
const LAB_APACHE: Campo[] = [
  { k: 'sodio', t: 'Sodio', u: 'mEq/L' },
  { k: 'potasio', t: 'Potasio', u: 'mEq/L', paso: '0.1' },
  { k: 'creatinina', t: 'Creatinina', u: 'mg/dL', paso: '0.01' },
  { k: 'hematocrito', t: 'Hematocrito', u: '%', paso: '0.1' },
  { k: 'leucocitos', t: 'Leucocitos', u: '×10³/µL', paso: '0.1' },
]
const LAB_SOFA: Campo[] = [
  { k: 'plaquetas', t: 'Plaquetas', u: '×10³/µL' },
  { k: 'bilirrubina', t: 'Bilirrubina total', u: 'mg/dL', paso: '0.1' },
  { k: 'creatinina', t: 'Creatinina', u: 'mg/dL', paso: '0.01' },
  { k: 'uresis_ml_dia', t: 'Uresis 24 h', u: 'mL' },
]

export function FormEscalaGravedad({
  accion,
  edad,
  patm,
  inicial,
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  edad: number | null
  patm: number
  inicial: Record<string, number | null>
}) {
  const [escala, setEscala] = useState<'APACHE_II' | 'SOFA'>('APACHE_II')
  const [d, setD] = useState<Datos>(() => {
    const x: Datos = { patm }
    for (const [k, v] of Object.entries(inicial)) if (v !== null) x[k] = String(v)
    return x
  })
  const poner = (k: string, v: string | boolean) => setD((p) => ({ ...p, [k]: v }))

  const ap = useMemo(() => (escala === 'APACHE_II' ? apache2(d, edad) : null), [escala, d, edad])
  const so = useMemo(() => (escala === 'SOFA' ? sofa(d) : null), [escala, d])
  const res = (ap ?? so)!
  const mort = ap?.mortalidad ?? null

  const campo = (c: Campo) => (
    <label key={c.k} className={claseEtiqueta}>
      {c.t} {c.u && <span className="font-normal text-slate-400">({c.u})</span>}
      <input
        name={c.k}
        type="number"
        inputMode="decimal"
        step={c.paso ?? '1'}
        value={typeof d[c.k] === 'string' || typeof d[c.k] === 'number' ? String(d[c.k]) : ''}
        onChange={(e) => poner(c.k, e.target.value)}
        className={claseCampo}
      />
    </label>
  )
  const casilla = (k: string, t: string) => (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={k} checked={d[k] === true} onChange={(e) => poner(k, e.target.checked)} className="h-4 w-4" /> {t}
    </label>
  )
  const grupo = (titulo: string, campos: Campo[]) => (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{campos.map(campo)}</div>
    </fieldset>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <FormAccion accion={accion} boton={`Guardar ${escala === 'APACHE_II' ? 'APACHE II' : 'SOFA'}`} className="space-y-3">
        <input type="hidden" name="escala" value={escala} />
        <input type="hidden" name="patm" value={patm} />
        <div className="flex gap-2" role="tablist">
          {(['APACHE_II', 'SOFA'] as const).map((e) => (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={escala === e}
              onClick={() => setEscala(e)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${escala === e ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
            >
              {e === 'APACHE_II' ? 'APACHE II (ingreso, peores valores 24 h)' : 'SOFA (diario)'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Se precargan los últimos signos vitales; los laboratorios se capturan del reporte. {escala === 'APACHE_II' ? 'Usa el valor más alterado de las primeras 24 h.' : 'Usa el peor valor del día.'}
        </p>

        {escala === 'APACHE_II' ? (
          <>
            {grupo('Signos', VITALES)}
            {grupo('Oxigenación y ácido-base', GASES)}
            {grupo('Laboratorio', LAB_APACHE)}
            <fieldset className="rounded-lg border border-slate-200 p-3 space-y-2">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ingreso y antecedentes</legend>
              <label className={claseEtiqueta}>
                Tipo de ingreso
                <select name="tipo_ingreso" value={String(d.tipo_ingreso ?? 'no_quirurgico')} onChange={(e) => poner('tipo_ingreso', e.target.value)} className={claseCampo}>
                  {TIPO_INGRESO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </label>
              {casilla('cronico', 'Insuficiencia orgánica grave o inmunocompromiso (cirrosis, NYHA IV, EPOC grave, diálisis, inmunosupresión)')}
              {casilla('ira', 'Lesión renal aguda (duplica los puntos de creatinina)')}
            </fieldset>
          </>
        ) : (
          <>
            {grupo('Respiratorio, neurológico y presión', [GASES[0], GASES[1], VITALES[1], VITALES[2], VITALES[5]])}
            {casilla('soporte_ventilatorio', 'Con ventilación mecánica o soporte ventilatorio (necesario para 3–4 puntos respiratorios)')}
            <label className={claseEtiqueta}>
              Vasopresores (µg/kg/min, ≥ 1 h)
              <select name="vasopresor" value={String(d.vasopresor ?? 'ninguno')} onChange={(e) => poner('vasopresor', e.target.value)} className={claseCampo}>
                {VASOPRESOR.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            {grupo('Laboratorio y función renal', LAB_SOFA)}
          </>
        )}
        <label className={`${claseEtiqueta} max-w-xs`}>
          Fecha y hora de la evaluación <span className="font-normal text-slate-400">(vacío = ahora)</span>
          <input type="datetime-local" name="evaluado_en" className={claseCampo} />
        </label>
      </FormAccion>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4" aria-live="polite">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{escala === 'APACHE_II' ? 'APACHE II' : 'SOFA'} (vista previa)</p>
        <p className="mt-1 text-4xl font-semibold text-slate-900">{res.puntaje}</p>
        {mort != null && <p className="text-sm text-slate-700">Mortalidad estimada ≈ {mort} %</p>}
        {ap && (
          <p className="mt-1 text-xs text-slate-500">Fisiológico {ap.fisiologico} · Edad {ap.edad} ({edad ?? '?'} años) · Crónico {ap.cronico}</p>
        )}
        <ul className="mt-3 space-y-0.5 text-sm">
          {Object.entries(res.puntos)
            .filter(([k]) => k in NOMBRE_COMPONENTE)
            .map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="text-slate-600">{NOMBRE_COMPONENTE[k]}</span>
                <span className={v > 0 ? 'font-semibold text-slate-900' : 'text-slate-400'}>{v}</span>
              </li>
            ))}
        </ul>
        {'aado2' in res.puntos && <p className="mt-1 text-xs text-slate-500">A-aDO₂ {res.puntos.aado2} mmHg (Patm {patm})</p>}
        {'pafi' in res.puntos && <p className="mt-1 text-xs text-slate-500">PaO₂/FiO₂ {res.puntos.pafi}</p>}
        {res.faltantes.length > 0 && (
          <p className="mt-3 text-xs text-amber-800">
            Faltan: {res.faltantes.map((f) => NOMBRE_COMPONENTE[f] ?? f).join(', ')} (cuentan 0).
            {escala === 'APACHE_II' && res.faltantes.length > 3 && ' Con más de 3 faltantes no se puede guardar.'}
          </p>
        )}
        <p className="mt-3 text-[11px] leading-snug text-slate-400">
          {escala === 'APACHE_II'
            ? 'Knaus 1985. Mortalidad aproximada por rango; orienta, no sustituye el juicio clínico.'
            : 'Vincent 1996. Un aumento ≥ 2 puntos sugiere disfunción orgánica (Sepsis-3).'}
        </p>
      </aside>
    </div>
  )
}
