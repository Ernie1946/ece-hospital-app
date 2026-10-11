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
import { COLUMNAS_RESULTADO, ROLES_RESULTADOS, TIPO_RESULTADO, puedeSubir, tamano, tiposDeRol, type Resultado } from '@/lib/resultados'
import { anularResultado, crearEntrega, revocarEntrega, subirResultado } from '../../acciones'

type Entrega = {
  id: string
  canal: string
  destino: string | null
  creada_en: string
  expira_en: string
  revocada_en: string | null
  bloqueada: boolean
  creada_por_nombre: string
  estudios: string
  aperturas: number
  ultima_apertura: string | null
}

export default async function ResultadosPacientePage({ params }: PageProps<'/resultados/paciente/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!ROLES_RESULTADOS.includes(perfil.rol)) notFound()
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data: p } = await supabase
    .schema('clinico')
    .from('paciente')
    .select('id, expediente, nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, telefono, correo')
    .eq('id', id)
    .maybeSingle()
  if (!p) notFound()
  const [{ data: res }, { data: ent }, { data: enc }] = await Promise.all([
    supabase.schema('clinico').from('v_resultado').select(COLUMNAS_RESULTADO).eq('paciente_id', id).order('realizado_en', { ascending: false }).order('subido_en', { ascending: false }),
    supabase.schema('clinico').from('v_entrega_resultado').select('*').eq('paciente_id', id).order('creada_en', { ascending: false }),
    supabase.schema('camas').from('v_censo').select('cama, area_nombre, encuentro_id').eq('expediente', p.expediente).maybeSingle(),
  ])
  const resultados = (res ?? []) as Resultado[]
  const entregas = (ent ?? []) as Entrega[]
  const nombre = [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')
  const subir = puedeSubir(perfil.rol)
  const tipos = tiposDeRol(perfil.rol)

  // Órdenes de estudio pendientes del paciente (para ligar el resultado)
  const { data: ords } = subir
    ? await supabase
        .schema('clinico')
        .from('orden')
        .select('id, detalle, solicitada_en')
        .eq('paciente_id', id)
        .eq('tipo', 'estudio')
        .in('estado', ['solicitada', 'validada', 'en_proceso'])
        .order('solicitada_en', { ascending: false })
    : { data: [] }
  const ordenes = (ords ?? []) as { id: string; detalle: { descripcion?: string }; solicitada_en: string | null }[]
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })

  return (
    <>
      <Encabezado perfil={perfil} activo="resultados" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/resultados" className="text-sm text-sky-700 hover:underline">
            ← Resultados
          </Link>
          <section className={claseTarjeta}>
            <h1 className="text-xl font-semibold text-slate-900">{nombre}</h1>
            <p className="text-sm text-slate-600">
              Exp. {p.expediente} · {p.sexo} · {p.fecha_nacimiento ? `${fecha(p.fecha_nacimiento)} (${edad(p.fecha_nacimiento)} años)` : 'sin fecha de nacimiento'}
              {p.telefono ? ` · Cel. ${p.telefono}` : ''}
              {p.correo ? ` · ${p.correo}` : ''}
            </p>
            <p className="mt-1 text-sm">
              {enc?.encuentro_id ? (
                <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-900">
                  Internado en {enc.cama} · {enc.area_nombre}: los resultados llegan a su expediente
                </span>
              ) : (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">Paciente externo</span>
              )}
            </p>
          </section>

          {subir && (
            <section className={claseTarjeta}>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Subir resultado (PDF)</h2>
              <FormAccion accion={subirResultado.bind(null, id)} boton="Guardar resultado" className="grid gap-3 sm:grid-cols-3">
                <label className={claseEtiqueta}>
                  Tipo
                  <select name="tipo" defaultValue={tipos[0]} className={claseCampo}>
                    {tipos.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_RESULTADO[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${claseEtiqueta} sm:col-span-2`}>
                  Estudio *
                  <input name="estudio" required placeholder="Biometría hemática, Química sanguínea, TAC de cráneo…" className={claseCampo} />
                </label>
                <label className={claseEtiqueta}>
                  Folio en el sistema del {perfil.rol === 'laboratorio' ? 'laboratorio' : 'servicio'}
                  <input name="folio" className={claseCampo} />
                </label>
                <label className={claseEtiqueta}>
                  Fecha del estudio
                  <input name="realizado_en" type="date" defaultValue={hoy} max={hoy} className={claseCampo} />
                </label>
                {ordenes.length > 0 ? (
                  <label className={claseEtiqueta}>
                    Orden del médico
                    <select name="orden" defaultValue="" className={claseCampo}>
                      <option value="">Sin orden del ECE</option>
                      {ordenes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.detalle?.descripcion} ({fechaHora(o.solicitada_en)})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span />
                )}
                <label className={`${claseEtiqueta} sm:col-span-3`}>
                  Archivo PDF * (máx. 5 MB)
                  <input name="archivo" type="file" required accept="application/pdf,.pdf" className="mt-1 block w-full text-sm" />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-red-800">
                  <input type="checkbox" name="critico" /> Tiene valores críticos
                </label>
                <label className={`${claseEtiqueta} sm:col-span-2`}>
                  Nota del valor crítico
                  <input name="nota_critica" placeholder="K 6.8 mmol/L; se avisó a Dr(a). … a las …" className={claseCampo} />
                </label>
              </FormAccion>
            </section>
          )}

          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Resultados ({resultados.length})</h2>
            {resultados.length === 0 ? (
              <p className="text-sm text-slate-500">Sin resultados.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {resultados.map((r) => (
                  <li key={r.id} className={`py-2 ${r.anulado ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span>
                        <a href={`/resultados/archivo/${r.id}`} target="_blank" rel="noopener" className={`font-medium text-sky-700 hover:underline ${r.anulado ? 'line-through' : ''}`}>
                          {r.estudio} ↗
                        </a>
                        <span className="text-slate-500">
                          {' '}
                          · {TIPO_RESULTADO[r.tipo]} · {fecha(r.realizado_en)}
                          {r.folio_externo ? ` · folio ${r.folio_externo}` : ''} · {tamano(r.archivo_tamano)}
                        </span>
                        {r.critico && <span className="ml-1 rounded bg-red-100 px-1 text-xs font-semibold text-red-800">CRÍTICO</span>}
                      </span>
                      <span className="text-xs text-slate-500">
                        Subió {r.subido_por_nombre} · {fechaHora(r.subido_en)}
                        {r.visto_en && ` · visto por ${r.visto_por_nombre}`}
                      </span>
                    </div>
                    {r.critico && <p className="text-xs text-red-800">{r.nota_critica}</p>}
                    {r.anulado && <p className="text-xs text-slate-600">Anulado: {r.motivo_anulacion}</p>}
                    {subir && !r.anulado && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-red-700">Anular (archivo equivocado)</summary>
                        <FormAccion accion={anularResultado.bind(null, r.id, id)} boton="Anular resultado" variante="secundario" className="mt-1 flex flex-wrap items-end gap-2">
                          <label className={`${claseEtiqueta} flex-1`}>
                            Motivo
                            <input name="motivo" required className={claseCampo} />
                          </label>
                        </FormAccion>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={claseTarjeta}>
            <h2 className="mb-1 text-sm font-semibold text-slate-800">Enviar resultados al paciente</h2>
            <p className="mb-3 text-xs text-slate-500">
              Se manda un enlace seguro (no el PDF): el paciente lo abre con su fecha de nacimiento, vence, y queda registrado cada acceso.
            </p>
            {p.fecha_nacimiento ? (
              <EntregaResultados
                key={resultados.map((r) => r.id + r.anulado).join()}
                paciente={nombre}
                telefono={p.telefono}
                correo={p.correo}
                resultados={resultados
                  .filter((r) => !r.anulado)
                  .map((r) => ({ id: r.id, estudio: r.estudio, fecha: fecha(r.realizado_en), entregado: !!r.entregado_en }))}
                crear={crearEntrega.bind(null, id)}
              />
            ) : (
              <p className="text-sm text-amber-800">Falta la fecha de nacimiento del paciente (en Admisión); con ella abre sus resultados.</p>
            )}

            {entregas.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Envíos</h3>
                <ul className="space-y-1 text-sm">
                  {entregas.map((e) => {
                    const vigente = !e.revocada_en && !e.bloqueada && new Date(e.expira_en) > new Date()
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {fechaHora(e.creada_en)} · {e.canal === 'whatsapp' ? 'WhatsApp' : e.canal === 'correo' ? 'Correo' : 'Enlace'} {e.destino} · {e.estudios}
                          <span className="text-slate-500">
                            {' '}
                            · {e.aperturas ? `abierto ${e.aperturas} vez(ces), última ${fechaHora(e.ultima_apertura)}` : 'no abierto aún'}
                          </span>
                          <span className={`ml-1 rounded px-1 text-xs ${vigente ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                            {e.revocada_en ? 'Cancelado' : e.bloqueada ? 'Bloqueado' : vigente ? `Vence ${fecha(e.expira_en)}` : 'Vencido'}
                          </span>
                        </span>
                        {vigente && (
                          <BotonAccion
                            etiqueta="Cancelar enlace"
                            variante="secundario"
                            confirmar="¿Cancelar este enlace? El paciente ya no podrá abrirlo."
                            alHacer={revocarEntrega.bind(null, e.id, id)}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
