import { crearClienteServidor } from '@/lib/supabase/server'
import { claseTarjeta } from '@/lib/estilos'
import { fecha, fechaHora } from '@/lib/formato'
import { COLUMNAS_RESULTADO, TIPO_RESULTADO, type Resultado } from '@/lib/resultados'

// Resultados de laboratorio, imagen y gabinete del ingreso, en el expediente (médicos y enfermería)
export async function ListaResultados({ encuentroId }: { encuentroId: string }) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('clinico')
    .from('v_resultado')
    .select(COLUMNAS_RESULTADO)
    .eq('encuentro_id', encuentroId)
    .eq('anulado', false)
    .order('subido_en', { ascending: false })
    .limit(40)
  const lista = (data ?? []) as Resultado[]
  const criticosNuevos = lista.filter((r) => r.critico && !r.visto_en)

  return (
    <section className={claseTarjeta} aria-label="Resultados de laboratorio, imagen y gabinete">
      <h2 className="text-sm font-semibold text-slate-800">Resultados de laboratorio, imagen y gabinete ({lista.length})</h2>
      {criticosNuevos.length > 0 && (
        <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          ⚠ {criticosNuevos.length} resultado(s) con valores críticos sin revisar por el médico: {criticosNuevos.map((r) => r.estudio).join(', ')}
        </p>
      )}
      {lista.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">Sin resultados en este ingreso.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {lista.map((r) => (
            <li key={r.id} className="py-1.5">
              <a href={`/resultados/archivo/${r.id}`} target="_blank" rel="noopener" className="font-medium text-sky-700 hover:underline">
                {r.estudio} ↗
              </a>
              <span className="text-slate-500">
                {' '}
                · {TIPO_RESULTADO[r.tipo]} · {fecha(r.realizado_en)}
              </span>
              {r.critico && <span className="ml-1 rounded bg-red-100 px-1 text-xs font-semibold text-red-800">CRÍTICO</span>}
              {!r.visto_en && <span className="ml-1 rounded bg-sky-100 px-1 text-xs text-sky-900">Nuevo</span>}
              {r.critico && <p className="text-xs text-red-800">{r.nota_critica}</p>}
              <p className="text-xs text-slate-500">
                Subido {fechaHora(r.subido_en)}
                {r.visto_en ? ` · revisado por ${r.visto_por_nombre} ${fechaHora(r.visto_en)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
