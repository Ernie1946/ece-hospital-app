import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { CodigoBarras } from '@/components/CodigoBarras'
import { BotonImprimir } from '@/components/BotonImprimir'
import { edad, fecha, fechaHora, nombreCompleto } from '@/lib/formato'

// ---------------------------------------------------------------------
// Pulsera de identificación: nombre, expediente, nacimiento, alergias y
// código de barras que se escanea en farmacia, enfermería y laboratorio.
// ---------------------------------------------------------------------

export default async function PulseraPage({ params }: PageProps<'/admision/pulsera/[encuentro]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const { encuentro: encuentroId } = await params
  const supabase = await crearClienteServidor()

  const { data: encuentro } = await supabase
    .schema('clinico')
    .from('encuentro')
    .select('id, folio, paciente_id, servicio_id, fecha_programada, inicio, pulsera(codigo_barras, activa, impresa_en)')
    .eq('id', encuentroId)
    .maybeSingle()
  if (!encuentro) notFound()

  const pulsera = (encuentro.pulsera as { codigo_barras: string; activa: boolean; impresa_en: string }[]).find((p) => p.activa)

  const [{ data: paciente }, { data: alergias }, { data: servicio }] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento, sexo, tipo_sangre').eq('id', encuentro.paciente_id).single(),
    supabase.schema('clinico').from('paciente_alergia').select('sustancia').eq('paciente_id', encuentro.paciente_id).eq('activa', true),
    supabase.schema('catalogo').from('servicio').select('nombre').eq('id', encuentro.servicio_id).single(),
  ])

  const listaAlergias = (alergias ?? []).map((a) => a.sustancia as string)

  return (
    <>
      <Encabezado perfil={perfil} activo="admision" />
      <main className="flex-1 bg-slate-100 print:bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 print:p-0">
          <div className="flex items-center justify-between print:hidden">
            <Link href={`/admision/paciente/${encuentro.paciente_id}`} className="text-sm text-sky-700 hover:underline">
              ← Ficha del paciente
            </Link>
            {pulsera && <BotonImprimir />}
          </div>

          {!pulsera || !paciente ? (
            <p className="text-sm text-slate-600">Este ingreso aún no tiene pulsera activa.</p>
          ) : (
            <>
              {/* La pulsera: tira horizontal de ~25 mm de alto */}
              <div className="bg-white border-2 border-slate-800 rounded-md flex items-center gap-4 px-4 py-2 w-full max-w-[250mm] min-h-[25mm] print:rounded-none">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-slate-900 uppercase leading-tight truncate">
                    {paciente.primer_apellido} {paciente.segundo_apellido ?? ''}, {paciente.nombre}
                  </p>
                  <p className="text-xs text-slate-800">
                    Exp. <strong>{paciente.expediente}</strong> · Nac. {fecha(paciente.fecha_nacimiento)}
                    {paciente.fecha_nacimiento ? ` (${edad(paciente.fecha_nacimiento)} a)` : ''} · {paciente.sexo}
                    {paciente.tipo_sangre ? ` · ${paciente.tipo_sangre}` : ''}
                  </p>
                  <p className="text-xs text-slate-800">
                    {servicio?.nombre} · Folio {encuentro.folio}
                  </p>
                  {listaAlergias.length > 0 && (
                    <p className="mt-0.5 text-xs font-bold text-white bg-red-700 px-1 inline-block print:[print-color-adjust:exact]">
                      ALERGIAS: {listaAlergias.join(', ').toUpperCase()}
                    </p>
                  )}
                </div>
                <CodigoBarras valor={pulsera.codigo_barras} />
              </div>

              <p className="text-xs text-slate-500 print:hidden">
                Impresa {fechaHora(pulsera.impresa_en)} · Colócala en la muñeca del paciente y verifica nombre y fecha
                de nacimiento con él o su responsable: {nombreCompleto(paciente)}.
              </p>
            </>
          )}
        </div>
      </main>
    </>
  )
}
