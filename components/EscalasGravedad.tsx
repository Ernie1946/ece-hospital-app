import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { claseTarjeta } from '@/lib/estilos'
import { fechaHora } from '@/lib/formato'
import { ESCALAS_GRAVEDAD, INTERPRETACION, type ClaveEscala } from '@/lib/escalas-ped'

export type EvalGravedad = {
  id: number
  escala: ClaveEscala
  evaluado_en: string
  puntaje: number
  mortalidad: number | null
  delta: number | null
  resultado: { faltantes?: string[]; puntos?: Record<string, number>; tipo_ingreso?: string; interpretacion?: string; sedacion?: number }
  datos: Record<string, unknown>
  registrado_por: string
  registrado_por_nombre: string
  anulado: boolean
  motivo_anulacion: string | null
}

type Edad = { anios: number; meses: number; dias: number } | null

export function colorSofa(p: number) {
  return p >= 11 ? 'bg-red-100 text-red-800' : p >= 7 ? 'bg-orange-100 text-orange-800' : p >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
}
export function colorApache(p: number) {
  return p >= 25 ? 'bg-red-100 text-red-800' : p >= 15 ? 'bg-orange-100 text-orange-800' : p >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
}
function colorMortalidad(m: number) {
  return m >= 30 ? 'bg-red-100 text-red-800' : m >= 10 ? 'bg-orange-100 text-orange-800' : m >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
}
// Color de la evaluación: interpretación de la escala, mortalidad o, en las de disfunción, el puntaje
export function claseEvaluacion(e: Pick<EvalGravedad, 'escala' | 'puntaje' | 'mortalidad' | 'resultado'>) {
  const i = e.resultado?.interpretacion
  if (i && INTERPRETACION[i]) return INTERPRETACION[i].clase
  if (e.escala === 'APACHE_II') return colorApache(e.puntaje)
  if (e.escala === 'SOFA' || e.escala === 'PSOFA') return colorSofa(e.puntaje)
  if (e.escala === 'NSOFA') return colorSofa(e.puntaje + 2)
  if (e.mortalidad != null) return colorMortalidad(Number(e.mortalidad))
  return 'bg-slate-100 text-slate-800'
}

// Escalas que corresponden por edad (la base aplica las mismas reglas)
export function escalasDelPaciente(ed: Edad): ClaveEscala[] {
  if (!ed || ed.anios >= 16) return ['APACHE_II', 'SOFA']
  const ped: ClaveEscala[] = ['PIM3', 'PELOD2', 'PSOFA', 'COMFORT_B', 'PEWS']
  if (ed.dias > 120) return ped
  const neo: ClaveEscala[] = ed.dias <= 28 ? ['SNAPPE_II', 'CRIB_II', 'NSOFA', 'SILVERMAN', 'NPASS'] : ['NSOFA', 'SILVERMAN', 'NPASS']
  return [...neo, ...ped]
}

