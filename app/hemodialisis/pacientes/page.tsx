import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloHemodialisis } from '@/components/SoloHemodialisis'
import { BotonAccion } from '@/components/BotonAccion'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha } from '@/lib/formato'
import { ACCESOS, DIAS_CORTOS, requiereAislado, serologiaVencida, type HdPaciente } from '@/lib/hemodialisis'
import { agregarAlPrograma, registrarPacienteHd } from '../acciones'

type Fila = HdPaciente & {
  paciente: { nombre: string; primer_apellido: string; segundo_apellido: string | null; expediente: string; fecha_nacimiento: string | null }
  hd_horario_fijo: { dia_semana: number; horario: { clave: string } | null; maquina: { clave: string } | null }[]
}

export default async function PacientesHdPage({ searchParams }: PageProps<'/hemodialisis/pacientes'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!perfil.hd)
    return (
      <>
        <Encabezado perfil={perfil} activo="hemodialisis" />
        <SoloHemodialisis />
      </>
    )
  const { q, bajas } = await searchParams
  const busqueda = typeof q === 'string' ? q.trim() : ''
  const supabase = await crearClienteServidor()
  const db = supabase.schema('clinico')
  const { data } = await db
    .from('hd_paciente')
    .select(
      '*, paciente(nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento), hd_horario_fijo(dia_semana, horario:hd_horario(clave), maquina:hd_maquina(clave))'
    )
    .eq('activo', bajas !== '1')
  const lista = ((data ?? []) as unknown as Fila[]).sort((a, b) => a.paciente.primer_apellido.localeCompare(b.paciente.primer_apellido, 'es'))
  const enPrograma = new Set(lista.map((x) => x.paciente_id))

  const patron = busqueda
    .replace(/[%,()_]/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[aeioun]/g, '_')
    .replace(/\s+/g, '%')
  const { data: encontrados } =
    busqueda.length >= 2
      ? await db
          .from('paciente')
          .select('id, expediente, nombre, primer_apellido, segundo_apellido, fecha_nacimiento')
          .or(`nombre_busqueda.ilike.%${patron}%,expediente.ilike.%${busqueda.replace(/[%,()_]/g, ' ')}%`)
          .eq('activo', true)
          .is('fusionado_en', null)
          .limit(20)
      : { data: [] }

  return (
    <>
      <Encabezado perfil={perfil} activo="hemodialisis" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              Pacientes del programa de hemodiálisis ({lista.length}){bajas === '1' ? ' · bajas' : ''}
            </h1>
            <span className="flex gap-3 text-sm">
              <Link href="/hemodialisis" className="text-sky-700 hover:underline">
                ← Agenda
              </Link>
              <Link href={bajas === '1' ? '/hemodialisis/pacientes' : '/hemodialisis/pacientes?bajas=1'} className="text-sky-700 hover:underline">
                {bajas === '1' ? 'Ver activos' : 'Ver bajas'}
              </Link>
            </span>
          </div>

          <section className={claseTarjeta}>
            <form className="flex flex-wrap items-end gap-3">
              <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                Agregar paciente al programa
                <input name="q" defaultValue={busqueda} placeholder="Nombre o expediente" className={claseCampo} />
              </label>
              <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Buscar</button>
            </form>
            {busqueda.length >= 2 && (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {(encontrados ?? []).length === 0 && (
                  <li className="py-2 text-slate-500">Sin coincidencias. Si es un paciente nuevo, regístralo abajo.</li>
                )}
                {(encontrados ?? []).map((p) => (
                  <li key={p.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {[p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')}
                      <span className="text-slate-500"> · Exp. {p.expediente as string}</span>
                    </span>
                    {enPrograma.has(p.id as string) ? (
                      <Link href={`/hemodialisis/paciente/${p.id}`} className="text-sky-700 hover:underline">
                        Ya está en el programa →
                      </Link>
                    ) : (
                      <span className="flex gap-2">
                        <BotonAccion etiqueta="Crónico (externo)" alHacer={agregarAlPrograma.bind(null, p.id as string, 'cronico')} />
                        <BotonAccion etiqueta="Agudo (internado)" variante="secundario" alHacer={agregarAlPrograma.bind(null, p.id as string, 'agudo')} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {perfil.hd !== 'consulta' && (
            <details className={claseTarjeta} open={busqueda.length >= 2 && (encontrados ?? []).length === 0}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">+ Registrar paciente nuevo (sin expediente)</summary>
              <FormAccion accion={registrarPacienteHd} boton="Registrar e ingresar al programa" className="mt-3 grid gap-3 sm:grid-cols-3">
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
                  Tipo
                  <select name="tipo" defaultValue="cronico" className={claseCampo}>
                    <option value="cronico">Crónico (externo)</option>
                    <option value="agudo">Agudo (internado)</option>
                  </select>
                </label>
                <label className={claseEtiqueta}>
                  Celular
                  <input name="telefono" inputMode="tel" placeholder="10 dígitos" className={claseCampo} />
                </label>
                <label className={`${claseEtiqueta} sm:col-span-2`}>
                  Correo
                  <input name="correo" type="email" className={claseCampo} />
                </label>
                <p className="text-xs text-slate-500 sm:col-span-3">Si ya existe un paciente con el mismo nombre y fecha de nacimiento, se usa su expediente.</p>
              </FormAccion>
            </details>
          )}

          <section className={claseTarjeta}>
            {lista.length === 0 ? (
              <p className="text-sm text-slate-500">Sin pacientes.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Paciente</th>
                    <th>Tipo</th>
                    <th>Horario fijo</th>
                    <th>Acceso</th>
                    <th>Peso seco</th>
                    <th>Serología</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((x) => {
                    const fijo = [...x.hd_horario_fijo].sort((a, b) => a.dia_semana - b.dia_semana)
                    return (
                      <tr key={x.paciente_id} className="border-t border-slate-100">
                        <td className="py-1.5">
                          <Link href={`/hemodialisis/paciente/${x.paciente_id}`} className="font-medium text-sky-700 hover:underline">
                            {[x.paciente.nombre, x.paciente.primer_apellido, x.paciente.segundo_apellido].filter(Boolean).join(' ')}
                          </Link>
                          <span className="block text-xs text-slate-500">
                            Exp. {x.paciente.expediente}
                            {x.paciente.fecha_nacimiento ? ` · ${edad(x.paciente.fecha_nacimiento)} a` : ''}
                          </span>
                        </td>
                        <td>{x.tipo === 'cronico' ? 'Crónico' : 'Agudo'}</td>
                        <td className="text-slate-600">
                          {fijo.length ? `${fijo.map((h) => DIAS_CORTOS[h.dia_semana]).join(' ')} · ${fijo[0].horario?.clave} h${fijo[0].maquina ? ` · ${fijo[0].maquina.clave}` : ''}` : '—'}
                        </td>
                        <td className="text-slate-600">{x.acceso_tipo ? ACCESOS[x.acceso_tipo] : '—'}</td>
                        <td className="text-slate-600">{x.peso_seco ? `${x.peso_seco} kg` : '—'}</td>
                        <td className="text-xs">
                          {requiereAislado(x) ? (
                            <span className="rounded bg-purple-100 px-1 text-purple-900">Cubículo aislado</span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-1 text-emerald-900">Negativa</span>
                          )}
                          {serologiaVencida(x.serologia_fecha) && (
                            <span className="ml-1 rounded bg-amber-100 px-1 text-amber-900" title={x.serologia_fecha ? `Última: ${fecha(x.serologia_fecha)}` : 'Sin fecha'}>
                              Repetir serología
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
