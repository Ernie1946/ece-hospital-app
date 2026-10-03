import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { claseTarjeta } from '@/lib/estilos'
import { ahora, fechaHora, nombreCompleto } from '@/lib/formato'
import { esMedico } from '@/lib/medica'

// ---------------------------------------------------------------------
// Tablero médico: mis pacientes, pacientes del servicio, notas de
// residentes por cofirmar y órdenes que enfermería devolvió.
// ---------------------------------------------------------------------

type CamaCenso = {
  cama: string
  encuentro_id: string | null
  paciente: string | null
  sexo: string | null
  edad: number | null
  dias_estancia: number | null
  alergias: string | null
  medico_tratante: string | null
  estado: string
}

type Encuentro = {
  id: string
  folio: string
  diagnostico_presuntivo: string | null
  inicio: string | null
  paciente: { nombre: string; primer_apellido: string; segundo_apellido: string | null } | null
}

export default async function MedicosPage({ searchParams }: PageProps<'/medicos'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const supabase = await crearClienteServidor()
  const { data: servicios } = await supabase.schema('catalogo').from('servicio').select('id, clave, nombre').eq('activo', true).order('id')
  const { servicio: elegido } = await searchParams
  const servicio =
    servicios?.find((s) => s.clave === elegido) ?? servicios?.find((s) => s.id === perfil.servicio_id) ?? servicios?.[0]

  const [misData, censoData] = await Promise.all([
    supabase
      .schema('clinico')
      .from('encuentro')
      .select('id, folio, diagnostico_presuntivo, inicio, paciente(nombre, primer_apellido, segundo_apellido)')
      .eq('medico_tratante_id', perfil.id)
      .in('estado', ['activo', 'alta_medica'])
      .order('inicio', { ascending: false }),
    supabase
      .schema('camas')
      .from('v_censo')
      .select('cama, encuentro_id, paciente, sexo, edad, dias_estancia, alergias, medico_tratante, estado')
      .eq('servicio', servicio?.clave ?? '')
      .in('estado', ['ocupada', 'reservada']),
  ])

  const mios = (misData.data ?? []) as unknown as Encuentro[]
  const idsMios = mios.map((e) => e.id)
  const delServicio = ((censoData.data ?? []) as CamaCenso[])
    .filter((c) => c.encuentro_id)
    .sort((a, b) => a.cama.localeCompare(b.cama, 'es', { numeric: true }))

  // Cama de mis pacientes (pueden estar en cualquier servicio)
  const { data: camasMias } = idsMios.length
    ? await supabase.schema('camas').from('v_censo').select('cama, encuentro_id, alergias').in('encuentro_id', idsMios)
    : { data: [] }
  const camaDe = new Map((camasMias ?? []).map((c) => [c.encuentro_id as string, c]))

  // Pendientes
  const hace72h = new Date(ahora() - 72 * 3600 * 1000).toISOString()
  const [cofirmas, devueltas] = await Promise.all([
    perfil.rol === 'medico_tratante' && idsMios.length
      ? supabase
          .schema('clinico')
          .from('documento_clinico')
          .select('id, encuentro_id, tipo, creado_en')
          .in('encuentro_id', idsMios)
          .eq('estado', 'pendiente_cofirma')
          .order('creado_en')
      : Promise.resolve({ data: [] as { id: string; encuentro_id: string; tipo: string; creado_en: string }[] }),
    supabase
      .schema('clinico')
      .from('orden')
      .select('id, encuentro_id, detalle, motivo_rechazo, validada_en')
      .eq('ordenada_por', perfil.id)
      .eq('estado', 'rechazada')
      .gte('validada_en', hace72h)
      .order('validada_en', { ascending: false }),
  ])
  const pacienteDe = new Map(mios.map((e) => [e.id, e.paciente ? nombreCompleto(e.paciente) : '—']))
  const listaCofirmas = (cofirmas.data ?? []) as { id: string; encuentro_id: string; tipo: string; creado_en: string }[]
  const listaDevueltas = (devueltas.data ?? []) as {
    id: string
    encuentro_id: string
    detalle: { descripcion?: string }
    motivo_rechazo: string
    validada_en: string
  }[]

  const medico = esMedico(perfil.rol)

  return (
    <>
      <Encabezado perfil={perfil} activo="medicos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Médicos</h1>
          {!medico && (
            <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
              Vista de consulta: las notas y órdenes médicas las escribe el personal médico.
            </p>
          )}

          {(listaCofirmas.length > 0 || listaDevueltas.length > 0) && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-amber-900">Pendientes</h2>
              <ul className="space-y-1 text-sm">
                {listaCofirmas.map((d) => (
                  <li key={d.id}>
                    <Link href={`/medicos/encuentro/${d.encuentro_id}`} className="text-sky-800 hover:underline">
                      Nota de residente por cofirmar · {pacienteDe.get(d.encuentro_id)} · {fechaHora(d.creado_en)}
                    </Link>
                  </li>
                ))}
                {listaDevueltas.map((o) => (
                  <li key={o.id}>
                    <Link href={`/medicos/encuentro/${o.encuentro_id}`} className="text-red-800 hover:underline">
                      Orden devuelta por enfermería: {o.detalle?.descripcion} — “{o.motivo_rechazo}”
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {medico && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-800">Mis pacientes ({mios.length})</h2>
              {mios.length === 0 && (
                <p className="text-sm text-slate-500">
                  {perfil.rol === 'anestesiologo'
                    ? 'Como anestesiólogo puedes abrir el expediente de cualquier paciente desde la lista de servicios.'
                    : 'No tienes pacientes hospitalizados como médico tratante.'}
                </p>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {mios.map((e) => {
                  const c = camaDe.get(e.id)
                  return (
                    <Link
                      key={e.id}
                      href={`/medicos/encuentro/${e.id}`}
                      className="block bg-white rounded-xl border border-slate-200 p-3 hover:border-sky-400 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{(c?.cama as string) ?? 'Sin cama'}</span>
                        <span className="text-xs text-slate-500">Folio {e.folio}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">{e.paciente ? nombreCompleto(e.paciente) : '—'}</p>
                      {e.diagnostico_presuntivo && <p className="text-xs text-slate-600">Dx: {e.diagnostico_presuntivo}</p>}
                      {c?.alergias && (
                        <p className="mt-1 text-xs">
                          <span className="rounded bg-red-100 px-1 font-medium text-red-800">Alergia: {c.alergias as string}</span>
                        </p>
                      )}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Pacientes de {servicio?.nombre}</h2>
              <nav className="flex flex-wrap gap-1 text-xs" aria-label="Servicio">
                {(servicios ?? []).map((s) => (
                  <Link
                    key={s.id as number}
                    href={`/medicos?servicio=${s.clave}`}
                    aria-current={s.clave === servicio?.clave ? 'page' : undefined}
                    className={`rounded-full border px-2 py-0.5 ${
                      s.clave === servicio?.clave ? 'bg-sky-700 border-sky-700 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {s.clave as string}
                  </Link>
                ))}
              </nav>
            </div>
            {delServicio.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin pacientes en este servicio.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {delServicio.map((c) => (
                  <li key={c.cama} className="py-2">
                    <Link href={`/medicos/encuentro/${c.encuentro_id}`} className="flex flex-wrap items-center gap-x-3 hover:underline">
                      <span className="w-20 font-semibold text-slate-900">{c.cama}</span>
                      <span className="text-slate-900">{c.paciente}</span>
                      <span className="text-slate-500">
                        {c.sexo} · {c.edad ?? '—'} a{c.estado === 'reservada' ? ' · por llegar' : ` · día ${(c.dias_estancia ?? 0) + 1}`}
                      </span>
                      {c.medico_tratante && <span className="text-slate-500">Dr(a). {c.medico_tratante}</span>}
                      {c.alergias && <span className="rounded bg-red-100 px-1 text-xs text-red-800">Alergia: {c.alergias}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
