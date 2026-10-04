import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { FormNotaMedica } from '@/components/FormNotaMedica'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { ahora, edad, fechaHora, nombreCompleto } from '@/lib/formato'
import { PRIORIDADES, TIPO_DIAGNOSTICO, TIPO_ORDEN, TIPOS_NOTA, TITULOS_CAMPOS, esMedico, estadoOrden } from '@/lib/medica'
import { buscarCie10, buscarMedicamentos, cofirmarNota, registrarNotaMedica, suspenderOrden } from '../../acciones'
import { solicitarAccesoEmergencia } from '../../../enfermeria/acciones'

// ---------------------------------------------------------------------
// Expediente médico del encuentro: nota nueva (con dictado, CIE-10 y
// órdenes), diagnósticos, órdenes vigentes y notas firmadas.
// ---------------------------------------------------------------------

type Firma = { tipo: 'autor' | 'cofirma'; nombre_firmante: string; cedula: string; hash_sha256: string; firmado_en: string }
type Orden = {
  id: string
  documento_id: string
  tipo: string
  estado: string
  prioridad: string
  detalle: { descripcion?: string; indicaciones?: string }
  motivo_rechazo: string | null
  motivo_suspension: string | null
  creado_en: string
}
type Nota = {
  id: string
  tipo: string
  estado: string
  contenido: Record<string, string>
  creado_en: string
  firma: Firma[]
}
type Dx = { id: string; cie10: string; tipo: string; registrado_en: string }

const NOMBRE_NOTA: Record<string, string> = {
  nota_urgencias: 'Nota de urgencias',
  nota_preoperatoria: 'Nota preoperatoria',
  nota_postoperatoria: 'Nota postoperatoria',
  nota_preanestesica: 'Nota preanestésica',
  nota_traslado: 'Nota de traslado',
  nota_preegreso: 'Nota de preegreso',
  nota_egreso: 'Nota de egreso',
  historia_clinica: 'Historia clínica',
  nota_correccion: 'Nota de corrección',
  ...Object.fromEntries(Object.entries(TIPOS_NOTA).map(([k, v]) => [k, v.nombre])),
}
const TIPOS_NOTA_MEDICA = Object.keys(NOMBRE_NOTA)

