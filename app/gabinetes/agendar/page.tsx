import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { SelectorEstudioGab } from '@/components/SelectorEstudioGab'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha as fmtFecha, fechaHora } from '@/lib/formato'
import { fechaLarga, sumarDias } from '@/lib/turnos'
import { hoyChihuahua } from '@/lib/hemodialisis'
import { hora, inicioDia, type Cita, type Equipo, type Estudio, type Gabinete } from '@/lib/gabinetes'
import { programarCita } from '../acciones'

// Agendar un estudio de gabinete para un paciente (personal del gabinete o admisión)
export default async function AgendarGabinetePage({ searchParams }: PageProps<'/gabinetes/agendar'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const sp = await searchParams
  const pacienteId = typeof sp.paciente === 'string' ? sp.paciente : ''
  const fecha = typeof sp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyChihuahua()
  const supabase = await crearClienteServidor()
  const { data: g } = await supabase
    .schema('catalogo')
    .from('area')
    .select('id, clave, nombre')
    .eq('es_gabinete', true)
    .eq('clave', typeof sp.g === 'string' ? sp.g : '')
    .maybeSingle()
  const gab = g as Gabinete | null
  if (!gab || !/^[0-9a-f-]{36}$/.test(pacienteId)) notFound()
  if (perfil.rol !== 'admision' && perfil.gabinete !== gab.id) notFound()

  const [{ data: p }, { data: eq }, { data: es }, { data: ords }, { data: cit }] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('id, expediente, nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, telefono').eq('id', pacienteId).maybeSingle(),
    supabase.schema('catalogo').from('gab_equipo').select('id, clave, nombre, area_id, tipo').eq('area_id', gab.id).eq('activo', true).order('orden'),
    supabase.schema('catalogo').from('gab_estudio').select('clave, nombre, tipo_equipo, duracion_min, indicaciones').eq('activo', true).order('nombre'),
    supabase.schema('clinico').rpc('gab_ordenes_pendientes', { p_paciente: pacienteId }),
    supabase
      .schema('clinico')
      .from('v_gab_cita')
      .select('id, inicio, fin, equipo_nombre, estudio, estado')
      .eq('area_id', gab.id)
      .eq('estado', 'programada')
      .gte('inicio', inicioDia(fecha))
      .lt('inicio', inicioDia(sumarDias(fecha, 1)))
      .order('inicio'),
  ])
  if (!p) notFound()
  const equipos = (eq ?? []) as Equipo[]
  const tipos = new Set(equipos.map((q) => q.tipo))
  const estudios = ((es ?? []) as Estudio[]).filter((e) => tipos.has(e.tipo_equipo))
  const ordenes = (ords ?? []) as { id: string; descripcion: string; solicitada_en: string | null; medico: string }[]
  const ocupado = (cit ?? []) as Pick<Cita, 'id' | 'inicio' | 'fin' | 'equipo_nombre' | 'estudio' | 'estado'>[]
  const nombre = [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')

  return (
    <>
      <Encabezado perfil={perfil} activo="gabinetes" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <Link href={`/gabinetes?${new URLSearchParams({ g: gab.clave, fecha })}`} className="text-sm text-sky-700 hover:underline">
            ← {gab.nombre}
          </Link>
          <section className={claseTarjeta}>
            <h1 className="text-xl font-semibold text-slate-900">Agendar estudio · {nombre}</h1>
            <p className="text-sm text-slate-600">
              Exp. {p.expediente} · {p.sexo} · {p.fecha_nacimiento ? `${fmtFecha(p.fecha_nacimiento)} (${edad(p.fecha_nacimiento)} años)` : 'sin fecha de nacimiento'}
              {p.telefono ? ` · Cel. ${p.telefono}` : ''}
            </p>
          </section>

          <section className={claseTarjeta}>
            <FormAccion accion={programarCita.bind(null, p.id)} boton="Agendar" className="grid gap-3 sm:grid-cols-3">
              <SelectorEstudioGab estudios={estudios} equipos={equipos} />
              <label className={claseEtiqueta}>
                Fecha *
                <input name="fecha" type="date" required defaultValue={fecha} min={hoyChihuahua()} className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Hora *
                <input name="hora" type="time" required step={300} className={claseCampo} />
              </label>
              {ordenes.length > 0 ? (
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
              ) : (
                <span />
              )}
              <label className={claseEtiqueta}>
                Médico que solicita
                <input name="solicitante" placeholder="Dr(a). …" className={claseCampo} />
              </label>
              <label className={`${claseEtiqueta} sm:col-span-2`}>
                Notas
                <input name="notas" placeholder="Motivo del estudio, medicamentos, alergias…" className={claseCampo} />
              </label>
            </FormAccion>
          </section>

          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Ocupado el {fechaLarga(fecha)}</h2>
            <p className="mb-2 text-xs text-slate-500">
              Para ver otro día:{' '}
              <Link href={`/gabinetes/agendar?${new URLSearchParams({ paciente: p.id, g: gab.clave, fecha: sumarDias(fecha, -1) })}`} className="text-sky-700 hover:underline">
                ← anterior
              </Link>{' '}
              ·{' '}
              <Link href={`/gabinetes/agendar?${new URLSearchParams({ paciente: p.id, g: gab.clave, fecha: sumarDias(fecha, 1) })}`} className="text-sky-700 hover:underline">
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
                    · {c.equipo_nombre} · {c.estudio}
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
