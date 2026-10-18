import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { claseTarjeta } from '@/lib/estilos'
import { fechaHora } from '@/lib/formato'

export type EvalGravedad = {
  id: number
  escala: 'APACHE_II' | 'SOFA'
  evaluado_en: string
  puntaje: number
  mortalidad: number | null
  delta: number | null
  resultado: { faltantes?: string[]; puntos?: Record<string, number>; tipo_ingreso?: string }
  datos: Record<string, unknown>
  registrado_por: string
  registrado_por_nombre: string
  anulado: boolean
  motivo_anulacion: string | null
}

export function colorSofa(p: number) {
  return p >= 11 ? 'bg-red-100 text-red-800' : p >= 7 ? 'bg-orange-100 text-orange-800' : p >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
}
export function colorApache(p: number) {
  return p >= 25 ? 'bg-red-100 text-red-800' : p >= 15 ? 'bg-orange-100 text-orange-800' : p >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
}

// Resumen de gravedad en el expediente médico: último APACHE II y tendencia de SOFA.
// Se muestra en áreas críticas o cuando el paciente ya tiene evaluaciones.
export async function EscalasGravedad({
  encuentroId,
  edad,
  areaCritica,
  puedeRegistrar,
}: {
  encuentroId: string
  edad: number | null
  areaCritica: boolean
  puedeRegistrar: boolean
}) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('clinico')
    .from('v_escala_gravedad')
    .select('id, escala, evaluado_en, puntaje, mortalidad, delta')
    .eq('encuentro_id', encuentroId)
    .eq('anulado', false)
    .order('evaluado_en', { ascending: false })
    .limit(30)
  const lista = (data ?? []) as EvalGravedad[]
  if (lista.length === 0 && !areaCritica) return null

  const nino = edad !== null && edad < 16
  const apache = lista.find((e) => e.escala === 'APACHE_II')
  const sofas = lista.filter((e) => e.escala === 'SOFA')
  const sofa = sofas[0]
  const tendencia = sofas.slice(0, 6).reverse()

  return (
    <section className={claseTarjeta} aria-label="Escalas de gravedad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Escalas de gravedad</h2>
        {!nino && (
          <Link href={`/medicos/encuentro/${encuentroId}/escalas`} className="text-sm font-medium text-sky-700 hover:underline">
            {puedeRegistrar ? 'Calcular APACHE II / SOFA →' : 'Ver evaluaciones →'}
          </Link>
        )}
      </div>
      {nino ? (
        <p className="mt-2 text-sm text-slate-600">
          Paciente pediátrico: APACHE II y SOFA son para mayores de 16 años. Las escalas pediátricas (PIM3, PELOD-2, pSOFA) y neonatales (SNAPPE-II, CRIB II) se agregan en la siguiente etapa.
        </p>
      ) : lista.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Sin evaluaciones. En UCI se recomienda APACHE II en las primeras 24 h y SOFA diario.</p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">APACHE II</p>
            {apache ? (
              <>
                <p className="mt-1">
                  <span className={`rounded px-2 py-0.5 text-lg font-semibold ${colorApache(apache.puntaje)}`}>{apache.puntaje}</span>
                  {apache.mortalidad != null && <span className="ml-2 text-sm text-slate-700">mortalidad estimada ≈ {apache.mortalidad} %</span>}
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