export default async function ExpedienteMedicoPage({ params }: PageProps<'/medicos/encuentro/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: encuentro } = await supabase
    .schema('clinico')
    .from('encuentro')
    .select('id, folio, paciente_id, estado, medico_tratante_id, diagnostico_presuntivo, aislamiento, inicio')
    .eq('id', id)
    .maybeSingle()
  if (!encuentro) notFound()

  const hace24h = new Date(ahora() - 24 * 3600 * 1000).toISOString()
  const [paciente, alergias, cama, medico, acceso, notas, ordenes, diagnosticos, signos] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento, sexo, tipo_sangre').eq('id', encuentro.paciente_id).single(),
    supabase.schema('clinico').from('paciente_alergia').select('sustancia, severidad').eq('paciente_id', encuentro.paciente_id).eq('activa', true),
    supabase.schema('camas').from('v_censo').select('cama, servicio_nombre').eq('encuentro_id', id).maybeSingle(),
    supabase.schema('seguridad').from('usuario').select('nombre, primer_apellido').eq('id', encuentro.medico_tratante_id).maybeSingle(),
    supabase.schema('clinico').rpc('puede_ver_encuentro', { p_encuentro: id }),
    supabase
      .schema('clinico')
      .from('documento_clinico')
      .select('id, tipo, estado, contenido, creado_en, firma(tipo, nombre_firmante, cedula, hash_sha256, firmado_en)')
      .eq('encuentro_id', id)
      .in('tipo', TIPOS_NOTA_MEDICA)
      .in('estado', ['firmado', 'pendiente_cofirma'])
      .order('creado_en', { ascending: false }),
    supabase
      .schema('clinico')
      .from('orden')
      .select('id, documento_id, tipo, estado, prioridad, detalle, motivo_rechazo, motivo_suspension, creado_en')
      .eq('encuentro_id', id)
      .neq('estado', 'borrador')
      .order('creado_en', { ascending: false }),
    supabase
      .schema('clinico')
      .from('diagnostico')
      .select('id, cie10, tipo, registrado_en')
      .eq('encuentro_id', id)
      .order('registrado_en', { ascending: false }),
    supabase
      .schema('clinico')
      .from('signos_vitales')
      .select('tomado_en, ta_sistolica, ta_diastolica, frecuencia_cardiaca, frecuencia_respiratoria, temperatura, spo2, dolor_eva, glucosa_capilar')
      .eq('encuentro_id', id)
      .gte('tomado_en', hace24h)
      .order('tomado_en', { ascending: false })
      .limit(1),
  ])

  const p = paciente.data
  if (!p) notFound()

  const puedeVer = acceso.data === true
  const medicoSesion = esMedico(perfil.rol)
  const vigente = ['activo', 'alta_medica'].includes(encuentro.estado as string)
  const puedeEscribir = medicoSesion && puedeVer && vigente
  const esTratante = perfil.rol === 'medico_tratante'

  const listaNotas = (notas.data ?? []) as Nota[]
  const listaOrdenes = (ordenes.data ?? []) as Orden[]
  const listaDx = (diagnosticos.data ?? []) as Dx[]
  const { data: descripciones } = listaDx.length
    ? await supabase.schema('catalogo').from('cie10').select('codigo, descripcion').in('codigo', Array.from(new Set(listaDx.map((d) => d.cie10))))
    : { data: [] }
  const descripcionDx = new Map((descripciones ?? []).map((c) => [c.codigo as string, c.descripcion as string]))
  const ultimo = signos.data?.[0]
  const vigentes = listaOrdenes.filter((o) => ['solicitada', 'validada', 'en_proceso'].includes(o.estado))
  const ordenesDe = new Map<string, Orden[]>()
  for (const o of listaOrdenes) ordenesDe.set(o.documento_id, [...(ordenesDe.get(o.documento_id) ?? []), o])

  return (
    <>
      <Encabezado perfil={perfil} activo="medicos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link href="/medicos" className="text-sky-700 hover:underline">
              ← Tablero médico
            </Link>
            <span className="flex gap-4">
              {medicoSesion && vigente && (
                <Link href={`/anestesia?encuentro=${id}#programar`} className="text-sky-700 hover:underline">
                  Programar cirugía
                </Link>
              )}
              <Link href={`/enfermeria/encuentro/${id}`} className="text-sky-700 hover:underline">
                Hoja de enfermería →
              </Link>
            </span>
          </div>

          {/* Identificación */}
          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{nombreCompleto(p)}</h1>
              <span className="text-sm text-slate-600">
                <strong>{cama.data?.cama ?? 'Sin cama'}</strong> · {cama.data?.servicio_nombre} · Folio {encuentro.folio as string}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Exp. {p.expediente} · {p.sexo} · {p.fecha_nacimiento ? `${edad(p.fecha_nacimiento)} años` : 'edad desconocida'}
              {p.tipo_sangre ? ` · ${p.tipo_sangre}` : ''} · Ingreso {fechaHora(encuentro.inicio as string | null)}
              {medico.data && ` · Tratante: Dr(a). ${medico.data.nombre} ${medico.data.primer_apellido}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(alergias.data ?? []).map((a) => (
                <span key={a.sustancia as string} className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">
                  Alergia: {a.sustancia as string}
                  {a.severidad ? ` (${a.severidad})` : ''}
                </span>
              ))}
              {(alergias.data ?? []).length === 0 && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">Sin alergias registradas</span>}
            </div>
          </section>

          {!puedeVer && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                Este paciente no es tuyo ni de tu servicio. Solo ves su identificación; el expediente está protegido.
              </p>
              {medicoSesion && (
                <FormAccion
                  accion={solicitarAccesoEmergencia.bind(null, encuentro.paciente_id as string, id)}
                  boton="Solicitar acceso de emergencia"
                  variante="secundario"
                  className="flex flex-wrap items-end gap-2"
                >
                  <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                    Motivo (queda registrado en la bitácora)
                    <input name="motivo" required minLength={10} className={claseCampo} />
                  </label>
                </FormAccion>
              )}
            </section>
          )}

          {puedeVer && (
            <div className="grid lg:grid-cols-5 gap-4 items-start">
              {/* Columna principal: nota nueva */}
              <div className="lg:col-span-3 space-y-4">
                {puedeEscribir ? (
                  <section className={claseTarjeta}>
                    <h2 className="text-sm font-semibold text-slate-800 mb-2">Nueva nota</h2>
                    <FormNotaMedica
                      accion={registrarNotaMedica.bind(null, id)}
                      buscarCie10={buscarCie10}
                      buscarMedicamentos={buscarMedicamentos}
                      tipoInicial={listaNotas.some((n) => n.tipo === 'nota_ingreso') ? 'nota_evolucion' : 'nota_ingreso'}
                      esResidente={perfil.rol === 'medico_residente'}
                    />
                  </section>
                ) : (
                  <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
                    {vigente ? 'Vista de consulta: las notas las escribe el personal médico.' : 'Este ingreso ya no está activo; el expediente queda en modo consulta.'}
                  </p>
                )}

                {/* Notas */}
                <section className={claseTarjeta}>
                  <h2 className="text-sm font-semibold text-slate-800">Notas médicas ({listaNotas.length})</h2>
                  {listaNotas.length === 0 && <p className="mt-2 text-sm text-slate-500">Sin notas médicas.</p>}
                  <div className="mt-2 space-y-3">
                    {listaNotas.map((n) => {
                      const autor = n.firma.find((f) => f.tipo === 'autor')
                      const cofirma = n.firma.find((f) => f.tipo === 'cofirma')
                      const ords = ordenesDe.get(n.id) ?? []
                      return (
                        <article key={n.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {NOMBRE_NOTA[n.tipo] ?? n.tipo} · {fechaHora(autor?.firmado_en ?? n.creado_en)}
                          </p>
                          <dl className="mt-1 space-y-1">
                            {Object.entries(TITULOS_CAMPOS)
                              .filter(([k]) => n.contenido[k])
                              .map(([k, titulo]) => (
                                <div key={k}>
                                  <dt className="inline font-medium text-slate-700">{titulo}: </dt>
                                  <dd className="inline whitespace-pre-line text-slate-900">{n.contenido[k]}</dd>
                                </div>
                              ))}
                          </dl>
                          {ords.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-slate-700">Órdenes:</p>
                              <ol className="ml-5 list-decimal">
                                {ords.map((o) => (
                                  <li key={o.id}>
                                    {TIPO_ORDEN[o.tipo]}: {o.detalle?.descripcion}
                                    {o.detalle?.indicaciones ? ` (${o.detalle.indicaciones})` : ''}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                          {autor && (
                            <p className="mt-2 text-xs text-emerald-800">
                              ✓ Firmada por {autor.nombre_firmante} · Céd. {autor.cedula} ·{' '}
                              <span className="font-mono" title={autor.hash_sha256}>SHA-256 {autor.hash_sha256.slice(0, 12)}…</span>
                            </p>
                          )}
                          {cofirma && (
                            <p className="text-xs text-emerald-800">
                              ✓ Cofirmada por {cofirma.nombre_firmante} · Céd. {cofirma.cedula} · {fechaHora(cofirma.firmado_en)}
                            </p>
                          )}
                          {n.estado === 'pendiente_cofirma' && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Pendiente de cofirma</span>
                              {esTratante && vigente && (
                                <FormAccion accion={cofirmarNota.bind(null, n.id, id)} boton="Cofirmar" variante="secundario" className="flex items-center gap-2" />
                              )}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              </div>

              {/* Columna lateral */}
              <div className="lg:col-span-2 space-y-4">
                <section className={claseTarjeta}>
                  <h2 className="text-sm font-semibold text-slate-800">Últimos signos vitales</h2>
                  {ultimo ? (
                    <p className="mt-1 text-sm text-slate-800">
                      TA {ultimo.ta_sistolica ?? '—'}/{ultimo.ta_diastolica ?? '—'} · FC {ultimo.frecuencia_cardiaca ?? '—'} · FR{' '}
                      {ultimo.frecuencia_respiratoria ?? '—'} · T {ultimo.temperatura ?? '—'} °C · SpO₂ {ultimo.spo2 ?? '—'} %
                      {ultimo.dolor_eva !== null && ` · EVA ${ultimo.dolor_eva}`}
                      <span className="block text-xs text-slate-500">{fechaHora(ultimo.tomado_en as string)}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">Sin signos en 24 h.</p>
                  )}
                </section>

                <section className={claseTarjeta}>
                  <h2 className="text-sm font-semibold text-slate-800">Diagnósticos</h2>
                  {listaDx.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-500">{(encuentro.diagnostico_presuntivo as string) ?? 'Sin diagnósticos codificados.'}</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {listaDx.map((d) => (
                        <li key={d.id}>
                          <span className="font-mono font-semibold">{d.cie10}</span> {descripcionDx.get(d.cie10)}{' '}
                          <span className="text-xs text-slate-500">· {TIPO_DIAGNOSTICO[d.tipo] ?? d.tipo}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={claseTarjeta}>
                  <h2 className="text-sm font-semibold text-slate-800">Órdenes vigentes ({vigentes.length})</h2>
                  {vigentes.length === 0 && <p className="mt-1 text-sm text-slate-500">Sin órdenes vigentes.</p>}
                  <ul className="mt-1 divide-y divide-slate-100 text-sm">
                    {vigentes.map((o) => {
                      const e = estadoOrden(o.tipo, o.estado)
                      return (
                        <li key={o.id} className="py-2">
                          <p>
                            <span className={`mr-1 rounded px-1 text-xs ${e.color}`}>{e.texto}</span>
                            {o.prioridad !== 'rutina' && <span className="mr-1 rounded bg-red-100 px-1 text-xs text-red-800">{PRIORIDADES[o.prioridad]}</span>}
                            <span className="text-slate-500">{TIPO_ORDEN[o.tipo]}:</span> {o.detalle?.descripcion}
                          </p>
                          {puedeEscribir && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-red-700">Suspender</summary>
                              <FormAccion
                                accion={suspenderOrden.bind(null, o.id, id)}
                                boton="Suspender orden"
                                variante="secundario"
                                className="mt-1 flex flex-wrap items-end gap-2"
                              >
                                <label className={`${claseEtiqueta} flex-1`}>
                                  Motivo
                                  <input name="motivo" required className={claseCampo} />
                                </label>
                              </FormAccion>
                            </details>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {listaOrdenes.some((o) => o.estado === 'rechazada') && (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <p className="text-xs font-semibold text-red-800">Devueltas por enfermería</p>
                      <ul className="text-sm">
                        {listaOrdenes
                          .filter((o) => o.estado === 'rechazada')
                          .map((o) => (
                            <li key={o.id} className="text-slate-700">
                              {o.detalle?.descripcion} — <span className="text-red-800">“{o.motivo_rechazo}”</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
