import Link from 'next/link'
import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { TIPO_LUGAR, conSubareas, ordenarAreas, type Area } from '@/lib/areas'

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
  area: string
  area_nombre: string
  area_padre: string | null
  tipo_lugar: string
  servicio_cama: string | null
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

// Cada grupo de camas (área) con su color, para distinguirlos de un vistazo.
// El fondo de la tarjeta sigue indicando el estado de la cama.
const PALETA = [
  { seccion: 'border-l-sky-500 bg-sky-50', franja: 'border-t-sky-500', titulo: 'text-sky-900', punto: 'bg-sky-500' },
  { seccion: 'border-l-emerald-500 bg-emerald-50', franja: 'border-t-emerald-500', titulo: 'text-emerald-900', punto: 'bg-emerald-500' },
  { seccion: 'border-l-violet-500 bg-violet-50', franja: 'border-t-violet-500', titulo: 'text-violet-900', punto: 'bg-violet-500' },
  { seccion: 'border-l-amber-500 bg-amber-50', franja: 'border-t-amber-500', titulo: 'text-amber-900', punto: 'bg-amber-500' },
  { seccion: 'border-l-pink-500 bg-pink-50', franja: 'border-t-pink-500', titulo: 'text-pink-900', punto: 'bg-pink-500' },
  { seccion: 'border-l-teal-500 bg-teal-50', franja: 'border-t-teal-500', titulo: 'text-teal-900', punto: 'bg-teal-500' },
  { seccion: 'border-l-indigo-500 bg-indigo-50', franja: 'border-t-indigo-500', titulo: 'text-indigo-900', punto: 'bg-indigo-500' },
  { seccion: 'border-l-lime-600 bg-lime-50', franja: 'border-t-lime-600', titulo: 'text-lime-900', punto: 'bg-lime-600' },
  { seccion: 'border-l-fuchsia-500 bg-fuchsia-50', franja: 'border-t-fuchsia-500', titulo: 'text-fuchsia-900', punto: 'bg-fuchsia-500' },
  { seccion: 'border-l-orange-500 bg-orange-50', franja: 'border-t-orange-500', titulo: 'text-orange-900', punto: 'bg-orange-500' },
  { seccion: 'border-l-cyan-600 bg-cyan-50', franja: 'border-t-cyan-600', titulo: 'text-cyan-900', punto: 'bg-cyan-600' },
  { seccion: 'border-l-stone-500 bg-stone-100', franja: 'border-t-stone-500', titulo: 'text-stone-900', punto: 'bg-stone-500' },
] as const
type Color = (typeof PALETA)[number]

const AISLAMIENTO: Record<string, string> = {
  contacto: 'Aislamiento de contacto',
  gotas: 'Aislamiento por gotas',
  aereo: 'Aislamiento aéreo',
}

