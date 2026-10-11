import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { BotonAccion } from '@/components/BotonAccion'
import { EntregaResultados } from '@/components/EntregaResultados'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha, fechaHora } from '@/lib/formato'
import { fechaLarga } from '@/lib/turnos'
import { COLUMNAS_RESULTADO, tamano, type Resultado } from '@/lib/resultados'
import { ESTADO_CITA, hora, type Cita } from '@/lib/gabinetes'
import { anularInforme, cancelarCita, enviarInforme, marcarRealizada, subirInforme } from '../../acciones'

// Cita de gabinete: indicaciones, realizar, subir el informe (PDF del equipo) y enviarlo al paciente
export default async function CitaGabinetePage({ params }: PageProps<'/gabinetes/cita/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data } = await supabase.schema('clinico').from('v_gab_cita').select('*').eq('id', id).maybeSingle()
  const c = data as Cita | null
  if (!c) notFound()
  const staff = perfil.gabinete === c.area_id
  const admision = perfil.rol === 'admision'
  const [{ data: pac }, { data: res }] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('sexo, fecha_nacimiento').eq('id', c.paciente_id).maybeSingle(),
    staff
      ? supabase
          .schema('clinico')
          .from('v_resultado')
          .select(COLUMNAS_RESULTADO)
          .eq('paciente_id', c.paciente_id)
          .eq('tipo', 'gabinete')
          .order('subido_en', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
  const informes = (res ?? []) as Resultado[]
  const informe = informes.find((r) => r.id === c.resultado_id) ?? null
  const dia = new Date(c.inicio).toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })
  const estado = ESTADO_CITA[c.estado]

  return (
    <>
      <Encabezado perfil={perfil} activo="gabinetes" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <Link href={`/gabinetes?${new URLSearchParams({ g: c.gabinete, fecha: dia })}`} className="text-sm text-sky-700 hover:underline">
            ← {c.gabinete_nombre}
          </Link>

          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{c.estudio}</h1>
              <span className={`rounded px-2 py-0.5 text-sm ${estado?.color}`}>{c.resultado_id ? 'Informe listo' : estado?.texto}</span>
            </div>
            <p className="text-sm text-slate-700">
              <strong>{c.paciente}</strong> · Exp. {c.expediente}
              {pac?.sexo ? ` · ${pac.sexo}` : ''}
              {pac?.fecha_nacimiento ? ` · ${fecha(pac.fecha_nacimiento)} (${edad(pac.fecha_nacimiento)} años)` : ''}
              {c.telefono ? ` · Cel. ${c.telefono}` : ''}
            </p>
            <p className="text-sm text-slate-700">
              {fechaLarga(dia)} · {hora(c.inicio)}–{hora(c.fin)} · {c.equipo_nombre}
            </p>
            <p className="text-sm text-slate-600">
              {c.solicitante ? `Solicita: ${c.solicitante}` : 'Sin médico solicitante registrado'}
              {c.orden_id ? ' · ligado a la orden del ECE' : ''}
              {c.encuentro_id ? ' · paciente internado' : ' · paciente externo'}
            </p>
            {c.notas && <p className="text-sm text-slate-600">Notas: {c.notas}</p>}
            {c.indicaciones && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <strong>Indicaciones para el paciente:</strong> {c.indicaciones}
              </p>
            )}
            {c.motivo_cancelacion && <p className="mt-2 text-sm text-slate-700">Motivo: {c.motivo_cancelacion}</p>}
            {c.realizado_en && (
              <p className="mt-1 text-xs text-slate-500">
                Realizó {c.realizado_por_nombre} · {fechaHora(c.realizado_en)}
              </p>
            )}
          </section>

          {c.estado === 'programada' && (staff || admision) && (
            <section className={`${claseTarjeta} space-y-3`}>
              {staff && <BotonAccion etiqueta="Marcar como realizado" alHacer={marcarRealizada.bind(null, c.id)} />}
              <details>
                <summary className="cursor-pointer text-sm text-red-700">Cancelar la cita o registrar que no asistió</summary>
                <FormAccion accion={cancelarCita.bind(null, c.id)} boton="Guardar" variante="secundario" className="mt-2 flex flex-wrap items-end gap-3">
                  <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                    Motivo *
                    <input name="motivo" required className={claseCampo} />
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" name="no_asistio" value="si" /> El paciente no asistió
                  </label>
                </FormAccion>
              </details>
            </section>
          )}

          {staff && !c.resultado_id && ['programada', 'realizada'].includes(c.estado) && (
            <section className={claseTarjeta}>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Subir el informe (PDF)</h2>
              <p className="mb-3 text-xs text-slate-500">
                Exporta o imprime a PDF el informe desde el equipo y súbelo aquí: queda en el expediente del paciente y se le puede enviar.
              </p>
              <FormAccion accion={subirInforme.bind(null, c.id, c.paciente_id)} boton="Guardar informe" className="grid gap-3 sm:grid-cols-3">
                <label className={`${claseEtiqueta} sm:col-span-3`}>
                  Archivo PDF * (máx. 5 MB)
                  <input name="archivo" type="file" required accept="application/pdf,.pdf" className="mt-1 block w-full text-sm" />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-red-800">
                  <input type="checkbox" name="critico" /> Hallazgo crítico
                </label>
                <label className={`${claseEtiqueta} sm:col-span-2`}>
                  Nota del hallazgo crítico
                  <input name="nota_critica" placeholder="Qué se encontró y a quién se avisó (hora)" className={claseCampo} />
                </label>
              </FormAccion>
            </section>
          )}

          {c.resultado_id && (
            <section className={claseTarjeta}>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Informe</h2>
              <p className="text-sm">
                <a href={`/resultados/archivo/${c.resultado_id}`} target="_blank" rel="noopener" className="font-medium text-sky-700 hover:underline">
                  Ver informe (PDF) ↗
                </a>
                {informe && (
                  <span className="text-slate-500">
                    {' '}
                    · {informe.archivo_nombre} · {tamano(informe.archivo_tamano)} · subió {informe.subido_por_nombre} {fechaHora(informe.subido_en)}
                  </span>
                )}
                {informe?.critico && <span className="ml-1 rounded bg-red-100 px-1 text-xs font-semibold text-red-800">CRÍTICO</span>}
              </p>
              {informe?.critico && <p className="text-xs text-red-800">{informe.nota_critica}</p>}
              {informe?.entregado_en && <p className="mt-1 text-xs text-emerald-800">Enviado al paciente {fechaHora(informe.entregado_en)}</p>}
              {staff && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-700">Anular (archivo equivocado)</summary>
                  <FormAccion accion={anularInforme.bind(null, c.resultado_id)} boton="Anular informe" variante="secundario" className="mt-1 flex flex-wrap items-end gap-2">
                    <label className={`${claseEtiqueta} flex-1`}>
                      Motivo
                      <input name="motivo" required className={claseCampo} />
                    </label>
                  </FormAccion>
                </details>
              )}
            </section>
          )}

          {staff && informes.some((r) => !r.anulado) && (
            <section className={claseTarjeta}>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Enviar informe al paciente</h2>
              <p className="mb-3 text-xs text-slate-500">
                Se manda un enlace seguro (no el PDF) por WhatsApp o correo: el paciente lo abre con su fecha de nacimiento y el enlace vence. Si prefieren
                papel, imprime el informe desde el equipo como siempre.
              </p>
              {pac?.fecha_nacimiento ? (
                <EntregaResultados
                  key={informes.map((r) => r.id + r.anulado).join()}
                  paciente={c.paciente}
                  telefono={c.telefono}
                  correo={c.correo}
                  resultados={informes
                    .filter((r) => !r.anulado)
                    .map((r) => ({ id: r.id, estudio: r.estudio, fecha: fecha(r.realizado_en), entregado: r.id !== c.resultado_id || !!r.entregado_en }))}
                  crear={enviarInforme.bind(null, c.paciente_id)}
                />
              ) : (
                <p className="text-sm text-amber-800">Falta la fecha de nacimiento del paciente (en Admisión); con ella abre su informe.</p>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  )
}
