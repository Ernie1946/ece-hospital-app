import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormProgramarCirugia } from '@/components/FormProgramarCirugia'
import { claseTarjeta } from '@/lib/estilos'
import { ahora } from '@/lib/formato'
import { COLOR_ASA, ESTADO_CIRUGIA } from '@/lib/anestesia'
import { buscarProcedimientos, programarCirugia } from './acciones'

// ---------------------------------------------------------------------
// Agenda quirúrgica del día por sala, y programación de cirugías.
// ---------------------------------------------------------------------

type Cirugia = {
  id: string
  inicio_programado: string
  duracion_min: number
  tipo: string
  estado: string
  procedimiento: string
  sala: string
  paciente: string
  sexo: string
  edad: number | null
  cirujano: string
  anestesiologo: string | null
  anestesiologo_id: string | null
  valoracion_id: string | null
  asa: string | null
  cama: string | null
  alergias: string | null
  aldrete: number | null
}

const ROLES_PROGRAMAN = ['medico_tratante', 'medico_residente', 'anestesiologo', 'admision']
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { timeZone: 'America/Chihuahua', hour: '2-digit', minute: '2-digit', hour12: false })

function hoyChihuahua() {
  return new Date(ahora() - 6 * 3600 * 1000).toISOString().slice(0, 10)
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export default async function AnestesiaPage({ searchParams }: PageProps<'/anestesia'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const sp = await searchParams
  const fecha = typeof sp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyChihuahua()
  const encuentroInicial = typeof sp.encuentro === 'string' ? sp.encuentro : undefined
  const recienProgramada = sp.aviso === 'programada' && typeof sp.cirugia === 'string' ? sp.cirugia : null
  const desde = `${fecha}T00:00:00-06:00`
  const hasta = `${sumarDias(fecha, 1)}T00:00:00-06:00`

  const supabase = await crearClienteServidor()
  const puedeProgramar = ROLES_PROGRAMAN.includes(perfil.rol)

  const [agenda, salas] = await Promise.all([
    supabase
      .schema('clinico')
      .from('v_agenda_quirurgica')
      .select('id, inicio_programado, duracion_min, tipo, estado, procedimiento, sala, paciente, sexo, edad, cirujano, anestesiologo, anestesiologo_id, valoracion_id, asa, cama, alergias, aldrete')
      .gte('inicio_programado', desde)
      .lt('inicio_programado', hasta)
      .order('inicio_programado'),
    supabase.schema('catalogo').from('sala_quirurgica').select('id, clave, nombre').eq('activa', true).order('clave'),
  ])
  const cirugias = (agenda.data ?? []) as Cirugia[]
  const listaSalas = (salas.data ?? []) as { id: number; clave: string; nombre: string }[]

  // Datos para programar
  let pacientes: { id: string; texto: string }[] = []
  let cirujanos: { id: string; texto: string }[] = []
  let anestesiologos: { id: string; texto: string }[] = []
  if (puedeProgramar) {
    const [enc, medicos] = await Promise.all([
      supabase
        .schema('clinico')
        .from('encuentro')
        .select('id, folio, estado, paciente(nombre, primer_apellido, segundo_apellido)')
        .in('estado', ['programado', 'activo'])
        .neq('tipo', 'urgencias')
        .order('creado_en', { ascending: false })
        .limit(300),
      supabase
        .schema('seguridad')
        .from('usuario')
        .select('id, nombre, primer_apellido, rol, especialidad')
        .in('rol', ['medico_tratante', 'medico_residente', 'anestesiologo'])
        .eq('activo', true)
        .order('primer_apellido'),
    ])
    pacientes = ((enc.data ?? []) as unknown as {
      id: string
      folio: string
      estado: string
      paciente: { nombre: string; primer_apellido: string; segundo_apellido: string | null } | null
    }[])
      .map((e) => ({
        id: e.id,
        texto: `${[e.paciente?.primer_apellido, e.paciente?.segundo_apellido, e.paciente?.nombre].filter(Boolean).join(' ')} · ${e.folio}${
          e.estado === 'programado' ? ' (ingreso programado)' : ''
        }`,
      }))
      .sort((a, b) => a.texto.localeCompare(b.texto, 'es'))
    const ms = (medicos.data ?? []) as { id: string; nombre: string; primer_apellido: string; rol: string; especialidad: string | null }[]
    cirujanos = ms
      .filter((m) => m.rol !== 'anestesiologo')
      .map((m) => ({ id: m.id, texto: `Dr(a). ${m.nombre} ${m.primer_apellido}${m.especialidad ? ` · ${m.especialidad}` : ''}` }))
    anestesiologos = ms.filter((m) => m.rol === 'anestesiologo').map((m) => ({ id: m.id, texto: `Dr(a). ${m.nombre} ${m.primer_apellido}` }))
  }

  const fechaTexto = new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const fechaLarga = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)
  const vigentes = cirugias.filter((c) => c.estado !== 'cancelada')
  const sinValoracion = vigentes.filter((c) => !c.valoracion_id).length

  return (
    <>
      <Encabezado perfil={perfil} activo="anestesia" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Agenda quirúrgica</h1>
            <nav className="flex items-center gap-2 text-sm" aria-label="Día">
              <Link href={`/anestesia?fecha=${sumarDias(fecha, -1)}`} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50">
                ← Día anterior
              </Link>
              <span className="font-medium text-slate-800">{fechaLarga}</span>
              <Link href={`/anestesia?fecha=${sumarDias(fecha, 1)}`} className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50">
                Día siguiente →
              </Link>
              {fecha !== hoyChihuahua() && (
                <Link href="/anestesia" className="text-sky-700 hover:underline">
                  Hoy
                </Link>
              )}
            </nav>
          </div>

          {recienProgramada && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Cirugía programada.{' '}
              <Link href={`/anestesia/cirugia/${recienProgramada}`} className="font-medium underline">
                Abrir
              </Link>
            </p>
          )}

          <p className="text-sm text-slate-600">
            {vigentes.length} cirugía{vigentes.length === 1 ? '' : 's'} · {sinValoracion} sin valoración preanestésica
          </p>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {listaSalas.map((s) => {
              const deSala = cirugias.filter((c) => c.sala === s.clave)
              return (
                <section key={s.id} className={claseTarjeta}>
                  <h2 className="text-sm font-semibold text-slate-800">
                    {s.nombre} <span className="font-normal text-slate-500">({s.clave})</span>
                  </h2>
                  {deSala.length === 0 && <p className="mt-2 text-sm text-slate-400">Sin cirugías.</p>}
                  <ul className="mt-2 space-y-2">
                    {deSala.map((c) => {
                      const e = ESTADO_CIRUGIA[c.estado]
                      return (
                        <li key={c.id}>
                          <Link
                            href={`/anestesia/cirugia/${c.id}`}
                            className={`block rounded-lg border p-2 text-sm hover:border-sky-400 ${c.estado === 'cancelada' ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="font-semibold text-slate-900">
                                {hora(c.inicio_programado)} · {c.duracion_min} min
                              </span>
                              <span className="flex gap-1 text-xs">
                                {c.tipo === 'urgencia' && <span className="rounded bg-red-100 px-1 text-red-800">Urgencia</span>}
                                <span className={`rounded px-1 ${e.color}`}>{e.texto}</span>
                              </span>
                            </div>
                            <p className="font-medium text-slate-900">{c.paciente}</p>
                            <p className="text-xs text-slate-600">
                              {c.sexo} · {c.edad ?? '—'} a{c.cama ? ` · ${c.cama}` : ''} · {c.procedimiento}
                            </p>
                            <p className="text-xs text-slate-500">
                              Cirujano: {c.cirujano} · Anestesia: {c.anestesiologo ?? 'por asignar'}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1 text-xs">
                              {c.valoracion_id ? (
                                <span className={`rounded px-1 font-medium ${COLOR_ASA[c.asa ?? ''] ?? 'bg-slate-100'}`}>Valorado · ASA {c.asa}</span>
                              ) : (
                                c.estado !== 'cancelada' && <span className="rounded bg-amber-100 px-1 text-amber-900">Valoración pendiente</span>
                              )}
                              {c.estado === 'en_recuperacion' && (
                                <span className="rounded bg-violet-100 px-1 text-violet-900">
                                  {c.aldrete === null ? 'Sin Aldrete' : `Aldrete ${c.aldrete}/10`}
                                </span>
                              )}
                              {c.alergias && <span className="rounded bg-red-100 px-1 text-red-800">Alergia: {c.alergias}</span>}
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>

          {puedeProgramar && (
            <section id="programar" className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Programar cirugía</h2>
              {pacientes.length === 0 ? (
                <p className="text-sm text-slate-500">No hay pacientes con ingreso programado o activo. Primero se programa el ingreso en Admisión.</p>
              ) : (
                <FormProgramarCirugia
                  accion={programarCirugia}
                  buscar={buscarProcedimientos}
                  pacientes={pacientes}
                  salas={listaSalas.map((s) => ({ id: String(s.id), texto: s.clave }))}
                  cirujanos={cirujanos}
                  anestesiologos={anestesiologos}
                  encuentroInicial={encuentroInicial}
                  fechaInicial={fecha}
                />
              )}
            </section>
          )}
        </div>
      </main>
    </>
  )
}