export default async function CensoPage({ searchParams }: PageProps<'/'>) {
  const { area: filtro } = await searchParams
  const areaElegida = typeof filtro === 'string' ? filtro : null

  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  // El técnico de gabinete trabaja en su agenda
  if (perfil.rol === 'gabinete') redirect(perfil.hemo ? '/hemodinamia' : '/gabinetes')

  const supabase = await crearClienteServidor()

  const [{ data: camasData, error }, { data: ocupacionData }, { data: areasData }] = await Promise.all([
    supabase.schema('camas').from('v_censo').select('*'),
    supabase.schema('camas').from('v_ocupacion').select('*'),
    supabase.schema('catalogo').from('area').select('id, clave, nombre, tipo, censable, padre_id, orden').eq('activo', true),
  ])

  const camas = ((camasData ?? []) as Cama[]).sort((a, b) => a.cama.localeCompare(b.cama, 'es', { numeric: true }))
  const ocupacion = (ocupacionData ?? []) as Ocupacion[]
  const total = ocupacion.find((o) => o.servicio === 'TOTAL CENSABLES')
  const areas = ordenarAreas((areasData ?? []) as Area[])
  const conCamas = new Set(camas.map((c) => c.area))
  const principales = areas.filter((a) => !a.padre_id && (conCamas.has(a.clave) || areas.some((h) => h.padre_id === a.id && conCamas.has(h.clave))))
  const elegida = areas.find((a) => a.clave === areaElegida)
  const visiblesAreas = new Set(elegida ? conSubareas(areas, elegida.id) : areas.map((a) => a.clave))
  const nombreDe = new Map(areas.map((a) => [a.id, a.nombre]))
  // El color de cada área no cambia al filtrar: se asigna por su lugar en la lista completa
  const colorDe = new Map(areas.filter((a) => conCamas.has(a.clave)).map((a, i) => [a.clave, PALETA[i % PALETA.length]]))

  // Camas agrupadas por área (con el nombre de su área principal)
  const porArea = areas
    .filter((a) => conCamas.has(a.clave) && visiblesAreas.has(a.clave))
    .map((a) => ({
      clave: a.clave,
      nombre: a.padre_id ? `${nombreDe.get(a.padre_id)} · ${a.nombre}` : a.nombre,
      censable: a.censable,
      color: colorDe.get(a.clave) ?? PALETA[0],
      camas: camas.filter((c) => c.area === a.clave),
      resumen: ocupacion.find((o) => o.servicio === a.clave),
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

        {/* Filtro por área */}
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filtrar por área">
          <Filtro href="/" activo={!areaElegida}>Todas</Filtro>
          {principales.map((a) => (
            <Filtro key={a.clave} href={`/?area=${a.clave}`} activo={areaElegida === a.clave}>
              <span
                className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${(colorDe.get(a.clave) ?? colorDe.get(areas.find((h) => h.padre_id === a.id && colorDe.has(h.clave))?.clave ?? '') ?? PALETA[0]).punto}`}
                aria-hidden="true"
              />
              {a.nombre}
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

        {/* Camas por área */}
        {porArea.map((s) => (
          <section key={s.clave} className={`space-y-2 rounded-xl border-l-4 p-3 ${s.color.seccion}`} aria-label={s.nombre}>
            <h2 className={`flex flex-wrap items-center gap-x-2 text-sm font-semibold ${s.color.titulo}`}>
              <span className={`inline-block h-3 w-3 rounded-full ${s.color.punto}`} aria-hidden="true" />
              {s.nombre}
              {s.resumen && (
                <span className="ml-2 font-normal text-slate-500">
                  {s.resumen.ocupadas + s.resumen.reservadas}/{s.resumen.camas} · {s.resumen.pct_ocupacion ?? 0}%
                </span>
              )}
              {!s.censable && (
                <span className="ml-2 font-normal text-slate-500">
                  {s.camas.filter((c) => c.estado === 'ocupada' || c.estado === 'reservada').length}/{s.camas.length} · no censable
                </span>
              )}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
              {s.camas.map((c) => (
                <TarjetaCama key={c.cama} cama={c} color={s.color} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
    </>
  )
}

function TarjetaCama({ cama, color }: { cama: Cama; color: Color }) {
  const estilo = ESTILO_ESTADO[cama.estado]
  return (
    <article className={`rounded-lg border border-t-4 p-2 text-xs ${estilo.tarjeta} ${color.franja}`}>
      <div className="flex items-center justify-between">
        <span className="whitespace-nowrap font-semibold text-slate-900">
          {cama.tipo_lugar !== 'cama' && <span title={TIPO_LUGAR[cama.tipo_lugar]?.nombre}>{TIPO_LUGAR[cama.tipo_lugar]?.icono} </span>}
          {cama.cama}
        </span>
        <span className="flex items-center gap-1 truncate text-slate-600">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${estilo.punto}`} />
          {estilo.etiqueta}
        </span>
      </div>

      {cama.paciente ? (
        <div className="mt-1 space-y-0.5">
          <p className="font-medium text-slate-900 leading-tight">{cama.paciente}</p>
          <p className="text-slate-600">
            {cama.sexo} · {cama.edad ?? '—'} a · {cama.dias_estancia ?? 0} d
          </p>
          {cama.servicio && cama.servicio !== cama.servicio_cama && <p className="text-sky-800">{cama.servicio_nombre}</p>}
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