// Resumen de gravedad en el expediente: adultos (APACHE II y tendencia de SOFA) o, en niños,
// la última evaluación de cada escala que le corresponde.
export async function EscalasGravedad({
  encuentroId,
  ed,
  areaCritica,
  puedeRegistrar,
  enlaceTexto,
}: {
  encuentroId: string
  ed: Edad
  areaCritica: boolean
  puedeRegistrar: boolean
  enlaceTexto?: string
}) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('clinico')
    .from('v_escala_gravedad')
    .select('id, escala, evaluado_en, puntaje, mortalidad, delta, resultado')
    .eq('encuentro_id', encuentroId)
    .eq('anulado', false)
    .order('evaluado_en', { ascending: false })
    .limit(60)
  const lista = (data ?? []) as EvalGravedad[]
  const nino = ed !== null && ed.anios < 16
  if (lista.length === 0 && !areaCritica && !nino) return null

  const enlace = (
    <Link href={`/medicos/encuentro/${encuentroId}/escalas`} className="text-sm font-medium text-sky-700 hover:underline">
      {enlaceTexto ?? (puedeRegistrar ? (nino ? 'Registrar escalas →' : 'Calcular APACHE II / SOFA →') : 'Ver evaluaciones →')}
    </Link>
  )

  if (nino) {
    const escalas = escalasDelPaciente(ed)
    const ultima = new Map<string, EvalGravedad>()
    for (const e of lista) if (!ultima.has(e.escala)) ultima.set(e.escala, e)
    return (
      <section className={claseTarjeta} aria-label="Escalas de gravedad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Escalas {ed.dias <= 120 ? 'neonatales y pediátricas' : 'pediátricas'}</h2>
          {enlace}
        </div>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {escalas.map((k) => {
            const e = ultima.get(k)
            const info = ESCALAS_GRAVEDAD[k]
            const interp = e?.resultado?.interpretacion ? INTERPRETACION[e.resultado.interpretacion] : null
            return (
              <li key={k} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">{info.nombre}</span>
                  {e ? (
                    <span className={`rounded px-1.5 font-semibold ${claseEvaluacion(e)}`}>
                      {k === 'PIM3' ? `${Number(e.mortalidad)} %` : e.puntaje}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">sin registro</span>
                  )}
                </div>
                {e && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {interp ? `${interp.texto} · ` : e.mortalidad != null && k !== 'PIM3' ? `mortalidad ≈ ${Number(e.mortalidad)} % · ` : k === 'PIM3' ? 'mortalidad estimada · ' : ''}
                    {e.delta != null && e.delta !== 0 ? `Δ ${e.delta > 0 ? '+' : ''}${e.delta} · ` : ''}
                    {fechaHora(e.evaluado_en)}
                  </p>
                )}
                {!e && <p className="mt-0.5 text-xs text-slate-400">{info.cuando}</p>}
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  const apache = lista.find((e) => e.escala === 'APACHE_II')
  const sofas = lista.filter((e) => e.escala === 'SOFA')
  const sofa = sofas[0]
  const tendencia = sofas.slice(0, 6).reverse()

  return (
    <section className={claseTarjeta} aria-label="Escalas de gravedad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Escalas de gravedad</h2>
        {enlace}
      </div>
      {lista.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Sin evaluaciones. En UCI se recomienda APACHE II en las primeras 24 h y SOFA diario.</p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">APACHE II</p>
            {apache ? (
              <>
                <p className="mt-1">
                  <span className={`rounded px-2 py-0.5 text-lg font-semibold ${colorApache(apache.puntaje)}`}>{apache.puntaje}</span>
                  {apache.mortalidad != null && <span className="ml-2 text-sm text-slate-700">mortalidad estimada ≈ {Number(apache.mortalidad)} %</span>}
                </p>
                <p className="mt-1 text-xs text-slate-500">{fechaHora(apache.evaluado_en)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Sin APACHE II.</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">SOFA</p>
            {sofa ? (
              <>
                <p className="mt-1">
                  <span className={`rounded px-2 py-0.5 text-lg font-semibold ${colorSofa(sofa.puntaje)}`}>{sofa.puntaje}</span>
                  {sofa.delta != null && (
                    <span className={`ml-2 text-sm font-medium ${sofa.delta >= 2 ? 'text-red-700' : sofa.delta < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {sofa.delta > 0 ? `▲ +${sofa.delta}` : sofa.delta < 0 ? `▼ ${sofa.delta}` : '= sin cambio'}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">{fechaHora(sofa.evaluado_en)}</p>
                {tendencia.length > 1 && (
                  <p className="mt-1 text-xs text-slate-600">Tendencia: {tendencia.map((s) => s.puntaje).join(' → ')}</p>
                )}
                {sofa.delta != null && sofa.delta >= 2 && <p className="mt-1 text-xs font-medium text-red-700">Aumento ≥ 2 puntos: deterioro orgánico (criterio Sepsis-3 si hay infección).</p>}
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Sin SOFA.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
