import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'

// ---------------------------------------------------------------------
// Censo de camas — pantalla principal
// Lee camas.v_censo y camas.v_ocupacion (la seguridad por fila de la base
// decide qué puede ver cada usuario).
// ---------------------------------------------------------------------

type Cama = {
  cama: string
  servicio: string
  servicio_nombre: string
  censable: boolean
  piso: number
  cuarto: string
  estado: EstadoCama
  estado_desde: string
  motivo_bloqueo: string | null
  folio: string | null
  expediente: string | null
  paciente: string | null
  sexo: string | null
  edad: number | null
  medico_tratante: string | null
  aislamiento: string | null
  dias_estancia: number | null
  alergias: string | null
}

type Ocupacion = {
  servicio: string
  camas: number
  ocupadas: number
  reservadas: number
  disponibles: number
  en_limpieza: number
  bloqueadas: number
  pct_ocupacion: number | null
}

type EstadoCama = 'disponible' | 'reservada' | 'ocupada' | 'sucia' | 'limpieza' | 'bloqueada'

const ESTILO_ESTADO: Record<EstadoCama, { etiqueta: string; tarjeta: string; punto: string }> = {
  disponible: { etiqueta: 'Disponible', tarjeta: 'bg-emerald-50 border-emerald-300', punto: 'bg-emerald-500' },
  reservada:  { etiqueta: 'Reservada',  tarjeta: 'bg-sky-50 border-sky-300',         punto: 'bg-sky-500' },
  ocupada:    { etiqueta: 'Ocupada',    tarjeta: 'bg-white border-slate-400',        punto: 'bg-slate-700' },
  sucia:      { etiqueta: 'Sucia',      tarjeta: 'bg-amber-50 border-amber-300',     punto: 'bg-amber-500' },
  limpieza:   { etiqueta: 'Limpieza',   tarjeta: 'bg-yellow-50 border-yellow-300',   punto: 'bg-yellow-400' },
  bloqueada:  { etiqueta: 'Bloqueada',  tarjeta: 'bg-red-50 border-red-300',         punto: 'bg-red-500' },
}

const AISLAMIENTO: Record<string, string> = {
  contacto: 'Aislamiento de contacto',
  gotas: 'Aislamiento por gotas',
  aereo: 'Aislamiento aéreo',
}

export default async function CensoPage({ searchParams }: PageProps<'/'>) {
  const { servicio: filtro } = await searchParams
  const servicioElegido = typeof filtro === 'string' ? filtro : null

  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const supabase = await crearClienteServidor()

  const [{ data: camasData, error }, { data: ocupacionData }] = await Promise.all([
    supabase.schema('camas').from('v_censo').select('*'),
    supabase.schema('camas').from('v_ocupacion').select('*'),
  ])

  const camas = ((camasData ?? []) as Cama[]).sort(
    (a, b) => a.piso - b.piso || a.cama.localeCompare(b.cama, 'es', { numeric: true })
  )
  const ocupacion = (ocupacionData ?? []) as Ocupacion[]
  const total = ocupacion.find((o) => o.servicio === 'TOTAL CENSABLES')

  // Servicios en el orden en que aparecen, con su nombre
  const servicios = Array.from(new Map(camas.map((c) => [c.servicio, c.servicio_nombre])).entries())
  const visibles = servicioElegido ? camas.filter((c) => c.servicio === servicioElegido) : camas
  const porServicio = servicios
    .filter(([clave]) => !servicioElegido || clave === servicioElegido)
    .map(([clave, nombre]) => ({
      clave,
      nombre,
      camas: visibles.filter((c) => c.servicio === clave),
      resumen: ocupacion.find((o) => o.servicio === clave),
    }))

  return (
    <>
      <Encabezado perfil={perfil} activo="censo" />
      <main className="flex-1 bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Censo de camas</h1>
          <p className="text-xs text-slate-500">
            Actualizado {new Date().toLocaleString('es-MX', { timeZone: 'America/Chihuahua' })}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            No se pudo leer el censo: {error.message}
          </p>
        )}

        {/* Resumen de las 150 camas censables */}
        {total && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Indicador titulo="Ocupación" valor={`${total.pct_ocupacion ?? 0}%`} />
            <Indicador titulo="Ocupadas" valor={total.ocupadas} />
            <Indicador titulo="Reservadas" valor={total.reservadas} />
            <Indicador titulo="Disponibles" valor={total.disponibles} />
            <Indicador titulo="En limpieza" valor={total.en_limpieza} />
            <Indicador titulo="Bloqueadas" valor={total.bloqueadas} />
          </section>
        )}

        {/* Filtro por servicio */}
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filtrar por servicio">
          <Filtro href="/" activo={!servicioElegido}>Todos</Filtro>
          {servicios.map(([clave, nombre]) => (
            <Filtro key={clave} href={`/?servicio=${clave}`} activo={servicioElegido === clave}>
              {nombre}
            </Filtro>
          ))}
        </nav>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {Object.values(ESTILO_ESTADO).map((e) => (
            <span key={e.etiqueta} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${e.punto}`} /> {e.etiqueta}
            </span>
          ))}
        </div>

        {/* Camas por servicio */}
        {porServicio.map((s) => (
          <section key={s.clave} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">
              {s.nombre}
              {s.resumen && (
                <span className="ml-2 font-normal text-slate-500">
                  {s.resumen.ocupadas + s.resumen.reservadas}/{s.resumen.camas} · {s.resumen.pct_ocupacion ?? 0}%
                </span>
              )}
              {!s.resumen && <span className="ml-2 font-normal text-slate-500">no censable</span>}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
              {s.camas.map((c) => (
                <TarjetaCama key={c.cama} cama={c} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
    </>
  )
}

function TarjetaCama({ cama }: { cama: Cama }) {
  const estilo = ESTILO_ESTADO[cama.estado]
  return (
    <article className={`rounded-lg border p-2 text-xs ${estilo.tarjeta}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">{cama.cama}</span>
        <span className="flex items-center gap-1 text-slate-600">
          <span className={`inline-block h-2 w-2 rounded-full ${estilo.punto}`} />
          {estilo.etiqueta}
        </span>
      </div>

      {cama.paciente ? (
        <div className="mt-1 space-y-0.5">
          <p className="font-medium text-slate-900 leading-tight">{cama.paciente}</p>
          <p className="text-slate-600">
            {cama.sexo} · {cama.edad ?? '—'} a · {cama.dias_estancia ?? 0} d
          </p>
          {cama.medico_tratante && <p className="text-slate-600 truncate">Dr(a). {cama.medico_tratante}</p>}
          {cama.alergias && (
            <p className="rounded bg-red-100 px-1 text-red-800 font-medium">Alergia: {cama.alergias}</p>
          )}
          {cama.aislamiento && cama.aislamiento !== 'ninguno' && (
            <p className="rounded bg-purple-100 px-1 text-purple-800">{AISLAMIENTO[cama.aislamiento]}</p>
          )}
        </div>
      ) : cama.estado === 'bloqueada' && cama.motivo_bloqueo ? (
        <p className="mt-1 text-red-700">{cama.motivo_bloqueo}</p>
      ) : null}
    </article>
  )
}

function Indicador({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="text-xl font-semibold text-slate-900">{valor}</p>
    </div>
  )
}

function Filtro({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${
        activo ? 'bg-sky-700 border-sky-700 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </Link>
  )
}
