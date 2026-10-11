import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha as fmtFecha } from '@/lib/formato'
import { fechaLarga, sumarDias } from '@/lib/turnos'
import { hoyChihuahua } from '@/lib/hemodialisis'
import { ESTADO_CITA, hora, inicioDia, type Cita, type Equipo, type Gabinete } from '@/lib/gabinetes'
import { registrarExternoGab } from './acciones'

// ---------------------------------------------------------------------
// Gabinetes: agenda del día por equipo (ECG, banda, EEG, potenciales, EMG),
// búsqueda de paciente para agendar y registro de pacientes externos.
// ---------------------------------------------------------------------

type Paciente = { id: string; expediente: string; nombre: string; primer_apellido: string; segundo_apellido: string | null; fecha_nacimiento: string | null; sexo: string }

export default async function GabinetesPage({ searchParams }: PageProps<'/gabinetes'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const admision = perfil.rol === 'admision'
  if (!perfil.gabinete && !admision && perfil.rol !== 'archivo')
    return (
      <>
        <Encabezado perfil={perfil} activo="gabinetes" />
        <main className="flex-1 bg-slate-100">
          <p className={`${claseTarjeta} mx-auto mt-6 max-w-3xl text-sm text-slate-700`}>
            Esta sección es del personal de los gabinetes y de admisión. Los informes de tus pacientes aparecen en su expediente.
          </p>
        </main>
      </>
    )
  const sp = await searchParams
  const fecha = typeof sp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyChihuahua()
  const busqueda = typeof sp.q === 'string' ? sp.q.trim() : ''
  const supabase = await crearClienteServidor()

  const { data: gabs } = await supabase.schema('catalogo').from('area').select('id, clave, nombre').eq('es_gabinete', true).eq('activo', true).order('orden')
  const gabinetes = ((gabs ?? []) as Gabinete[]).filter((g) => !perfil.gabinete || g.id === perfil.gabinete)
  const gab = gabinetes.find((g) => g.clave === sp.g) ?? gabinetes[0]
  if (!gab)
    return (
      <>
        <Encabezado perfil={perfil} activo="gabinetes" />
        <main className="flex-1 bg-slate-100">
          <p className={`${claseTarjeta} mx-auto mt-6 max-w-3xl text-sm text-slate-700`}>No hay gabinetes dados de alta.</p>
        </main>
      </>
    )
  const puedeAgendar = admision || perfil.gabinete === gab.id

  const t = busqueda.replace(/[%,()_]/g, ' ')
  const patron = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[aeioun]/g, '_')
    .replace(/\s+/g, '%')
  const [{ data: eq }, { data: cit }, { data: pacs }] = await Promise.all([
    supabase.schema('catalogo').from('gab_equipo').select('id, clave, nombre, area_id, tipo').eq('area_id', gab.id).eq('activo', true).order('orden'),
    supabase
      .schema('clinico')
      .from('v_gab_cita')
      .select('*')
      .eq('area_id', gab.id)
      .gte('inicio', inicioDia(fecha))
      .lt('inicio', inicioDia(sumarDias(fecha, 1)))
      .order('inicio'),
    puedeAgendar && busqueda.length >= 2
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
  const equipos = (eq ?? []) as Equipo[]
  const citas = (cit ?? []) as Cita[]
  const lista = (pacs ?? []) as Paciente[]
  const url = (extra: Record<string, string>) => `/gabinetes?${new URLSearchParams({ g: gab.clave, fecha, ...extra })}`

  return (
    <>
      <Encabezado perfil={perfil} activo="gabinetes" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          {gabinetes.length > 1 && (
            <nav className="flex flex-wrap gap-2" aria-label="Gabinetes">
              {gabinetes.map((g) => (
                <Link
                  key={g.id}
                  href={`/gabinetes?${new URLSearchParams({ g: g.clave, fecha })}`}
                  aria-current={g.id === gab.id ? 'page' : undefined}
                  className={`rounded-full border px-3 py-1 text-sm ${g.id === gab.id ? 'border-sky-600 bg-sky-50 font-medium text-sky-800' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  {g.nombre}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              {gab.nombre} · {fechaLarga(fecha)}
            </h1>
            <span className="flex flex-wrap gap-3 text-sm">
              <Link href={url({ fecha: sumarDias(fecha, -1) })} className="text-sky-700 hover:underline">
                ← Día anterior
              </Link>
              <Link href={`/gabinetes?${new URLSearchParams({ g: gab.clave })}`} className="text-sky-700 hover:underline">
                Hoy
              </Link>
              <Link href={url({ fecha: sumarDias(fecha, 1) })} className="text-sky-700 hover:underline">
                Día siguiente →
              </Link>
            </span>
          </div>

          <div className={`grid gap-4 ${equipos.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {equipos.map((q) => {
              const delEquipo = citas.filter((c) => c.equipo === q.clave)
              return (
                <section key={q.id} className={claseTarjeta} aria-label={q.nombre}>
                  <h2 className="mb-2 text-sm font-semibold text-slate-800">
                    {q.nombre} <span className="font-normal text-slate-500">({delEquipo.filter((c) => c.estado !== 'cancelada').length})</span>
                  </h2>
                  {delEquipo.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin citas este día.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {delEquipo.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                          <span>
                            <span className="font-mono text-slate-700">
                              {hora(c.inicio)}–{hora(c.fin)}
                            </span>{' '}
                            <Link href={`/gabinetes/cita/${c.id}`} className="font-medium text-sky-700 hover:underline">
                              {c.paciente}
                            </Link>
                            <span className="text-slate-500"> · {c.estudio}</span>
                          </span>
                          <span className={`rounded px-1.5 text-xs ${ESTADO_CITA[c.estado]?.color}`}>
                            {c.resultado_id ? 'Informe listo' : ESTADO_CITA[c.estado]?.texto}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>

          {puedeAgendar && (
            <>
              <section className={claseTarjeta}>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Agendar estudio</h2>
                <form className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="g" value={gab.clave} />
                  <input type="hidden" name="fecha" value={fecha} />
                  <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                    Buscar paciente
                    <input name="q" defaultValue={busqueda} placeholder="Nombre o número de expediente" className={claseCampo} />
                  </label>
                  <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Buscar</button>
                </form>
                {busqueda.length >= 2 && (
                  <ul className="mt-3 divide-y divide-slate-100 text-sm" aria-label="Pacientes encontrados">
                    {lista.length === 0 && <li className="py-2 text-slate-500">Sin coincidencias. Si es un paciente externo nuevo, regístralo abajo.</li>}
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
                          href={`/gabinetes/agendar?${new URLSearchParams({ paciente: p.id, g: gab.clave, fecha })}`}
                          className="rounded-lg bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-800"
                        >
                          Agendar estudio
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <details className={claseTarjeta}>
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">+ Registrar paciente externo (no internado)</summary>
                <FormAccion accion={registrarExternoGab.bind(null, gab.clave)} boton="Registrar y agendar" className="mt-3 grid gap-3 sm:grid-cols-3">
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
                    Celular (WhatsApp)
                    <input name="telefono" inputMode="tel" placeholder="10 dígitos" className={claseCampo} />
                  </label>
                  <label className={`${claseEtiqueta} sm:col-span-2`}>
                    Correo
                    <input name="correo" type="email" className={claseCampo} />
                  </label>
                  <p className="text-xs text-slate-500 sm:col-span-3">
                    Con la fecha de nacimiento el paciente abre su informe en línea si se lo envías por WhatsApp o correo. Si ya existe un paciente con el
                    mismo nombre y fecha de nacimiento, se usa su expediente.
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
