import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseTarjeta } from '@/lib/estilos'
import { ahora, fechaHora } from '@/lib/formato'
import { alertasSignos, HORAS_SIN_SIGNOS, type Signos } from '@/lib/clinica'
import { cambiarEstadoCama, registrarLlegada } from './acciones'

// ---------------------------------------------------------------------
// Tablero de enfermería por servicio: llegadas pendientes, pacientes en
// piso con sus últimos signos, y camas por limpiar.
// ---------------------------------------------------------------------

type CamaCenso = {
  cama: string
  servicio: string
  estado: string
  estado_desde: string
  encuentro_id: string | null
  paciente: string | null
  sexo: string | null
  edad: number | null
  dias_estancia: number | null
  alergias: string | null
  aislamiento: string | null
  medico_tratante: string | null
}

type SignosFila = Signos & { encuentro_id: string; tomado_en: string }

const AISLAMIENTO: Record<string, string> = { contacto: 'Contacto', gotas: 'Gotas', aereo: 'Aéreo' }

export default async function EnfermeriaPage({ searchParams }: PageProps<'/enfermeria'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const supabase = await crearClienteServidor()
  const { data: servicios } = await supabase
    .schema('catalogo')
    .from('servicio')
    .select('id, clave, nombre')
    .eq('activo', true)
    .order('id')

  // Servicio elegido: el de la URL, o el de la enfermera, o el primero
  const { servicio: elegido } = await searchParams
  const servicio =
    servicios?.find((s) => s.clave === elegido) ??
    servicios?.find((s) => s.id === perfil.servicio_id) ??
    servicios?.[0]

  const { data: censoData } = await supabase
    .schema('camas')
    .from('v_censo')
    .select('cama, servicio, estado, estado_desde, encuentro_id, paciente, sexo, edad, dias_estancia, alergias, aislamiento, medico_tratante')
    .eq('servicio', servicio?.clave ?? '')

  const camas = ((censoData ?? []) as CamaCenso[]).sort((a, b) => a.cama.localeCompare(b.cama, 'es', { numeric: true }))
  const llegadas = camas.filter((c) => c.estado === 'reservada' && c.encuentro_id)
  const enPiso = camas.filter((c) => c.estado === 'ocupada' && c.encuentro_id)
  const porLimpiar = camas.filter((c) => c.estado === 'sucia' || c.estado === 'limpieza')
  const disponibles = camas.filter((c) => c.estado === 'disponible').length

  // Últimos signos (24 h) de los pacientes en piso
  const hace24h = new Date(ahora() - 24 * 3600 * 1000).toISOString()
  const { data: signosData } = enPiso.length
    ? await supabase
        .schema('clinico')
        .from('signos_vitales')
        .select('encuentro_id, tomado_en, ta_sistolica, ta_diastolica, frecuencia_cardiaca, frecuencia_respiratoria, temperatura, spo2, dolor_eva, glucosa_capilar')
        .in('encuentro_id', enPiso.map((c) => c.encuentro_id!))
        .gte('tomado_en', hace24h)
        .order('tomado_en', { ascending: false })
    : { data: [] }

  const ultimosSignos = new Map<string, SignosFila>()
  for (const s of (signosData ?? []) as SignosFila[]) {
    if (!ultimosSignos.has(s.encuentro_id)) ultimosSignos.set(s.encuentro_id, s)
  }

  const esEnfermeria = perfil.rol === 'enfermeria'

  return (
    <>
      <Encabezado perfil={perfil} activo="enfermeria" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Enfermería · {servicio?.nombre}</h1>
            <p className="text-sm text-slate-600">
              {enPiso.length} en piso · {llegadas.length} por llegar · {disponibles} disponibles
            </p>
          </div>

          {!esEnfermeria && (
            <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
              Vista de consulta: registrar llegadas, limpieza y la hoja de enfermería corresponde al personal de enfermería.
            </p>
          )}

          {/* Servicios */}
          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Servicio">
            {(servicios ?? []).map((s) => (
              <Link
                key={s.id as number}
                href={`/enfermeria?servicio=${s.clave}`}
                aria-current={s.clave === servicio?.clave ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 ${
                  s.clave === servicio?.clave
                    ? 'bg-sky-700 border-sky-700 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.nombre as string}
              </Link>
            ))}
          </nav>

          {/* Llegadas pendientes */}
          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Llegadas pendientes ({llegadas.length})</h2>
            {llegadas.length === 0 ? (
              <p className="text-sm text-slate-500">Sin camas reservadas por Admisión en este servicio.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {llegadas.map((c) => (
                  <li key={c.cama} className="py-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-semibold text-slate-900">{c.cama}</span> · {c.paciente}
                      <span className="text-slate-500"> · reservada {fechaHora(c.estado_desde)}</span>
                      {c.alergias && <span className="ml-2 rounded bg-red-100 px-1 text-xs text-red-800">Alergia: {c.alergias}</span>}
                    </div>
                    {esEnfermeria && (
                      <FormAccion
                        accion={registrarLlegada.bind(null, c.encuentro_id!, c.cama)}
                        boton="Registrar llegada"
                        className="flex items-center gap-2"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Pacientes en piso */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">Pacientes en piso ({enPiso.length})</h2>
            {enPiso.length === 0 && <p className="text-sm text-slate-500">Sin pacientes hospitalizados en este servicio.</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {enPiso.map((c) => {
                const s = ultimosSignos.get(c.encuentro_id!)
                const horas = s ? (ahora() - new Date(s.tomado_en).getTime()) / 3600000 : null
                const atrasado = horas === null || horas >= HORAS_SIN_SIGNOS
                const alertas = s ? alertasSignos(s) : []
                return (
                  <Link
                    key={c.cama}
                    href={`/enfermeria/encuentro/${c.encuentro_id}`}
                    className="block bg-white rounded-xl border border-slate-200 p-3 hover:border-sky-400 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{c.cama}</span>
                      <span className="text-xs text-slate-500">
                        {c.sexo} · {c.edad ?? '—'} a · día {(c.dias_estancia ?? 0) + 1}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 leading-tight">{c.paciente}</p>
                    {c.medico_tratante && <p className="text-xs text-slate-500">Dr(a). {c.medico_tratante}</p>}
                    <div className="mt-1 flex flex-wrap gap-1 text-xs">
                      {c.alergias && <span className="rounded bg-red-100 px-1 text-red-800 font-medium">Alergia: {c.alergias}</span>}
                      {c.aislamiento && c.aislamiento !== 'ninguno' && (
                        <span className="rounded bg-purple-100 px-1 text-purple-800">Aislamiento {AISLAMIENTO[c.aislamiento]}</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs">
                      {s ? (
                        <p className="text-slate-700">
                          TA {s.ta_sistolica ?? '—'}/{s.ta_diastolica ?? '—'} · FC {s.frecuencia_cardiaca ?? '—'} · T{' '}
                          {s.temperatura ?? '—'} · SpO₂ {s.spo2 ?? '—'}
                        </p>
                      ) : null}
                      {alertas.length > 0 && <p className="text-red-700 font-medium">⚠ {alertas.join(' · ')}</p>}
                      <p className={atrasado ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                        {s
                          ? `Signos hace ${horas! < 1 ? `${Math.round(horas! * 60)} min` : `${Math.floor(horas!)} h`}`
                          : 'Sin signos en 24 h'}
                        {atrasado && ' · tomar signos'}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* Camas por limpiar */}
          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Camas por limpiar ({porLimpiar.length})</h2>
            {porLimpiar.length === 0 ? (
              <p className="text-sm text-slate-500">No hay camas pendientes de limpieza.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {porLimpiar.map((c) => (
                  <li key={c.cama} className="py-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-semibold text-slate-900">{c.cama}</span>{' '}
                      <span className={c.estado === 'sucia' ? 'text-amber-700' : 'text-yellow-700'}>
                        {c.estado === 'sucia' ? 'Sucia' : 'En limpieza'}
                      </span>
                      <span className="text-slate-500"> desde {fechaHora(c.estado_desde)}</span>
                    </span>
                    {esEnfermeria && (
                      <FormAccion
                        accion={cambiarEstadoCama.bind(null, c.cama, c.estado === 'sucia' ? 'limpieza' : 'disponible')}
                        boton={c.estado === 'sucia' ? 'Iniciar limpieza' : 'Cama lista'}
                        variante="secundario"
                        className="flex items-center gap-2"
                      />
                    )}
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
