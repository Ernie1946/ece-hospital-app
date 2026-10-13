import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha as fmtFecha, fechaHora } from '@/lib/formato'
import { fechaLarga, sumarDias } from '@/lib/turnos'
import { hoyChihuahua } from '@/lib/hemodialisis'
import { hora, inicioDia } from '@/lib/gabinetes'
import { ESTADO_CASO, nombreProc, type Caso } from '@/lib/hemodinamia'
import { registrarPacienteHemo } from './acciones'

// ---------------------------------------------------------------------
// Hemodinamia: agenda de la sala, quién está en sala y en recuperación,
// y búsqueda / registro de pacientes para programar.
// ---------------------------------------------------------------------

type Paciente = { id: string; expediente: string; nombre: string; primer_apellido: string; segundo_apellido: string | null; fecha_nacimiento: string | null; sexo: string }
const COLUMNAS = 'id, inicio, fin, estado, prioridad, requiere_anestesia, procedimiento, procedimiento_clave, procedimiento_detalle, paciente, expediente, hemodinamista_nombre, salida_sala_en, alergia_contraste'

export default async function HemodinamiaPage({ searchParams }: PageProps<'/hemodinamia'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!perfil.hemo)
    return (
      <>
        <Encabezado perfil={perfil} activo="hemodinamia" />
        <main className="flex-1 bg-slate-100">
          <p className={`${claseTarjeta} mx-auto mt-6 max-w-3xl text-sm text-slate-700`}>
            Hemodinamia es para el personal de la sala (médicos, enfermería y técnicos) y anestesiología. Los procedimientos de tus pacientes aparecen en su
            expediente.
          </p>
        </main>
      </>
    )
  const sp = await searchParams
  const fecha = typeof sp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyChihuahua()
  const busqueda = typeof sp.q === 'string' ? sp.q.trim() : ''
  const programa = ['medico', 'enfermeria'].includes(perfil.hemo)
  const supabase = await crearClienteServidor()
  const t = busqueda.replace(/[%,()_]/g, ' ')
  const patron = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[aeioun]/g, '_')
    .replace(/\s+/g, '%')
  const [{ data: dia }, { data: activos }, { data: pacs }] = await Promise.all([
    supabase
      .schema('clinico')
      .from('v_hemo_caso')
      .select(COLUMNAS)
      .gte('inicio', inicioDia(fecha))
      .lt('inicio', inicioDia(sumarDias(fecha, 1)))
      .order('inicio'),
    supabase.schema('clinico').from('v_hemo_caso').select(COLUMNAS).in('estado', ['en_sala', 'recuperacion']).order('inicio'),
    programa && busqueda.length >= 2
      ? supabase
          .schema('clinico')
          .from('paciente')
          .select('id, expediente, nombre, primer_apellido, segundo_apellido, fecha_nacimiento, sexo')
          .or(`nombre_busqueda.ilike.%${patron}%,expediente.ilike.%${t}%`)
          .eq('activo', true)
          .is('fusionado_en', null)
          .order('primer_apellido')
          .limit(30)
      : Promise.resolve({ data: [] }),
  ])
  const casos = (dia ?? []) as Caso[]
  const enSala = ((activos ?? []) as Caso[]).filter((c) => c.estado === 'en_sala')
  const recuperacion = ((activos ?? []) as Caso[]).filter((c) => c.estado === 'recuperacion')
  const lista = (pacs ?? []) as Paciente[]

  return (
    <>
      <Encabezado perfil={perfil} activo="hemodinamia" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <section className={`${claseTarjeta} ${enSala.length ? 'border-red-300' : ''}`} aria-label="Sala">
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Sala de hemodinamia</h2>
              {enSala.length === 0 ? (
                <p className="text-sm text-emerald-800">Sala libre.</p>
              ) : (
                enSala.map((c) => (
                  <p key={c.id} className="text-sm">
                    <span className="rounded bg-red-100 px-1.5 text-xs font-semibold text-red-900">EN SALA</span>{' '}
                    <Link href={`/hemodinamia/caso/${c.id}`} className="font-medium text-sky-700 hover:underline">
                      {c.paciente}
                    </Link>{' '}
                    · {nombreProc(c)}
                  </p>
                ))
              )}
            </section>
            <section className={claseTarjeta} aria-label="Recuperación">
              <h2 className="mb-1 text-sm font-semibold text-slate-800">En recuperación ({recuperacion.length})</h2>
              {recuperacion.length === 0 ? (
                <p className="text-sm text-slate-500">Nadie en recuperación.</p>
              ) : (
                <ul className="text-sm">
                  {recuperacion.map((c) => (
                    <li key={c.id}>
                      <Link href={`/hemodinamia/caso/${c.id}`} className="font-medium text-sky-700 hover:underline">
                        {c.paciente}
                      </Link>{' '}
                      · {nombreProc(c)} <span className="text-slate-500">· salió de sala {fechaHora(c.salida_sala_en)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={claseTarjeta}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Agenda de la sala · {fechaLarga(fecha)}</h1>
              <span className="flex flex-wrap gap-3 text-sm">
                <Link href={`/hemodinamia?fecha=${sumarDias(fecha, -1)}`} className="text-sky-700 hover:underline">
                  ← Día anterior
                </Link>
                <Link href="/hemodinamia" className="text-sky-700 hover:underline">
                  Hoy
                </Link>
                <Link href={`/hemodinamia?fecha=${sumarDias(fecha, 1)}`} className="text-sky-700 hover:underline">
                  Día siguiente →
                </Link>
              </span>
            </div>
            {casos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin procedimientos este día.</p>
            ) : (
              <table className="w-full text-left text-sm" aria-label="Agenda de hemodinamia">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Hora</th>
                    <th>Paciente</th>
                    <th>Procedimiento</th>
                    <th>Hemodinamista</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {casos.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 align-top">
                      <td className="py-1.5 font-mono">
                        {hora(c.inicio)}–{hora(c.fin)}
                      </td>
                      <td>
                        <Link href={`/hemodinamia/caso/${c.id}`} className="font-medium text-sky-700 hover:underline">
                          {c.paciente}
                        </Link>
                        <span className="block text-xs text-slate-500">Exp. {c.expediente}</span>
                      </td>
                      <td>
                        {nombreProc(c)}
                        <span className="ml-1 inline-flex flex-wrap gap-1">
                          {c.prioridad === 'urgente' && <span className="rounded bg-red-100 px-1 text-xs font-semibold text-red-900">URGENTE</span>}
                          {c.requiere_anestesia && <span className="rounded bg-violet-100 px-1 text-xs text-violet-900">Anestesia</span>}
                          {c.alergia_contraste && <span className="rounded bg-red-600 px-1 text-xs font-semibold text-white">Alergia contraste</span>}
                        </span>
                      </td>
                      <td className="text-slate-600">{c.hemodinamista_nombre ?? '—'}</td>
                      <td>
                        <span className={`rounded px-1.5 text-xs ${ESTADO_CASO[c.estado]?.color}`}>{ESTADO_CASO[c.estado]?.texto}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {programa && (
            <>
              <section className={claseTarjeta}>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Programar procedimiento</h2>
                <form className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="fecha" value={fecha} />
                  <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                    Buscar paciente
                    <input name="q" defaultValue={busqueda} placeholder="Nombre o número de expediente" className={claseCampo} />
                  </label>
                  <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Buscar</button>
                </form>
                {busqueda.length >= 2 && (
                  <ul className="mt-3 divide-y divide-slate-100 text-sm" aria-label="Pacientes encontrados">
                    {lista.length === 0 && <li className="py-2 text-slate-500">Sin coincidencias. Si es un paciente nuevo, regístralo abajo.</li>}
                    {lista.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                        <span>
                          <span className="font-medium text-slate-900">{[p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')}</span>
                          <span className="text-slate-500">
                            {' '}
                            · Exp. {p.expediente} · {p.sexo} ·{' '}
                            {p.fecha_nacimiento ? `${fmtFecha(p.fecha_nacimiento)} (${edad(p.fecha_nacimiento)} a)` : 'sin fecha de nacimiento'}
                          </span>
                        </span>
                        <Link
                          href={`/hemodinamia/programar?${new URLSearchParams({ paciente: p.id, fecha })}`}
                          className="rounded-lg bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-800"
                        >
                          Programar
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <details className={claseTarjeta}>
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">+ Registrar paciente nuevo</summary>
                <FormAccion accion={registrarPacienteHemo} boton="Registrar y programar" className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className={claseEtiqueta}>
                    Nombre(s) *
                    <input name="nombre" required className={claseCampo} />
                  </label>
                  <label className={claseEtiqueta}>
                    Primer apellido *
                    <input name="primer_apellido" required className={claseCampo} />
                  </label>
                  <label className={claseEtiqueta}>
                    Segundo apellido
                    <input name="segundo_apellido" className={claseCampo} />
                  </label>
                  <label className={claseEtiqueta}>
                    Fecha de nacimiento *
                    <input name="fecha_nacimiento" type="date" required className={claseCampo} />
                  </label>
                  <label className={claseEtiqueta}>
                    Sexo *
                    <select name="sexo" required defaultValue="" className={claseCampo}>
                      <option value="" disabled>
                        Elige…
                      </option>
                      <option value="M">Mujer</option>
                      <option value="H">Hombre</option>
                      <option value="NE">No especificado</option>
                    </select>
                  </label>
                  <label className={claseEtiqueta}>
                    Celular
                    <input name="telefono" inputMode="tel" placeholder="10 dígitos" className={claseCampo} />
                  </label>
                  <p className="text-xs text-slate-500 sm:col-span-3">
                    Si el paciente se quedará internado después del procedimiento, Admisión le abre su ingreso. Si ya existe un paciente con el mismo nombre
                    y fecha de nacimiento, se usa su expediente.
                  </p>
                </FormAccion>
              </details>
            </>
          )}
        </div>
      </main>
    </>
  )
}
