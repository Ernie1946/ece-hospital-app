import Link from 'next/link'
import { notFound } from 'next/navigation'
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
import { CATEGORIA, nombreProc, type Caso } from '@/lib/hemodinamia'
import { programarCaso } from '../acciones'

type Proc = { clave: string; nombre: string; categoria: string; duracion_min: number }

// Programar un procedimiento en la sala de hemodinamia
export default async function ProgramarHemoPage({ searchParams }: PageProps<'/hemodinamia/programar'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!['medico', 'enfermeria'].includes(perfil.hemo ?? '')) notFound()
  const sp = await searchParams
  const pacienteId = typeof sp.paciente === 'string' && /^[0-9a-f-]{36}$/.test(sp.paciente) ? sp.paciente : null
  if (!pacienteId) notFound()
  const fecha = typeof sp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyChihuahua()
  const supabase = await crearClienteServidor()
  const [{ data: p }, { data: pr }, { data: per }, { data: ords }, { data: ocup }, { data: al }] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('id, expediente, nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento').eq('id', pacienteId).maybeSingle(),
    supabase.schema('catalogo').from('hemo_procedimiento').select('clave, nombre, categoria, duracion_min').eq('activo', true).order('orden'),
    supabase.schema('clinico').rpc('hemo_personal'),
    supabase.schema('clinico').rpc('hemo_ordenes_pendientes', { p_paciente: pacienteId }),
    supabase
      .schema('clinico')
      .from('v_hemo_caso')
      .select('id, inicio, fin, procedimiento, procedimiento_clave, procedimiento_detalle, paciente')
      .in('estado', ['programado', 'en_sala'])
      .gte('inicio', inicioDia(fecha))
      .lt('inicio', inicioDia(sumarDias(fecha, 1)))
      .order('inicio'),
    supabase.schema('clinico').rpc('hemo_alergias', { p_paciente: pacienteId }),
  ])
  if (!p) notFound()
  const procs = (pr ?? []) as Proc[]
  const medicos = ((per ?? []) as { id: string; nombre: string; papel: string }[]).filter((x) => x.papel === 'medico')
  const ordenes = (ords ?? []) as { id: string; descripcion: string; solicitada_en: string | null; medico: string }[]
  const ocupado = (ocup ?? []) as Pick<Caso, 'id' | 'inicio' | 'fin' | 'procedimiento' | 'procedimiento_clave' | 'procedimiento_detalle' | 'paciente'>[]
  const alergias = ((al ?? []) as { todas: string | null; contraste: boolean }[])[0]
  const nombre = [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')
  const urlDia = (f: string) => `/hemodinamia/programar?${new URLSearchParams({ paciente: p.id, fecha: f })}`

  return (
    <>
      <Encabezado perfil={perfil} activo="hemodinamia" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <Link href={`/hemodinamia?fecha=${fecha}`} className="text-sm text-sky-700 hover:underline">
            ← Hemodinamia
          </Link>
          <section className={claseTarjeta}>
            <h1 className="text-xl font-semibold text-slate-900">Programar procedimiento · {nombre}</h1>
            <p className="text-sm text-slate-600">
              Exp. {p.expediente} · {p.sexo} · {p.fecha_nacimiento ? `${fmtFecha(p.fecha_nacimiento)} (${edad(p.fecha_nacimiento)} años)` : 'sin fecha de nacimiento'}
            </p>
            {alergias?.todas && (
              <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${alergias.contraste ? 'bg-red-600 font-semibold text-white' : 'bg-red-50 text-red-800'}`}>
                {alergias.contraste ? '⚠ ALERGIA A CONTRASTE / YODO O LÁTEX · ' : 'Alergias: '}
                {alergias.todas}
              </p>
            )}
          </section>

          <section className={claseTarjeta}>
            <FormAccion accion={programarCaso.bind(null, p.id)} boton="Programar" className="grid gap-3 sm:grid-cols-3">
              <label className={`${claseEtiqueta} sm:col-span-2`}>
                Procedimiento *
                <select name="procedimiento" required defaultValue="" className={claseCampo}>
                  <option value="">Elige…</option>
                  {Object.entries(CATEGORIA).map(([cat, txt]) => (
                    <optgroup key={cat} label={txt}>
                      {procs
                        .filter((x) => x.categoria === cat)
                        .map((x) => (
                          <option key={x.clave} value={x.clave}>
                            {x.nombre} ({x.duracion_min} min)
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className={claseEtiqueta}>
                Prioridad
                <select name="prioridad" defaultValue="electivo" className={claseCampo}>
                  <option value="electivo">Electivo</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
              <label className={`${claseEtiqueta} sm:col-span-3`}>
                Detalle del procedimiento
                <input name="detalle" placeholder="Vaso o sitio, tipo de dispositivo… (obligatorio si es «Otro»)" className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Fecha *
                <input name="fecha" type="date" required defaultValue={fecha} min={hoyChihuahua()} className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Hora *
                <input name="hora" type="time" required className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Médico responsable
                <select name="hemodinamista" defaultValue={perfil.hemo === 'medico' ? perfil.id : ''} className={claseCampo}>
                  <option value="">Sin asignar</option>
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${claseEtiqueta} sm:col-span-3`}>
                Indicación (diagnóstico o motivo) *
                <input name="indicacion" required placeholder="SICA sin elevación del ST, bloqueo AV completo, claudicación…" className={claseCampo} />
              </label>
              {ordenes.length > 0 && (
                <label className={`${claseEtiqueta} sm:col-span-3`}>
                  Orden del médico en el ECE
                  <select name="orden" defaultValue="" className={claseCampo}>
                    <option value="">Sin orden del ECE</option>
                    {ordenes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.descripcion} · {o.medico} ({fechaHora(o.solicitada_en)})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name="anestesia" /> Requiere anestesiólogo
              </label>
              <label className={`${claseEtiqueta} sm:col-span-2`}>
                Notas
                <input name="notas" placeholder="Anticoagulación, material especial, acceso preferido…" className={claseCampo} />
              </label>
            </FormAccion>
          </section>

          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Sala ocupada el {fechaLarga(fecha)}</h2>
            <p className="mb-2 text-xs text-slate-500">
              Otro día:{' '}
              <Link href={urlDia(sumarDias(fecha, -1))} className="text-sky-700 hover:underline">
                ← anterior
              </Link>{' '}
              ·{' '}
              <Link href={urlDia(sumarDias(fecha, 1))} className="text-sky-700 hover:underline">
                siguiente →
              </Link>
            </p>
            {ocupado.length === 0 ? (
              <p className="text-sm text-slate-500">Todo el día libre.</p>
            ) : (
              <ul className="text-sm">
                {ocupado.map((c) => (
                  <li key={c.id}>
                    <span className="font-mono">
                      {hora(c.inicio)}–{hora(c.fin)}
                    </span>{' '}
                    · {nombreProc(c)} · {c.paciente}
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
