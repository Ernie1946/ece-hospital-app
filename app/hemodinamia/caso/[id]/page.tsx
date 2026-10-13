import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { BotonAccion } from '@/components/BotonAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha, fechaHora } from '@/lib/formato'
import { fechaLarga } from '@/lib/turnos'
import { hora } from '@/lib/gabinetes'
import {
  ACCESOS,
  CIERRE,
  COMPLICACIONES,
  DESTINOS,
  ESTADO_CASO,
  EVENTO,
  FLUORO_ALERTA,
  IMPLANTES,
  KERMA_SEGUIMIENTO,
  PAPEL,
  PAPELES_DE,
  PULSO,
  SEDACION,
  SITIO,
  TIPO_MATERIAL,
  VERIFICACION,
  nombreProc,
  siguienteControl,
  type Caso,
  type Material,
  type Participante,
  type Vigilancia,
} from '@/lib/hemodinamia'
import {
  agregarMaterial,
  agregarParticipante,
  altaRecuperacion,
  anularMaterial,
  cancelarCaso,
  entrarSala,
  firmarInforme,
  guardarDatos,
  guardarRadiacion,
  guardarVerificacion,
  marcarTiempo,
  quitarParticipante,
  registrarVigilancia,
  salirSala,
} from '../../acciones'

const Dato = ({ t, v }: { t: string; v: React.ReactNode }) => (
  <p className="text-sm">
    <span className="text-slate-500">{t}: </span>
    <span className="text-slate-900">{v || '—'}</span>
  </p>
)

