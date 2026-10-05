import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { CodigoBarras } from '@/components/CodigoBarras'
import { BotonImprimir } from '@/components/BotonImprimir'
import { fecha } from '@/lib/formato'
import { cantidad, horaCorta } from '@/lib/farmacia'

// Etiqueta de dosis unitaria (~70 × 40 mm): se escanea junto con la pulsera al administrar
export default async function EtiquetaPage({ params }: PageProps<'/farmacia/etiqueta/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data: d } = await supabase
    .schema('farmacia')
    .from('v_dosis')
    .select('id, medicamento, concentracion, forma_farmaceutica, dosis, unidad_dosis, via, hora_programada, codigo_barras, estado, paciente, expediente, cama, lote, caducidad, alto_riesgo, grupo_controlado, prn, indicaciones')
    .eq('id', id)
    .maybeSingle()
  if (!d) notFound()

  return (
    <>
      <Encabezado perfil={perfil} activo="farmacia" />
      <main className="flex-1 bg-slate-100 print:bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4 print:p-0">
          <div className="flex items-center justify-between print:hidden">
            <Link href="/farmacia?vista=enviar" className="text-sm text-sky-700 hover:underline">
              ← Por enviar
            </Link>
            <BotonImprimir />
          </div>
          <div className="w-[70mm] min-h-[40mm] rounded-md border-2 border-slate-800 bg-white p-2 text-[10px] leading-tight text-slate-900 print:rounded-none">
            <p className="text-xs font-bold uppercase">{d.paciente}</p>
            <p>
              Exp. {d.expediente} · <strong>{d.cama ?? 'sin cama'}</strong>
            </p>
            <p className="mt-1 text-sm font-bold">
              {d.medicamento} {d.concentracion}
            </p>
            <p className="font-semibold">
              {cantidad(d.dosis)} {d.unidad_dosis} · {d.via} · {d.prn ? 'PRN' : horaCorta(d.hora_programada)}
            </p>
            {d.indicaciones && <p>{d.indicaciones}</p>}
            <p>
              Lote {d.lote ?? '—'} · Cad. {fecha(d.caducidad)}
            </p>
            {(d.alto_riesgo || d.grupo_controlado) && (
              <p className="mt-0.5 inline-block bg-red-700 px-1 font-bold text-white print:[print-color-adjust:exact]">
                {d.alto_riesgo ? 'ALTO RIESGO · DOBLE VERIFICACIÓN' : ''}
                {d.alto_riesgo && d.grupo_controlado ? ' · ' : ''}
                {d.grupo_controlado ? `CONTROLADO GRUPO ${d.grupo_controlado}` : ''}
              </p>
            )}
            <div className="mt-1">
              <CodigoBarras valor={d.codigo_barras as string} alto={30} ancho={1.1} />
            </div>
          </div>
          {d.estado === 'programada' && <p className="text-sm text-amber-800 print:hidden">La dosis aún no se prepara.</p>}
        </div>
      </main>
    </>
  )
}
