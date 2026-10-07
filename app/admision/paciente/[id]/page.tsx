import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { ESTADO_ENCUENTRO, SEXO, TIPO_ENCUENTRO, edad, fecha, fechaHora, nombreCompleto } from '@/lib/formato'
import { agregarAlergia, agregarPoliza, asignarCama, imprimirPulsera, programarIngreso } from '../../acciones'

// ---------------------------------------------------------------------
// Ficha de admisión del paciente: datos, alergias, pólizas, ingresos,
// asignación de cama y pulsera.
// ---------------------------------------------------------------------

type Encuentro = {
  id: string
  folio: string
  tipo: string
  estado: string
  origen: string
  servicio_id: number
  medico_tratante_id: string
  fecha_programada: string | null
  inicio: string | null
  fin: string | null
  diagnostico_presuntivo: string | null
  pulsera: { codigo_barras: string; activa: boolean }[]
}

export default async function FichaPacientePage({ params, searchParams }: PageProps<'/admision/paciente/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const { id } = await params
  const { aviso } = await searchParams
  const supabase = await crearClienteServidor()

  const { data: paciente } = await supabase
    .schema('clinico')
    .from('paciente')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!paciente) notFound()

  const [alergias, polizas, encuentrosRes, servicios, medicos, aseguradoras, medicamentos, camas] = await Promise.all([
    supabase.schema('clinico').from('paciente_alergia').select('id, sustancia, reaccion, severidad').eq('paciente_id', id).eq('activa', true),
    supabase.schema('clinico').from('poliza').select('id, aseguradora_id, numero_poliza, titular, deducible, coaseguro_pct, vigencia_fin').eq('paciente_id', id).eq('activa', true),
    supabase
      .schema('clinico')
      .from('encuentro')
      .select('id, folio, tipo, estado, origen, servicio_id, medico_tratante_id, fecha_programada, inicio, fin, diagnostico_presuntivo, pulsera(codigo_barras, activa)')
      .eq('paciente_id', id)
      .order('creado_en', { ascending: false }),
    supabase.schema('catalogo').from('servicio').select('id, clave, nombre, censable').eq('activo', true).order('id'),
    supabase.schema('seguridad').from('usuario').select('id, nombre, primer_apellido, especialidad').eq('rol', 'medico_tratante').eq('activo', true).order('primer_apellido'),
    supabase.schema('catalogo').from('aseguradora').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.schema('catalogo').from('medicamento').select('id, denominacion_generica').eq('activo', true).order('denominacion_generica'),
    supabase.schema('camas').from('cama').select('id, clave, servicio_id, area_id, tipo_lugar, estado').eq('activa', true),
  ])

  const encuentros = (encuentrosRes.data ?? []) as Encuentro[]
  const idsEncuentro = encuentros.map((e) => e.id)
  const { data: asignaciones } = idsEncuentro.length
    ? await supabase.schema('camas').from('asignacion').select('encuentro_id, cama_id, ocupada_desde').in('encuentro_id', idsEncuentro).is('hasta', null)
    : { data: [] }

  const servicioPorId = new Map((servicios.data ?? []).map((s) => [s.id as number, s]))
  const { data: areasData } = await supabase.schema('catalogo').from('area').select('id, clave, nombre, padre_id, orden').eq('activo', true)
  const areasLista = (areasData ?? []) as { id: number; clave: string; nombre: string; padre_id: number | null; orden: number }[]
  const areaPorId = new Map(areasLista.map((a) => [a.id, a]))
  const nombreArea = (id: number) => {
    const a = areaPorId.get(id)
    if (!a) return 'Otras'
    const padre = a.padre_id ? areaPorId.get(a.padre_id) : undefined
    return padre ? `${padre.nombre} · ${a.nombre}` : a.nombre
  }
  const camaPorId = new Map((camas.data ?? []).map((c) => [c.id as number, c]))
  const medicoPorId = new Map((medicos.data ?? []).map((m) => [m.id as string, m]))
  const aseguradoraPorId = new Map((aseguradoras.data ?? []).map((a) => [a.id as number, a.nombre as string]))
  const asignacionDe = new Map((asignaciones ?? []).map((a) => [a.encuentro_id as string, a]))

  // Solo se programa un nuevo ingreso si no hay otro de estancia en curso
  const enCurso = encuentros.some((e) => ['programado', 'activo', 'alta_medica'].includes(e.estado) && e.tipo !== 'cirugia')
  // ¿Queda algo por hacer en Admisión? (cama o pulsera pendientes en un ingreso vigente)
  const pendienteAdmision = encuentros.some(
    (e) =>
      ['programado', 'activo'].includes(e.estado) &&
      ((!asignacionDe.has(e.id) && e.tipo !== 'cirugia') || !e.pulsera.some((p) => p.activa))
  )

  return (
    <>
      <Encabezado perfil={perfil} activo="admision" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/admision" className="text-sm text-sky-700 hover:underline print:hidden">
            ← Admisión
          </Link>

          {/* Datos del paciente */}
          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{nombreCompleto(paciente)}</h1>
              <span className="font-mono text-sm text-slate-600">Expediente {paciente.expediente}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Dato titulo="Sexo" valor={SEXO[paciente.sexo] ?? paciente.sexo} />
              <Dato
                titulo="Nacimiento"
                valor={paciente.fecha_nacimiento ? `${fecha(paciente.fecha_nacimiento)} (${edad(paciente.fecha_nacimiento)} años)` : '—'}
              />
              <Dato titulo="CURP" valor={paciente.curp ?? '—'} mono />
              <Dato titulo="Tipo de sangre" valor={paciente.tipo_sangre ?? '—'} />
              <Dato titulo="Teléfono" valor={paciente.telefono ?? '—'} />
              <Dato titulo="Correo" valor={paciente.correo ?? '—'} />
            </dl>
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Alergias */}
            <section className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800">Alergias</h2>
              {(alergias.data ?? []).length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">Sin alergias registradas.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {alergias.data!.map((a) => (
                    <li key={a.id as string} className="text-sm rounded bg-red-50 border border-red-200 px-2 py-1 text-red-900">
                      <strong>{a.sustancia as string}</strong>
                      {a.severidad ? ` · ${a.severidad}` : ''}
                      {a.reaccion ? ` · ${a.reaccion}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="text-sm text-sky-700 cursor-pointer">+ Agregar alergia</summary>
                <FormAccion accion={agregarAlergia.bind(null, id)} boton="Guardar alergia" variante="secundario" className="mt-2 space-y-2">
                  <label className={claseEtiqueta}>
                    Sustancia o medicamento *
                    <input name="sustancia" required className={claseCampo} placeholder="Penicilina, látex, mariscos…" />
                  </label>
                  <label className={claseEtiqueta}>
                    Si es un medicamento del catálogo (para alertas de farmacia)
                    <select name="medicamento_id" defaultValue="" className={claseCampo}>
                      <option value="">— No está en el catálogo —</option>
                      {(medicamentos.data ?? []).map((m) => (
                        <option key={m.id as number} value={m.id as number}>{m.denominacion_generica as string}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={claseEtiqueta}>
                      Severidad
                      <select name="severidad" defaultValue="" className={claseCampo}>
                        <option value="">No especificada</option>
                        <option value="leve">Leve</option>
                        <option value="moderada">Moderada</option>
                        <option value="grave">Grave</option>
                        <option value="anafilaxia">Anafilaxia</option>
                      </select>
                    </label>
                    <label className={claseEtiqueta}>
                      Reacción
                      <input name="reaccion" className={claseCampo} placeholder="Urticaria, edema…" />
                    </label>
                  </div>
                </FormAccion>
              </details>
            </section>

            {/* Pólizas */}
            <section className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800">Pólizas de seguro</h2>
              {(polizas.data ?? []).length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">Paciente particular (sin póliza registrada).</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {polizas.data!.map((p) => (
                    <li key={p.id as string} className="rounded border border-slate-200 px-2 py-1">
                      <strong>{aseguradoraPorId.get(p.aseguradora_id as number)}</strong> · póliza {p.numero_poliza as string} ·
                      titular {p.titular as string} · deducible ${Number(p.deducible).toLocaleString('es-MX')} · coaseguro{' '}
                      {Number(p.coaseguro_pct)}%{p.vigencia_fin ? ` · vence ${fecha(p.vigencia_fin as string)}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="text-sm text-sky-700 cursor-pointer">+ Agregar póliza</summary>
                <FormAccion accion={agregarPoliza.bind(null, id)} boton="Guardar póliza" variante="secundario" className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className={claseEtiqueta}>
                      Aseguradora *
                      <select name="aseguradora_id" required defaultValue="" className={claseCampo}>
                        <option value="" disabled>Elegir…</option>
                        {(aseguradoras.data ?? []).map((a) => (
                          <option key={a.id as number} value={a.id as number}>{a.nombre as string}</option>
                        ))}
                      </select>
                    </label>
                    <label className={claseEtiqueta}>
                      Número de póliza *
                      <input name="numero_poliza" required className={claseCampo} />
                    </label>
                  </div>
                  <label className={claseEtiqueta}>
                    Titular *
                    <input name="titular" required defaultValue={nombreCompleto(paciente)} className={claseCampo} />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className={claseEtiqueta}>
                      Deducible ($)
                      <input name="deducible" type="number" min="0" step="0.01" defaultValue="0" className={claseCampo} />
                    </label>
                    <label className={claseEtiqueta}>
                      Coaseguro (%)
                      <input name="coaseguro_pct" type="number" min="0" max="100" step="0.01" defaultValue="0" className={claseCampo} />
                    </label>
                    <label className={claseEtiqueta}>
                      Vigencia hasta
                      <input name="vigencia_fin" type="date" className={claseCampo} />
                    </label>
                  </div>
                </FormAccion>
              </details>
            </section>
          </div>

          {aviso === 'ingreso' && pendienteAdmision && (
            <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Ingreso programado. Abajo, en <strong>Ingresos</strong>, reserva la cama e imprime la pulsera.
            </p>
          )}

          {/* Programar ingreso */}
          {!enCurso && (
            <section className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800">Programar ingreso</h2>
              <p className="text-xs text-slate-500 mb-3">Orden de ingreso enviada por el médico tratante desde su consultorio.</p>
              <FormAccion accion={programarIngreso.bind(null, id)} boton="Programar ingreso" className="space-y-3">
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className={claseEtiqueta}>
                    Tipo de ingreso *
                    <select name="tipo" required defaultValue="hospitalizacion" className={claseCampo}>
                      <option value="hospitalizacion">Hospitalización</option>
                      <option value="corta_estancia">Corta estancia</option>
                      <option value="cirugia">Cirugía</option>
                    </select>
                  </label>
                  <label className={claseEtiqueta}>
                    Servicio *
                    <select name="servicio" required defaultValue="" className={claseCampo}>
                      <option value="" disabled>Elegir…</option>
                      {(servicios.data ?? [])
                        .filter((s) => s.censable)
                        .map((s) => (
                          <option key={s.id as number} value={s.clave as string}>{s.nombre as string}</option>
                        ))}
                    </select>
                  </label>
                  <label className={claseEtiqueta}>
                    Médico tratante *
                    <select name="medico" required defaultValue="" className={claseCampo}>
                      <option value="" disabled>Elegir…</option>
                      {(medicos.data ?? []).map((m) => (
                        <option key={m.id as string} value={m.id as string}>
                          {m.primer_apellido as string}, {m.nombre as string}
                          {m.especialidad ? ` — ${m.especialidad}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className={claseEtiqueta}>
                    Fecha y hora programada *
                    <input name="fecha_programada" type="datetime-local" required className={claseCampo} />
                  </label>
                  <label className={`${claseEtiqueta} sm:col-span-2`}>
                    Diagnóstico presuntivo *
                    <input name="diagnostico" required className={claseCampo} />
                  </label>
                </div>
                <label className={claseEtiqueta}>
                  Póliza para este ingreso
                  <select name="poliza" defaultValue="" className={`${claseCampo} sm:max-w-md`}>
                    <option value="">Particular (sin póliza)</option>
                    {(polizas.data ?? []).map((p) => (
                      <option key={p.id as string} value={p.id as string}>
                        {aseguradoraPorId.get(p.aseguradora_id as number)} — {p.numero_poliza as string}
                      </option>
                    ))}
                  </select>
                </label>
              </FormAccion>
            </section>
          )}

          {/* Ingresos y estancias */}
          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Ingresos</h2>
            {encuentros.length === 0 && <p className="text-sm text-slate-500">Sin ingresos registrados.</p>}
            <div className="space-y-3">
              {encuentros.map((e) => {
                const servicio = servicioPorId.get(e.servicio_id)
                const asignacion = asignacionDe.get(e.id)
                const cama = asignacion ? camaPorId.get(asignacion.cama_id as number) : undefined
                const pulsera = e.pulsera.find((p) => p.activa)
                const vigente = ['programado', 'activo'].includes(e.estado)
                // Camas libres del servicio del paciente o de áreas sin servicio fijo, agrupadas por área
                const disponibles = (camas.data ?? [])
                  .filter((c) => (c.servicio_id === null || c.servicio_id === e.servicio_id) && c.estado === 'disponible' && areaPorId.has(c.area_id as number))
                  .sort((a, b) => (a.clave as string).localeCompare(b.clave as string, 'es', { numeric: true }))
                const gruposCamas = [...new Set(disponibles.map((c) => c.area_id as number))]
                  .sort((a, b) => (areaPorId.get(a)?.orden ?? 0) - (areaPorId.get(b)?.orden ?? 0))
                  .map((areaId) => ({ areaId, camas: disponibles.filter((c) => c.area_id === areaId) }))
                const medico = medicoPorId.get(e.medico_tratante_id)

                return (
                  <article key={e.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {TIPO_ENCUENTRO[e.tipo] ?? e.tipo} · {servicio?.nombre as string}
                        <span className={`ml-2 rounded px-2 py-0.5 text-xs ${vigente ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>
                          {ESTADO_ENCUENTRO[e.estado] ?? e.estado}
                        </span>
                      </p>
                      <span className="font-mono text-xs text-slate-500">Folio {e.folio}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {e.fecha_programada && <>Programado para {fechaHora(e.fecha_programada)} · </>}
                      {e.inicio && <>Inicio {fechaHora(e.inicio)} · </>}
                      {medico && <>Dr(a). {medico.nombre as string} {medico.primer_apellido as string} · </>}
                      {e.diagnostico_presuntivo ?? ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Cama: <strong>{cama ? `${cama.clave} (${asignacion?.ocupada_desde ? 'ocupada' : 'reservada'})` : 'sin asignar'}</strong>
                      {' · '}Pulsera: <strong className="font-mono">{pulsera ? pulsera.codigo_barras : 'sin imprimir'}</strong>
                    </p>

                    {vigente && (
                      <div className="mt-3 flex flex-wrap items-end gap-4">
                        {!asignacion && e.tipo !== 'cirugia' && (
                          <FormAccion accion={asignarCama.bind(null, id, e.id)} boton="Reservar cama" className="flex flex-wrap items-end gap-2">
                            <label className={claseEtiqueta}>
                              Cama disponible para {servicio?.nombre as string}
                              <select name="cama" required defaultValue="" className={`${claseCampo} min-w-40`}>
                                <option value="" disabled>
                                  {disponibles.length ? `${disponibles.length} disponibles…` : 'No hay camas disponibles'}
                                </option>
                                {gruposCamas.map((g) => (
                                  <optgroup key={g.areaId} label={`${nombreArea(g.areaId)} (${g.camas.length})`}>
                                    {g.camas.map((c) => (
                                      <option key={c.id as number} value={c.clave as string}>
                                        {c.clave as string}
                                        {c.tipo_lugar !== 'cama' ? ` (${c.tipo_lugar})` : ''}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </label>
                          </FormAccion>
                        )}

                        {!pulsera ? (
                          <FormAccion accion={imprimirPulsera.bind(null, e.id)} boton="Imprimir pulsera" variante="secundario" className="flex items-end" />
                        ) : (
                          <div className="flex flex-wrap items-end gap-2">
                            <Link
                              href={`/admision/pulsera/${e.id}`}
                              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Ver pulsera
                            </Link>
                            <details>
                              <summary className="text-xs text-slate-500 cursor-pointer">Reimprimir…</summary>
                              <FormAccion accion={imprimirPulsera.bind(null, e.id)} boton="Reimprimir" variante="secundario" className="mt-2 flex items-end gap-2">
                                <label className={claseEtiqueta}>
                                  Motivo
                                  <input name="motivo" required className={claseCampo} placeholder="Pulsera dañada, ilegible…" />
                                </label>
                              </FormAccion>
                            </details>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

function Dato({ titulo, valor, mono }: { titulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{titulo}</dt>
      <dd className={`text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>{valor}</dd>
    </div>
  )
}
