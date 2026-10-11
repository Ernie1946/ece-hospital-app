import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloHemodialisis } from '@/components/SoloHemodialisis'
import { FormAccion } from '@/components/FormAccion'
import { BotonAccion } from '@/components/BotonAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { fechaLarga, sumarDias } from '@/lib/turnos'
import { ESTADO_SESION, hoyChihuahua, lunesDe } from '@/lib/hemodialisis'
import { generarSemana, programarSesion } from './acciones'

// ---------------------------------------------------------------------
// Hemodiálisis: agenda del día (máquinas × horarios de 4 h, 24 h).
// La sesión de las 3 h es la madrugada del día siguiente.
// ---------------------------------------------------------------------

type Maquina = { id: number; clave: string; nombre: string; aislada: boolean; activa: boolean }
type Horario = { id: number; clave: string; inicio: string }
type Sesion = { id: string; fecha: string; horario: string; maquina: string; estado: string; paciente: string; tipo_paciente: string; enfermera: string | null }

export default async function HemodialisisPage({ searchParams }: PageProps<'/hemodialisis'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!perfil.hd)
    return (
      <>
        <Encabezado perfil={perfil} activo="hemodialisis" />
        <SoloHemodialisis />
      </>
    )
  const { fecha: f } = await searchParams
  const fecha = typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : hoyChihuahua()
  const supabase = await crearClienteServidor()
  const [{ data: maq }, { data: hor }, { data: ses }, { data: pacs }] = await Promise.all([
    supabase.schema('catalogo').from('hd_maquina').select('id, clave, nombre, aislada, activa').order('orden'),
    supabase.schema('catalogo').from('hd_horario').select('id, clave, inicio').eq('activo', true).order('orden'),
    supabase.schema('clinico').from('v_hd_sesion').select('id, fecha, horario, maquina, estado, paciente, tipo_paciente, enfermera').eq('fecha', fecha),
    supabase.schema('clinico').from('hd_paciente').select('paciente_id, tipo, paciente(nombre, primer_apellido, segundo_apellido)').eq('activo', true),
  ])
  const maquinas = (maq ?? []) as Maquina[]
  const horarios = (hor ?? []) as Horario[]
  const sesiones = (ses ?? []) as Sesion[]
  const enCelda = (h: string, m: string) => sesiones.filter((s) => s.horario === h && s.maquina === m && !['cancelada', 'no_asistio'].includes(s.estado))
  const canceladas = sesiones.filter((s) => ['cancelada', 'no_asistio'].includes(s.estado))
  const pacientes = ((pacs ?? []) as unknown as { paciente_id: string; tipo: string; paciente: { nombre: string; primer_apellido: string; segundo_apellido: string | null } }[])
    .map((p) => ({ id: p.paciente_id, nombre: [p.paciente.nombre, p.paciente.primer_apellido, p.paciente.segundo_apellido].filter(Boolean).join(' '), tipo: p.tipo }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const libres = horarios.length * maquinas.filter((m) => m.activa).length - sesiones.length + canceladas.length
  const lunes = lunesDe(fecha)

  return (
    <>
      <Encabezado perfil={perfil} activo="hemodialisis" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Hemodiálisis · {fechaLarga(fecha)}</h1>
            <span className="flex flex-wrap gap-3 text-sm">
              <Link href={`/hemodialisis?fecha=${sumarDias(fecha, -1)}`} className="text-sky-700 hover:underline">
                ← Día anterior
              </Link>
              <Link href="/hemodialisis" className="text-sky-700 hover:underline">
                Hoy
              </Link>
              <Link href={`/hemodialisis?fecha=${sumarDias(fecha, 1)}`} className="text-sky-700 hover:underline">
                Día siguiente →
              </Link>
              <Link href="/hemodialisis/pacientes" className="font-medium text-sky-700 hover:underline">
                Pacientes del programa
              </Link>
            </span>
          </div>

          <section className={`${claseTarjeta} flex flex-wrap items-end justify-between gap-3`}>
            <FormAccion accion={programarSesion.bind(null, fecha)} boton="Programar sesión" className="flex flex-wrap items-end gap-2">
              <label className={claseEtiqueta}>
                Paciente
                <select name="paciente" required defaultValue="" className={claseCampo}>
                  <option value="" disabled>
                    Elige…
                  </option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {p.tipo === 'agudo' ? ' (internado)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className={claseEtiqueta}>
                Fecha
                <input type="date" name="fecha" defaultValue={fecha} className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Horario
                <select name="horario" required className={claseCampo}>
                  {horarios.map((h) => (
                    <option key={h.clave} value={h.clave}>
                      {h.inicio.slice(0, 5)} h
                    </option>
                  ))}
                </select>
              </label>
              <label className={claseEtiqueta}>
                Máquina
                <select name="maquina" defaultValue="" className={claseCampo}>
                  <option value="">La primera libre compatible</option>
                  {maquinas
                    .filter((m) => m.activa)
                    .map((m) => (
                      <option key={m.clave} value={m.clave}>
                        {m.nombre}
                      </option>
                    ))}
                </select>
              </label>
            </FormAccion>
            <BotonAccion etiqueta={`Generar semana del ${fechaLarga(lunes)}`} variante="secundario" alHacer={generarSemana.bind(null, lunes)} />
          </section>

          <section className={`${claseTarjeta} overflow-x-auto`}>
            <p className="mb-2 text-xs text-slate-500">
              {sesiones.length - canceladas.length} sesiones · {libres} lugares libres · la sesión de las 03:00 h es la madrugada del día siguiente.
            </p>
            <table className="w-full min-w-[56rem] table-fixed border-collapse text-xs" aria-label="Agenda de hemodiálisis">
              <thead>
                <tr>
                  <th className="w-16 p-1 text-left text-slate-500">Hora</th>
                  {maquinas.map((m) => (
                    <th key={m.clave} className={`p-1 text-left ${m.aislada ? 'text-purple-800' : 'text-slate-700'} ${m.activa ? '' : 'line-through opacity-50'}`}>
                      {m.clave}
                      {m.aislada && <span className="block font-normal">Aislada</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horarios.map((h) => (
                  <tr key={h.clave} className="border-t border-slate-100 align-top">
                    <td className="p-1 font-semibold text-slate-700">{h.inicio.slice(0, 5)}</td>
                    {maquinas.map((m) => {
                      const s = enCelda(h.clave, m.clave)[0]
                      return (
                        <td key={m.clave} className={`p-1 ${m.aislada ? 'bg-purple-50' : ''}`}>
                          {s ? (
                            <Link
                              href={`/hemodialisis/sesion/${s.id}`}
                              className="block rounded border border-slate-200 bg-white p-1 hover:border-sky-400"
                              title={s.paciente}
                            >
                              <span className="block truncate font-medium text-slate-900">{s.paciente}</span>
                              <span className={`mt-0.5 inline-block rounded px-1 ${ESTADO_SESION[s.estado]?.color}`}>{ESTADO_SESION[s.estado]?.texto}</span>
                              {s.tipo_paciente === 'agudo' && <span className="ml-1 text-sky-800">Internado</span>}
                            </Link>
                          ) : (
                            <span className="block p-1 text-slate-300">Libre</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {canceladas.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Canceladas o inasistencias: {canceladas.map((c) => `${c.paciente} (${c.horario} h, ${ESTADO_SESION[c.estado]?.texto})`).join(' · ')}
              </p>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
