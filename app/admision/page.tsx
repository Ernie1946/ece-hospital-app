import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { claseCampo, claseTarjeta } from '@/lib/estilos'
import { edad, fecha, fechaHora, nombreCompleto, TIPO_ENCUENTRO } from '@/lib/formato'

// ---------------------------------------------------------------------
// Admisión — búsqueda de pacientes e ingresos programados
// ---------------------------------------------------------------------

type PacienteFila = {
  id: string
  expediente: string
  nombre: string
  primer_apellido: string
  segundo_apellido: string | null
  sexo: string
  fecha_nacimiento: string | null
  curp: string | null
}

// Solo letras, números y espacios: evita romper el filtro de la API
function limpiarBusqueda(q: string) {
  return q.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

export default async function AdmisionPage({ searchParams }: PageProps<'/admision'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const { q } = await searchParams
  const busqueda = typeof q === 'string' ? limpiarBusqueda(q) : ''

  const supabase = await crearClienteServidor()

  let consulta = supabase
    .schema('clinico')
    .from('paciente')
    .select('id, expediente, nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, curp')
    .eq('activo', true)
    .is('fusionado_en', null)
    .order('creado_en', { ascending: false })
    .limit(30)

  if (busqueda) {
    const patron = `*${busqueda.toLowerCase()}*`
    consulta = consulta.or(
      `nombre_busqueda.ilike.${patron},expediente.ilike.${patron},curp.ilike.${patron}`
    )
  }

  const [{ data: pacientes, error }, { data: programados }, { data: servicios }] = await Promise.all([
    consulta,
    supabase
      .schema('clinico')
      .from('encuentro')
      .select('id, folio, tipo, fecha_programada, servicio_id, paciente:paciente_id(id, expediente, nombre, primer_apellido, segundo_apellido)')
      .eq('estado', 'programado')
      .order('fecha_programada', { ascending: true })
      .limit(50),
    supabase.schema('catalogo').from('servicio').select('id, nombre'),
  ])

  const nombreServicio = new Map((servicios ?? []).map((s) => [s.id as number, s.nombre as string]))

  return (
    <>
      <Encabezado perfil={perfil} activo="admision" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-slate-900">Admisión</h1>
            <Link
              href="/admision/nuevo"
              className="rounded-lg bg-sky-700 text-white text-sm font-medium px-4 py-2 hover:bg-sky-800"
            >
              + Nuevo paciente
            </Link>
          </div>

          {/* Búsqueda */}
          <form className="flex gap-2" role="search">
            <input
              name="q"
              defaultValue={busqueda}
              placeholder="Buscar por nombre, expediente o CURP"
              aria-label="Buscar paciente"
              className={`${claseCampo} mt-0 max-w-md`}
            />
            <button className="rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50">
              Buscar
            </button>
          </form>

          {/* Ingresos programados pendientes de llegar */}
          {(programados?.length ?? 0) > 0 && !busqueda && (
            <section className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Ingresos programados</h2>
              <ul className="divide-y divide-slate-100">
                {programados!.map((e) => {
                  const p = e.paciente as unknown as PacienteFila
                  return (
                    <li key={e.id as string} className="py-2 flex flex-wrap justify-between gap-2 text-sm">
                      <Link href={`/admision/paciente/${p.id}`} className="text-sky-800 hover:underline font-medium">
                        {nombreCompleto(p)}
                      </Link>
                      <span className="text-slate-600">
                        {TIPO_ENCUENTRO[e.tipo as string] ?? e.tipo} · {nombreServicio.get(e.servicio_id as number)} ·{' '}
                        {fechaHora(e.fecha_programada as string)} · folio {e.folio as string}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Resultados */}
          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800 mb-2">
              {busqueda ? `Resultados para “${busqueda}”` : 'Pacientes registrados recientemente'}
            </h2>
            {error && <p className="text-sm text-red-700">No se pudo buscar: {error.message}</p>}
            {pacientes && pacientes.length === 0 && (
              <p className="text-sm text-slate-500">
                No hay coincidencias. Si es un paciente nuevo, regístralo con “+ Nuevo paciente”.
              </p>
            )}
            {pacientes && pacientes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3 font-medium">Expediente</th>
                      <th className="py-2 pr-3 font-medium">Paciente</th>
                      <th className="py-2 pr-3 font-medium">Sexo</th>
                      <th className="py-2 pr-3 font-medium">Nacimiento</th>
                      <th className="py-2 pr-3 font-medium">CURP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pacientes as PacienteFila[]).map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-3 font-mono text-xs">{p.expediente}</td>
                        <td className="py-2 pr-3">
                          <Link href={`/admision/paciente/${p.id}`} className="text-sky-800 hover:underline font-medium">
                            {nombreCompleto(p)}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">{p.sexo}</td>
                        <td className="py-2 pr-3">
                          {fecha(p.fecha_nacimiento)} {p.fecha_nacimiento && <span className="text-slate-500">({edad(p.fecha_nacimiento)} a)</span>}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{p.curp ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