// Caso de hemodinamia: verificación, sala, hoja del procedimiento, materiales, recuperación y firma
export default async function CasoHemoPage({ params }: PageProps<'/hemodinamia/caso/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data } = await supabase.schema('clinico').from('v_hemo_caso').select('*').eq('id', id).maybeSingle()
  const c = data as Caso | null
  if (!c) notFound()
  const rol = perfil.hemo
  const [{ data: part }, { data: mat }, { data: vig }, { data: per }] = await Promise.all([
    supabase.schema('clinico').from('v_hemo_participante').select('*').eq('caso_id', id),
    supabase.schema('clinico').from('hemo_material').select('*').eq('caso_id', id).order('registrado_en'),
    supabase.schema('clinico').from('v_hemo_vigilancia').select('*').eq('caso_id', id).order('hora'),
    rol ? supabase.schema('clinico').rpc('hemo_personal') : Promise.resolve({ data: [] }),
  ])
  const equipo = (part ?? []) as Participante[]
  const materiales = (mat ?? []) as Material[]
  const vigilancia = (vig ?? []) as Vigilancia[]
  const personal = (per ?? []) as { id: string; nombre: string; papel: string }[]

  const firmado = !!c.firmado_en
  const medico = rol === 'medico'
  const sala = rol === 'medico' || rol === 'enfermeria'
  const deSala = sala || rol === 'tecnico'
  const enProceso = ['en_sala', 'recuperacion'].includes(c.estado) && !firmado
  const enfermeraPiso = perfil.rol === 'enfermeria' // la que tiene al paciente (la base revisa que lo pueda ver)
  const puedeVigilar = c.estado === 'recuperacion' && (sala || enfermeraPiso)
  const d = c.datos ?? {}
  const contrasteExcedido = c.contraste_max_ml !== null && c.contraste_ml !== null && c.contraste_ml > c.contraste_max_ml
  const dia = new Date(c.inicio).toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })
  const ultimoControl = [...vigilancia].reverse().find((v) => v.evento === 'control')
  const proximo = c.estado === 'recuperacion' ? siguienteControl(c.salida_sala_en, ultimoControl?.hora ?? null) : null
  const retirado = d.introductor_retirado_en_sala || vigilancia.some((v) => v.evento === 'retiro_introductor')
  const opcionesEquipo =
    rol === 'anestesia'
      ? personal.filter((x) => x.id === perfil.id).map((x) => ({ valor: `${x.id}|anestesiologo`, texto: `${x.nombre} · Anestesiólogo` }))
      : personal.flatMap((x) => (PAPELES_DE[x.papel] ?? []).map((pa) => ({ valor: `${x.id}|${pa}`, texto: `${x.nombre} · ${PAPEL[pa]}` })))

  return (
    <>
      <Encabezado perfil={perfil} activo={rol ? 'hemodinamia' : perfil.rol === 'enfermeria' ? 'enfermeria' : 'medicos'} />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {rol ? (
              <Link href={`/hemodinamia?fecha=${dia}`} className="text-sm text-sky-700 hover:underline">
                ← Hemodinamia
              </Link>
            ) : (
              <span />
            )}
            <Link href={`/hemodinamia/caso/${c.id}/imprimir`} target="_blank" className="text-sm font-medium text-sky-700 hover:underline">
              Imprimir hoja ↗
            </Link>
          </div>

          {/* Encabezado del caso */}
          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{nombreProc(c)}</h1>
              <span className="flex gap-2">
                {c.prioridad === 'urgente' && <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-900">URGENTE</span>}
                <span className={`rounded px-2 py-0.5 text-sm ${ESTADO_CASO[c.estado]?.color}`}>{ESTADO_CASO[c.estado]?.texto}</span>
                {firmado && <span className="rounded bg-emerald-600 px-2 py-0.5 text-sm text-white">Informe firmado</span>}
              </span>
            </div>
            <p className="text-sm text-slate-700">
              <strong>{c.paciente}</strong> · Exp. {c.expediente} · {c.sexo}
              {c.fecha_nacimiento ? ` · ${fecha(c.fecha_nacimiento)} (${edad(c.fecha_nacimiento)} años)` : ''}
              {c.encuentro_id ? ' · internado' : ' · externo'}
            </p>
            <p className="text-sm text-slate-700">
              {fechaLarga(dia)} · {hora(c.inicio)}–{hora(c.fin)} · Responsable: {c.hemodinamista_nombre ?? 'sin asignar'}
            </p>
            <p className="text-sm text-slate-700">Indicación: {c.indicacion}</p>
            {c.notas && <p className="text-sm text-slate-600">Notas: {c.notas}</p>}
            {c.orden_id && <p className="text-xs text-slate-500">Ligado a la orden del médico en el ECE.</p>}
            {c.alergias && (
              <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${c.alergia_contraste ? 'bg-red-600 font-semibold text-white' : 'bg-red-50 text-red-800'}`}>
                {c.alergia_contraste ? '⚠ ALERGIA A CONTRASTE / YODO O LÁTEX · ' : 'Alergias: '}
                {c.alergias}
              </p>
            )}
            {c.requiere_anestesia && <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">Requiere anestesiólogo.</p>}
            {c.motivo_cancelacion && <p className="mt-2 text-sm text-slate-700">Cancelado: {c.motivo_cancelacion}</p>}
          </section>

          {/* Verificación previa */}
          <section className={claseTarjeta} aria-label="Verificación previa">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Verificación previa</h2>
            {c.estado === 'programado' && sala ? (
              <FormAccion accion={guardarVerificacion.bind(null, c.id)} boton="Guardar verificación" variante="secundario" className="space-y-2">
                <div className="grid gap-1 sm:grid-cols-2">
                  {VERIFICACION.map((v) => (
                    <label key={v.clave} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name={v.clave} defaultChecked={!!c.verificacion?.[v.clave]} className="mt-1" />
                      <span>
                        {v.texto}
                        {v.obligatorio ? ' *' : ''}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className={claseEtiqueta}>
                    Peso (kg)
                    <input name="peso_kg" inputMode="decimal" defaultValue={c.peso_kg ?? ''} className={claseCampo} />
                  </label>
                  <label className={claseEtiqueta}>
                    Creatinina (mg/dL)
                    <input name="creatinina" inputMode="decimal" defaultValue={c.creatinina ?? ''} className={claseCampo} />
                  </label>
                  <label className={claseEtiqueta}>
                    Anticoagulación actual (fármacos)
                    <input name="anticoagulantes" defaultValue={(c.verificacion?.anticoagulantes as string) ?? ''} placeholder="AAS, clopidogrel, enoxaparina…" className={claseCampo} />
                  </label>
                </div>
              </FormAccion>
            ) : (
              <ul className="grid gap-x-4 text-sm sm:grid-cols-2">
                {VERIFICACION.map((v) => (
                  <li key={v.clave}>
                    {c.verificacion?.[v.clave] ? '✓' : '✗'} {v.texto}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-slate-700">
              Peso {c.peso_kg ?? '—'} kg · Creatinina {c.creatinina ?? '—'} mg/dL
              {c.contraste_max_ml !== null && (
                <>
                  {' '}
                  · <strong>Dosis máxima de contraste: {c.contraste_max_ml} mL</strong> <span className="text-xs text-slate-500">(5 mL × kg ÷ creatinina, tope 300)</span>
                </>
              )}
              {c.verificacion?.anticoagulantes ? ` · Anticoagulación: ${c.verificacion.anticoagulantes}` : ''}
            </p>
            {c.verificado_en && <p className="text-xs text-slate-500">Verificado {fechaHora(c.verificado_en)}</p>}
            {c.estado === 'programado' && sala && (
              <div className="mt-3 flex flex-wrap items-start gap-4 border-t border-slate-100 pt-3">
                <BotonAccion etiqueta="Ingresar a sala" alHacer={entrarSala.bind(null, c.id)} />
                <details>
                  <summary className="cursor-pointer text-sm text-red-700">Cancelar procedimiento</summary>
                  <FormAccion accion={cancelarCaso.bind(null, c.id)} boton="Cancelar procedimiento" variante="secundario" className="mt-2 flex flex-wrap items-end gap-2">
                    <label className={`${claseEtiqueta} min-w-64`}>
                      Motivo *
                      <input name="motivo" required className={claseCampo} />
                    </label>
                  </FormAccion>
                </details>
              </div>
            )}
          </section>

          {c.estado !== 'cancelado' && (
            <>
              {/* Equipo y tiempos */}
              <div className="grid gap-4 md:grid-cols-2">
                <section className={claseTarjeta} aria-label="Equipo">
                  <h2 className="mb-2 text-sm font-semibold text-slate-800">Equipo</h2>
                  {equipo.length === 0 ? (
                    <p className="text-sm text-slate-500">Aún sin equipo.</p>
                  ) : (
                    <ul className="text-sm">
                      {equipo.map((e) => (
                        <li key={e.usuario_id + e.papel} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="text-slate-500">{PAPEL[e.papel]}:</span> {e.nombre}
                          </span>
                          {sala && !firmado && c.estado !== 'terminado' && (
                            <BotonAccion etiqueta="Quitar" variante="secundario" alHacer={quitarParticipante.bind(null, c.id, e.usuario_id, e.papel)} />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {rol && rol !== 'consulta' && !firmado && c.estado !== 'terminado' && opcionesEquipo.length > 0 && (
                    <FormAccion accion={agregarParticipante.bind(null, c.id)} boton="Agregar" variante="secundario" className="mt-2 flex flex-wrap items-end gap-2">
                      <label className={`${claseEtiqueta} flex-1 min-w-56`}>
                        Persona y papel
                        <select name="persona" required defaultValue="" className={claseCampo}>
                          <option value="">Elige…</option>
                          {opcionesEquipo.map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.texto}
                            </option>
                          ))}
                        </select>
                      </label>
                    </FormAccion>
                  )}
                </section>

                <section className={claseTarjeta} aria-label="Tiempos">
                  <h2 className="mb-2 text-sm font-semibold text-slate-800">Tiempos</h2>
                  <Dato t="Entrada a sala" v={fechaHora(c.en_sala_en)} />
                  <Dato t="Inicio del procedimiento" v={fechaHora(c.inicio_proc_en)} />
                  <Dato t="Fin del procedimiento" v={fechaHora(c.fin_proc_en)} />
                  <Dato t="Salida de sala" v={fechaHora(c.salida_sala_en)} />
                  {c.estado === 'en_sala' && deSala && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!c.inicio_proc_en && <BotonAccion etiqueta="Inicia procedimiento" alHacer={marcarTiempo.bind(null, c.id, 'inicio')} />}
                      {c.inicio_proc_en && !c.fin_proc_en && <BotonAccion etiqueta="Termina procedimiento" alHacer={marcarTiempo.bind(null, c.id, 'fin')} />}
                    </div>
                  )}
                </section>
              </div>

              {c.estado !== 'programado' && (
                <>
                  {/* Hoja del procedimiento */}
                  <section className={claseTarjeta} aria-label="Hoja del procedimiento">
                    <h2 className="mb-2 text-sm font-semibold text-slate-800">Hoja del procedimiento</h2>
                    {medico && enProceso ? (
                      <FormAccion accion={guardarDatos.bind(null, c.id)} boton="Guardar hoja" className="grid gap-3 sm:grid-cols-4">
                        <label className={claseEtiqueta}>
                          Acceso *
                          <select name="acceso" defaultValue={d.acceso ?? ''} className={claseCampo}>
                            <option value="">Elige…</option>
                            {Object.entries(ACCESOS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={claseEtiqueta}>
                          Introductor (Fr)
                          <input name="introductor_fr" inputMode="decimal" defaultValue={d.introductor_fr ?? ''} className={claseCampo} />
                        </label>
                        <label className={claseEtiqueta}>
                          Sedación / anestesia
                          <select name="sedacion" defaultValue={d.sedacion ?? ''} className={claseCampo}>
                            <option value="">—</option>
                            {Object.entries(SEDACION).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={claseEtiqueta}>
                          Heparina (UI)
                          <input name="heparina_ui" inputMode="numeric" defaultValue={d.heparina_ui ?? ''} className={claseCampo} />
                        </label>
                        <label className={`${claseEtiqueta} sm:col-span-4`}>
                          Hallazgos *
                          <textarea name="hallazgos" rows={3} defaultValue={d.hallazgos ?? ''} className={claseCampo} />
                        </label>
                        <label className={`${claseEtiqueta} sm:col-span-4`}>
                          Procedimiento realizado *
                          <textarea name="procedimiento_realizado" rows={3} defaultValue={d.procedimiento_realizado ?? ''} className={claseCampo} />
                        </label>
                        <label className={`${claseEtiqueta} sm:col-span-4`}>
                          Resultado
                          <input name="resultado" defaultValue={d.resultado ?? ''} placeholder="Flujo TIMI 3, estenosis residual 0%…" className={claseCampo} />
                        </label>
                        <fieldset className="sm:col-span-4">
                          <legend className={claseEtiqueta}>Complicaciones</legend>
                          <div className="mt-1 grid gap-1 sm:grid-cols-3">
                            {COMPLICACIONES.map((k) => (
                              <label key={k} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name="complicaciones" value={k} defaultChecked={d.complicaciones?.includes(k)} /> {k}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <label className={`${claseEtiqueta} sm:col-span-4`}>
                          Nota de complicaciones
                          <input name="complicaciones_nota" defaultValue={d.complicaciones_nota ?? ''} className={claseCampo} />
                        </label>
                        <label className={`${claseEtiqueta} sm:col-span-2`}>
                          Cierre del acceso
                          <select name="cierre" defaultValue={d.cierre ?? ''} className={claseCampo}>
                            <option value="">—</option>
                            {Object.entries(CIERRE).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <input type="checkbox" name="introductor_retirado_en_sala" defaultChecked={d.introductor_retirado_en_sala} /> Introductor retirado en sala
                        </label>
                        <label className={`${claseEtiqueta} sm:col-span-4`}>
                          Plan e indicaciones posteriores
                          <textarea name="plan" rows={2} defaultValue={d.plan ?? ''} placeholder="Doble antiagregación, reposo, vigilancia del sitio…" className={claseCampo} />
                        </label>
                      </FormAccion>
                    ) : (
                      <div className="grid gap-1 sm:grid-cols-2">
                        <Dato t="Acceso" v={d.acceso ? ACCESOS[d.acceso] : null} />
                        <Dato t="Introductor" v={d.introductor_fr ? `${d.introductor_fr} Fr` : null} />
                        <Dato t="Sedación / anestesia" v={d.sedacion ? SEDACION[d.sedacion] : null} />
                        <Dato t="Heparina" v={d.heparina_ui ? `${d.heparina_ui} UI` : null} />
                        <div className="sm:col-span-2">
                          <Dato t="Hallazgos" v={d.hallazgos} />
                          <Dato t="Procedimiento realizado" v={d.procedimiento_realizado} />
                          <Dato t="Resultado" v={d.resultado} />
                          <Dato t="Complicaciones" v={[...(d.complicaciones ?? []), d.complicaciones_nota].filter(Boolean).join(' · ')} />
                          <Dato t="Cierre del acceso" v={d.cierre ? CIERRE[d.cierre] : null} />
                          <Dato t="Plan" v={d.plan} />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Radiación y contraste */}
                  <section className={claseTarjeta} aria-label="Radiación y contraste">
                    <h2 className="mb-2 text-sm font-semibold text-slate-800">Radiación y contraste</h2>
                    {deSala && enProceso ? (
                      <FormAccion accion={guardarRadiacion.bind(null, c.id)} boton="Guardar radiación y contraste" variante="secundario" className="grid gap-3 sm:grid-cols-5">
                        <label className={claseEtiqueta}>
                          Contraste (tipo)
                          <input name="contraste_tipo" defaultValue={c.contraste_tipo ?? ''} placeholder="Iopamidol 370" className={claseCampo} />
                        </label>
                        <label className={claseEtiqueta}>
                          Contraste (mL) *
                          <input name="contraste_ml" inputMode="decimal" defaultValue={c.contraste_ml ?? ''} className={claseCampo} />
                        </label>
                        <label className={claseEtiqueta}>
                          Fluoroscopia (min) *
                          <input name="fluoro_min" inputMode="decimal" defaultValue={c.fluoro_min ?? ''} className={claseCampo} />
                        </label>
                        <label className={claseEtiqueta}>
                          Kerma aire (mGy)
                          <input name="kerma_mgy" inputMode="decimal" defaultValue={c.kerma_mgy ?? ''} className={claseCampo} />
                        </label>
                        <label className={claseEtiqueta}>
                          DAP (Gy·cm²)
                          <input name="dap" inputMode="decimal" defaultValue={c.dap ?? ''} className={claseCampo} />
                        </label>
                      </FormAccion>
                    ) : (
                      <p className="text-sm">
                        Contraste {c.contraste_ml ?? '—'} mL {c.contraste_tipo ?? ''} · Fluoroscopia {c.fluoro_min ?? '—'} min · Kerma {c.kerma_mgy ?? '—'} mGy · DAP{' '}
                        {c.dap ?? '—'} Gy·cm²
                      </p>
                    )}
                    {contrasteExcedido && (
                      <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                        ⚠ Contraste ({c.contraste_ml} mL) por arriba de la dosis máxima calculada ({c.contraste_max_ml} mL): riesgo de nefropatía por contraste;
                        vigilar creatinina a las 48–72 h e hidratar.
                      </p>
                    )}
                    {(c.kerma_mgy ?? 0) >= KERMA_SEGUIMIENTO && (
                      <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                        ⚠ Dosis de radiación significativa (≥ {KERMA_SEGUIMIENTO / 1000} Gy): informar al paciente y revisar la piel a las 2–4 semanas.
                      </p>
                    )}
                    {(c.fluoro_min ?? 0) >= FLUORO_ALERTA && (c.kerma_mgy ?? 0) < KERMA_SEGUIMIENTO && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Fluoroscopia de {c.fluoro_min} min: registra el kerma para valorar dosis en piel.</p>
                    )}
                  </section>

                  {/* Materiales e implantes */}
                  <section className={claseTarjeta} aria-label="Materiales e implantes">
                    <h2 className="mb-2 text-sm font-semibold text-slate-800">Materiales e implantes</h2>
                    {materiales.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin materiales registrados.</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-slate-500">
                          <tr>
                            <th className="py-1">Tipo</th>
                            <th>Descripción</th>
                            <th>Medida</th>
                            <th>Lote / serie</th>
                            <th>Cant.</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {materiales.map((m) => (
                            <tr key={m.id} className={`border-t border-slate-100 align-top ${m.anulado ? 'text-slate-400 line-through' : ''}`}>
                              <td className="py-1">
                                {TIPO_MATERIAL[m.tipo]}
                                {m.implante && !m.anulado && <span className="ml-1 rounded bg-sky-100 px-1 text-xs text-sky-900 no-underline">Implante</span>}
                              </td>
                              <td>
                                {m.descripcion}
                                {m.marca ? ` · ${m.marca}` : ''}
                                {m.sitio ? ` · ${m.sitio}` : ''}
                              </td>
                              <td>{m.medida ?? '—'}</td>
                              <td className="font-mono text-xs">
                                {m.lote ? `L ${m.lote}` : ''} {m.serie ? `S ${m.serie}` : ''}
                              </td>
                              <td>{m.cantidad}</td>
                              <td>
                                {deSala && enProceso && !m.anulado && (
                                  <details>
                                    <summary className="cursor-pointer text-xs text-red-700">Anular</summary>
                                    <FormAccion accion={anularMaterial.bind(null, m.id)} boton="Anular" variante="secundario" className="mt-1 flex gap-1">
                                      <input name="motivo" required placeholder="Motivo" aria-label="Motivo de anulación" className={claseCampo} />
                                    </FormAccion>
                                  </details>
                                )}
                                {m.anulado && <span className="text-xs no-underline">{m.motivo_anulacion}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {deSala && enProceso && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <h3 className="text-sm font-medium text-slate-700">Registrar material</h3>
                        <FormAccion accion={agregarMaterial.bind(null, c.id)} boton="Registrar material" variante="secundario" className="mt-2 grid gap-3 sm:grid-cols-4">
                          <label className={claseEtiqueta}>
                            Tipo *
                            <select name="tipo" required defaultValue="" className={claseCampo}>
                              <option value="">Elige…</option>
                              {Object.entries(TIPO_MATERIAL).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                  {IMPLANTES.includes(k) ? ' (implante)' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={`${claseEtiqueta} sm:col-span-2`}>
                            Descripción *
                            <input name="descripcion" required placeholder="Stent liberador de everolimus" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            Marca
                            <input name="marca" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            Medida
                            <input name="medida" placeholder="3.0 × 18 mm" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            Lote
                            <input name="lote" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            Número de serie
                            <input name="serie" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            Cantidad
                            <input name="cantidad" type="number" min={1} max={50} defaultValue={1} className={claseCampo} />
                          </label>
                          <label className={`${claseEtiqueta} sm:col-span-2`}>
                            Vaso o sitio
                            <input name="sitio" placeholder="DA proximal, ventrículo derecho…" className={claseCampo} />
                          </label>
                          <label className="flex items-center gap-2 text-sm sm:col-span-2">
                            <input type="checkbox" name="implante" /> Es implante (queda en el paciente)
                          </label>
                          <p className="text-xs text-slate-500 sm:col-span-4">
                            Los implantes necesitan lote o número de serie; el marcapasos y el desfibrilador, su número de serie.
                          </p>
                        </FormAccion>
                      </div>
                    )}
                  </section>

                  {c.estado === 'en_sala' && sala && (
                    <section className={claseTarjeta}>
                      <BotonAccion
                        etiqueta="Salida de sala → recuperación"
                        confirmar="¿El paciente sale de la sala a recuperación?"
                        alHacer={salirSala.bind(null, c.id)}
                      />
                    </section>
                  )}

                  {/* Firma */}
                  {['recuperacion', 'terminado'].includes(c.estado) && (
                    <section className={claseTarjeta} aria-label="Firma">
                      {firmado ? (
                        <p className="text-sm text-emerald-800">
                          Informe firmado por Dr(a). {c.firmado_por_nombre} · {fechaHora(c.firmado_en)}
                        </p>
                      ) : medico ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <BotonAccion etiqueta="Firmar informe" confirmar="Al firmar, la hoja ya no se puede modificar. ¿Firmar?" alHacer={firmarInforme.bind(null, c.id)} />
                          <span className="text-xs text-slate-500">Requiere acceso, hallazgos, procedimiento realizado, fluoroscopia y contraste.</span>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-800">Pendiente la firma del hemodinamista.</p>
                      )}
                    </section>
                  )}

                  {/* Recuperación */}
                  {['recuperacion', 'terminado'].includes(c.estado) && (
                    <section className={claseTarjeta} aria-label="Recuperación">
                      <h2 className="mb-1 text-sm font-semibold text-slate-800">Recuperación post-cateterismo</h2>
                      {proximo && (
                        <p className={`mb-2 text-sm ${proximo.vence < new Date() ? 'font-medium text-red-700' : 'text-slate-600'}`}>
                          Vigilancia cada {proximo.cada} min · próximo control {hora(proximo.vence.toISOString())}
                          {proximo.vence < new Date() ? ' (atrasado)' : ''} · {retirado ? 'introductor retirado' : 'introductor aún colocado'}
                        </p>
                      )}
                      {vigilancia.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin controles.</p>
                      ) : (
                        <table className="w-full text-left text-sm" aria-label="Controles de vigilancia">
                          <thead className="text-xs uppercase text-slate-500">
                            <tr>
                              <th className="py-1">Hora</th>
                              <th>Evento</th>
                              <th>TA</th>
                              <th>FC</th>
                              <th>SpO₂</th>
                              <th>EVA</th>
                              <th>Sitio de punción</th>
                              <th>Pulso distal</th>
                              <th>Nota</th>
                              <th>Registró</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vigilancia.map((v) => (
                              <tr key={v.id} className={`border-t border-slate-100 ${v.sitio === 'sangrado' || v.pulso === 'ausente' ? 'bg-red-50' : ''}`}>
                                <td className="py-1 font-mono">{hora(v.hora)}</td>
                                <td>{EVENTO[v.evento]}</td>
                                <td>{v.ta_sis ? `${v.ta_sis}/${v.ta_dia ?? '—'}` : '—'}</td>
                                <td>{v.fc ?? '—'}</td>
                                <td>{v.spo2 ?? '—'}</td>
                                <td>{v.eva ?? '—'}</td>
                                <td>{v.sitio ? SITIO[v.sitio] : '—'}</td>
                                <td>{v.pulso ? PULSO[v.pulso] : '—'}</td>
                                <td>{v.nota}</td>
                                <td className="text-xs text-slate-500">{v.registrado_por_nombre}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {puedeVigilar && (
                        <FormAccion accion={registrarVigilancia.bind(null, c.id)} boton="Registrar" className="mt-3 grid gap-3 sm:grid-cols-6">
                          <label className={claseEtiqueta}>
                            Evento
                            <select name="evento" defaultValue="control" className={claseCampo}>
                              {Object.entries(EVENTO).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={claseEtiqueta}>
                            TA sistólica
                            <input name="ta_sis" inputMode="numeric" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            TA diastólica
                            <input name="ta_dia" inputMode="numeric" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            FC
                            <input name="fc" inputMode="numeric" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            SpO₂
                            <input name="spo2" inputMode="numeric" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            Dolor (EVA 0–10)
                            <input name="eva" inputMode="numeric" className={claseCampo} />
                          </label>
                          <label className={claseEtiqueta}>
                            Sitio de punción
                            <select name="sitio" defaultValue="" className={claseCampo}>
                              <option value="">—</option>
                              {Object.entries(SITIO).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={claseEtiqueta}>
                            Pulso distal
                            <select name="pulso" defaultValue="" className={claseCampo}>
                              <option value="">—</option>
                              {Object.entries(PULSO).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={`${claseEtiqueta} sm:col-span-4`}>
                            Nota
                            <input name="nota" className={claseCampo} />
                          </label>
                        </FormAccion>
                      )}
                      {c.estado === 'recuperacion' && sala && (
                        <FormAccion accion={altaRecuperacion.bind(null, c.id)} boton="Alta de recuperación" variante="secundario" className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                          <label className={`${claseEtiqueta} min-w-56`}>
                            Destino *
                            <select name="destino" required defaultValue="" className={claseCampo}>
                              <option value="">Elige…</option>
                              {DESTINOS.map((x) => (
                                <option key={x} value={x}>
                                  {x}
                                </option>
                              ))}
                            </select>
                          </label>
                        </FormAccion>
                      )}
                      {c.estado === 'terminado' && (
                        <p className="mt-2 text-sm text-emerald-800">
                          Alta de recuperación {fechaHora(c.terminado_en)} · destino: {c.destino}
                        </p>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  )
}
