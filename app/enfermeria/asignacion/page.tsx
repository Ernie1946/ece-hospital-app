import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { esJefatura, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { AsignacionTurno } from '@/components/AsignacionTurno'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { fechaLarga, sumarDias } from '@/lib/turnos'
import { asignarCamas, copiarAsignacion } from './acciones'
import { datosAsignacion } from './datos'

// ---------------------------------------------------------------------
// Asignación de enfermería por turno (por camas). La Jefatura de
// Enfermería asigna; el resto del personal consulta e imprime.
// ---------------------------------------------------------------------

export default async function AsignacionPage({ searchParams }: PageProps<'/enfermeria/asignacion'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const sp = await searchParams
  const d = await datosAsignacion(sp, perfil.area_id)
  const editable = esJefatura(perfil)

  const supabase = await crearClienteServidor()
  const { data: enf } = await supabase
    .schema('seguridad')
    .from('usuario')
    .select('id, nombre, primer_apellido, segundo_apellido, area_id, vigencia_hasta')
    .eq('rol', 'enfermeria')
    .eq('activo', true)
  const enfermeras = ((enf ?? []) as { id: string; nombre: string; primer_apellido: string; segundo_apellido: string | null; area_id: number | null; vigencia_hasta: string | null }[])
    .filter((e) => !e.vigencia_hasta || e.vigencia_hasta >= d.fecha)
    .map((e) => ({
      id: e.id,
      nombre: [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(' '),
      area: d.todas.find((a) => a.id === e.area_id)?.nombre ?? null,
    }))

  const turnoClave = d.turno?.clave ?? ''
  const q = (extra: Record<string, string>) =>
    `/enfermeria/asignacion?${new URLSearchParams({ fecha: d.fecha, turno: turnoClave, area: d.area?.clave ?? 'todas', ...extra })}`
  // Turno anterior equivalente: el mismo turno del día anterior
  const ayer = sumarDias(d.fecha, -1)
  const esActual = d.actual && d.actual.fecha === d.fecha && d.actual.clave === turnoClave

  return (
    <>
      <Encabezado perfil={perfil} activo="enfermeria" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              Asignación de enfermería · {d.turno?.nombre} · {fechaLarga(d.fecha)}
              {esActual && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">Turno en curso</span>}
            </h1>
            <span className="flex gap-3 text-sm">
              <Link href="/enfermeria" className="text-sky-700 hover:underline">
                ← Tablero de enfermería
              </Link>
              <a href={`/enfermeria/asignacion/imprimir?${new URLSearchParams({ fecha: d.fecha, turno: turnoClave, area: d.area?.clave ?? 'todas' })}`} target="_blank" rel="noopener" className="text-sky-700 hover:underline">
                Imprimir rol ↗
              </a>
            </span>
          </div>

          {!editable && (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              Consulta: la asignación de camas la hace la Jefatura de Enfermería.
            </p>
          )}

          <section className={`${claseTarjeta} space-y-3`}>
            <form className="flex flex-wrap items-end gap-3">
              <label className={claseEtiqueta}>
                Fecha (inicio del turno)
                <input type="date" name="fecha" defaultValue={d.fecha} className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Turno
                <select name="turno" defaultValue={turnoClave} className={claseCampo}>
                  {d.turnos.map((t) => (
                    <option key={t.clave} value={t.clave}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="area" value={d.area?.clave ?? 'todas'} />
              <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Ver</button>
              {d.actual && !esActual && (
                <Link href={q({ fecha: d.actual.fecha, turno: d.actual.clave })} className="pb-2 text-sm text-sky-700 hover:underline">
                  Ir al turno en curso
                </Link>
              )}
            </form>
            <nav className="flex flex-wrap gap-2 text-sm" aria-label="Área">
              {[...d.principales.map((a) => ({ clave: a.clave, nombre: a.nombre })), { clave: 'todas', nombre: 'Todo el hospital' }].map((a) => {
                const activa = (d.area?.clave ?? 'todas') === a.clave
                return (
                  <Link
                    key={a.clave}
                    href={q({ area: a.clave })}
                    aria-current={activa ? 'page' : undefined}
                    className={`rounded-full border px-3 py-1 ${activa ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {a.nombre}
                  </Link>
                )
              })}
            </nav>
          </section>

          <AsignacionTurno
            key={`${d.fecha}-${turnoClave}-${d.area?.clave ?? 'todas'}`}
            editable={editable}
            enfermeras={enfermeras}
            camas={d.camas}
            asignaciones={d.asignaciones}
            asignar={asignarCamas.bind(null, d.fecha, turnoClave)}
            copiar={copiarAsignacion.bind(null, d.fecha, turnoClave, ayer, turnoClave)}
            etiquetaCopiar={`Copiar del ${fechaLarga(ayer)} (mismo turno)`}
          />
        </div>
      </main>
    </>
  )
}
