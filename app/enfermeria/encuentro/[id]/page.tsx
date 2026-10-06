import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { FormLiquidos } from '@/components/FormLiquidos'
import { CampoDictado } from '@/components/CampoDictado'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { ahora, edad, fechaHora, nombreCompleto } from '@/lib/formato'
import {
  COLOR_NIVEL,
  ESCALAS,
  RANGO_ALERTA,
  TURNOS,
  fueraDeRango,
  describirLiquido,
  interpretarEscala,
  turnoActual,
  type Aditivo,
  type Signos,
  type TipoEscala,
} from '@/lib/clinica'
import {
  firmarNotaEnfermeria,
  registrarEscala,
  registrarLiquidos,
  registrarSignos,
  solicitarAccesoEmergencia,
  validarOrden,
  administrarDosis,
  omitirDosis,
  recibirEnvio,
  solicitarPrn,
} from '../../acciones'
import { BotonAccion } from '@/components/BotonAccion'
import { AdministrarDosis } from '@/components/AdministrarDosis'
import { ESTADO_DOSIS, cantidad, horaCorta } from '@/lib/farmacia'
import { PRIORIDADES, TIPO_ORDEN, estadoOrden } from '@/lib/medica'

// ---------------------------------------------------------------------
// Hoja de enfermería: signos vitales, escalas, control de líquidos y
// nota del turno con firma electrónica.
// ---------------------------------------------------------------------

type SignosFila = Signos & { id: number; tomado_en: string; peso_kg: number | null; talla_cm: number | null; registrado_por: string }
type Escala = { id: number; tipo: string; puntaje: number; registrado_en: string; registrado_por: string }
type Liquido = {
  id: number
  sentido: 'ingreso' | 'egreso'
  concepto: string
  producto: string | null
  aditivos: Aditivo[]
  velocidad_ml_h: number | null
  volumen_ml: number
  registrado_en: string
}
type Orden = {
  id: string
  tipo: string
  estado: string
  prioridad: string
  detalle: { descripcion?: string; indicaciones?: string }
  solicitada_en: string | null
  ordenada_por: string
}
type DosisPiso = {
  id: string
  orden_id: string
  medicamento: string
  concentracion: string
  dosis: number
  unidad_dosis: string
  via: string
  hora_programada: string
  estado: string
  envio_id: string | null
  alto_riesgo: boolean
  grupo_controlado: string | null
  prn: boolean
  motivo: string | null
  administrado_en: string | null
  codigo_barras: string | null
}
type Nota = {
  id: string
  contenido: { turno?: string; valoracion?: string; plan_cuidados?: string; observaciones?: string }
  firmado_en: string
  firma: { nombre_firmante: string; cedula: string; hash_sha256: string }[]
}

const COLUMNAS_SIGNOS: { campo: keyof Signos; titulo: string }[] = [
  { campo: 'frecuencia_cardiaca', titulo: 'FC' },
  { campo: 'frecuencia_respiratoria', titulo: 'FR' },
  { campo: 'temperatura', titulo: 'T °C' },
  { campo: 'spo2', titulo: 'SpO₂' },
  { campo: 'dolor_eva', titulo: 'EVA' },
  { campo: 'glucosa_capilar', titulo: 'Glu' },
]

export default async function HojaEnfermeriaPage({ params }: PageProps<'/enfermeria/encuentro/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: encuentro } = await supabase
    .schema('clinico')
    .from('encuentro')
    .select('id, folio, paciente_id, tipo, estado, servicio_id, medico_tratante_id, diagnostico_presuntivo, aislamiento, inicio')
    .eq('id', id)
    .maybeSingle()
  if (!encuentro) notFound()

  const hace24h = new Date(ahora() - 24 * 3600 * 1000).toISOString()

  const [paciente, alergias, cama, medico, acceso, signos, escalas, liquidos, notas, ordenes] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento, sexo, tipo_sangre').eq('id', encuentro.paciente_id).single(),
    supabase.schema('clinico').from('paciente_alergia').select('sustancia, severidad').eq('paciente_id', encuentro.paciente_id).eq('activa', true),
    supabase.schema('camas').from('v_censo').select('cama, servicio_nombre').eq('encuentro_id', id).maybeSingle(),
    supabase.schema('seguridad').from('usuario').select('nombre, primer_apellido').eq('id', encuentro.medico_tratante_id).maybeSingle(),
    supabase.schema('clinico').rpc('puede_ver_encuentro', { p_encuentro: id }),
    supabase.schema('clinico').from('signos_vitales').select('*').eq('encuentro_id', id).gte('tomado_en', hace24h).order('tomado_en', { ascending: false }),
    supabase.schema('clinico').from('escala').select('id, tipo, puntaje, registrado_en, registrado_por').eq('encuentro_id', id).order('registrado_en', { ascending: false }).limit(40),
    supabase.schema('clinico').from('liquidos').select('id, sentido, concepto, producto, aditivos, velocidad_ml_h, volumen_ml, registrado_en').eq('encuentro_id', id).gte('registrado_en', hace24h).order('registrado_en', { ascending: false }),
    supabase
      .schema('clinico')
      .from('documento_clinico')
      .select('id, contenido, firmado_en, firma(nombre_firmante, cedula, hash_sha256)')
      .eq('encuentro_id', id)
      .eq('tipo', 'registro_enfermeria')
      .eq('estado', 'firmado')
      .order('firmado_en', { ascending: false })
      .limit(20),
    supabase
      .schema('clinico')
      .from('orden')
      .select('id, tipo, estado, prioridad, detalle, solicitada_en, ordenada_por')
      .eq('encuentro_id', id)
      .in('estado', ['solicitada', 'validada', 'en_proceso'])
      .order('solicitada_en', { ascending: false }),
  ])

  const p = paciente.data
  if (!p) notFound()

  // Medicación del paciente (dosis unitarias de farmacia) y órdenes PRN
  const ordenesMed = ((ordenes.data ?? []) as Orden[]).filter((o) => o.tipo === 'medicamento' && ['validada', 'en_proceso'].includes(o.estado))
  const [dosisQ, prnQ, enfermerasQ] = await Promise.all([
    supabase
      .schema('farmacia')
      .from('v_dosis')
      .select('id, orden_id, medicamento, concentracion, dosis, unidad_dosis, via, hora_programada, estado, envio_id, alto_riesgo, grupo_controlado, prn, motivo, administrado_en, codigo_barras')
      .eq('encuentro_id', id)
      .gte('hora_programada', hace24h)
      .neq('estado', 'cancelada')
      .order('hora_programada'),
    ordenesMed.length
      ? supabase.schema('farmacia').from('orden_medicamento').select('orden_id').eq('prn', true).in('orden_id', ordenesMed.map((o) => o.id))
      : Promise.resolve({ data: [] }),
    supabase.schema('seguridad').from('usuario').select('id, nombre, primer_apellido').eq('rol', 'enfermeria').eq('activo', true).neq('id', perfil.id).order('primer_apellido'),
  ])
  const listaDosis = (dosisQ.data ?? []) as DosisPiso[]
  // Modo de prueba (ECE_MODO_PRUEBA=1 en .env.local): muestra los códigos para usarlos sin lector
  const modoPrueba = process.env.ECE_MODO_PRUEBA === '1'
  const { data: pul } = modoPrueba
    ? await supabase.schema('clinico').from('pulsera').select('codigo_barras').eq('encuentro_id', id).eq('activa', true).maybeSingle()
    : { data: null }
  const pulseraActiva = (pul?.codigo_barras as string | undefined) ?? null
  const idsPrn = new Set(((prnQ.data ?? []) as { orden_id: string }[]).map((x) => x.orden_id))
  const ordenesPrn = ordenesMed.filter((o) => idsPrn.has(o.id))
  const enviosPendientes = [...new Set(listaDosis.filter((d) => d.estado === 'enviada' && d.envio_id).map((d) => d.envio_id as string))]
  const verificadores = ((enfermerasQ.data ?? []) as { id: string; nombre: string; primer_apellido: string }[]).map((u) => ({
    id: u.id,
    texto: `${u.nombre} ${u.primer_apellido}`,
  }))

  const puedeVer = acceso.data === true
  const esEnfermeria = perfil.rol === 'enfermeria'
  const esClinico = ['enfermeria', 'medico_tratante', 'medico_residente', 'anestesiologo'].includes(perfil.rol)
  const vigente = ['activo', 'alta_medica'].includes(encuentro.estado as string)
  const puedeRegistrar = esEnfermeria && puedeVer && vigente

  const listaSignos = (signos.data ?? []) as SignosFila[]
  const listaEscalas = (escalas.data ?? []) as Escala[]
  const listaLiquidos = (liquidos.data ?? []) as Liquido[]
  const listaNotas = (notas.data ?? []) as Nota[]
  const listaOrdenes = (ordenes.data ?? []) as Orden[]
  const porValidar = listaOrdenes.filter((o) => o.tipo === 'medicamento' && o.estado === 'solicitada')
  const activas = listaOrdenes.filter((o) => !porValidar.includes(o))

  // Nombres de quien registró
  const ids = Array.from(
    new Set([...listaSignos.map((s) => s.registrado_por), ...listaEscalas.map((e) => e.registrado_por), ...listaOrdenes.map((o) => o.ordenada_por)])
  )
  const { data: personal } = ids.length
    ? await supabase.schema('seguridad').from('usuario').select('id, nombre, primer_apellido').in('id', ids)
    : { data: [] }
  const quien = new Map((personal ?? []).map((u) => [u.id as string, `${u.nombre} ${u.primer_apellido}`]))

  // Última medición de cada escala
  const ultimaEscala = new Map<string, Escala>()
  for (const e of listaEscalas) if (!ultimaEscala.has(e.tipo)) ultimaEscala.set(e.tipo, e)

  // Balance de líquidos 24 h
  const ingresos = listaLiquidos.filter((l) => l.sentido === 'ingreso').reduce((t, l) => t + Number(l.volumen_ml), 0)
  const egresos = listaLiquidos.filter((l) => l.sentido === 'egreso').reduce((t, l) => t + Number(l.volumen_ml), 0)
  const balance = ingresos - egresos

  return (
    <>
      <Encabezado perfil={perfil} activo="enfermeria" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link href="/enfermeria" className="text-sky-700 hover:underline">
              ← Tablero de enfermería
            </Link>
            <span className="flex gap-4">
              <a href={`/admision/pulsera/${id}`} target="_blank" rel="noopener" className="text-sky-700 hover:underline">
                Pulsera del paciente ↗
              </a>
              <Link href={`/medicos/encuentro/${id}`} className="text-sky-700 hover:underline">
                Expediente médico →
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
              {medico.data && ` · Dr(a). ${medico.data.nombre} ${medico.data.primer_apellido}`}
            </p>
            {encuentro.diagnostico_presuntivo && (
              <p className="text-sm text-slate-700">Dx: {encuentro.diagnostico_presuntivo as string}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(alergias.data ?? []).map((a, i) => (
                <span key={`${a.sustancia}-${i}`} className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">
                  Alergia: {a.sustancia as string}
                  {a.severidad ? ` (${a.severidad})` : ''}
                </span>
              ))}
              {(alergias.data ?? []).length === 0 && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">Sin alergias registradas</span>}
              {encuentro.aislamiento !== 'ninguno' && (
                <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">Aislamiento: {encuentro.aislamiento as string}</span>
              )}
            </div>
          </section>

          {/* Sin acceso: paciente de otro servicio */}
          {!puedeVer && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                Este paciente no es de tu servicio. Solo ves su identificación; los registros clínicos están protegidos.
              </p>
              {esClinico && (
                <FormAccion
                  accion={solicitarAccesoEmergencia.bind(null, encuentro.paciente_id as string, id)}
                  boton="Solicitar acceso de emergencia"
                  variante="secundario"
                  className="flex flex-wrap items-end gap-2"
                >
                  <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                    Motivo (queda registrado en la bitácora)
                    <input name="motivo" required minLength={10} className={claseCampo} placeholder="Deterioro súbito, paciente en mi pasillo…" />
                  </label>
                </FormAccion>
              )}
            </section>
          )}

          {puedeVer && !vigente && (
            <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
              Este ingreso ya no está activo; la hoja queda en modo consulta.
            </p>
          )}

          {puedeVer && (
            <>
              {/* Órdenes médicas */}
              <section className={claseTarjeta}>
                <h2 className="text-sm font-semibold text-slate-800">Órdenes médicas</h2>
                {porValidar.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs font-semibold uppercase text-amber-800">Medicamentos por validar ({porValidar.length})</p>
                    {porValidar.map((o) => (
                      <div key={o.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                        <p className="font-medium text-slate-900">
                          {o.prioridad !== 'rutina' && (
                            <span className="mr-1 rounded bg-red-100 px-1 text-xs text-red-800">{PRIORIDADES[o.prioridad]}</span>
                          )}
                          {o.detalle?.descripcion}
                        </p>
                        {o.detalle?.indicaciones && <p className="text-slate-700">{o.detalle.indicaciones}</p>}
                        <p className="text-xs text-slate-500">
                          Dr(a). {quien.get(o.ordenada_por) ?? '—'} · {fechaHora(o.solicitada_en)}
                        </p>
                        {puedeRegistrar && (
                          <div className="mt-2 flex flex-wrap items-end gap-3">
                            <FormAccion accion={validarOrden.bind(null, o.id, id, true)} boton="Validar" className="flex items-center gap-2" />
                            <FormAccion
                              accion={validarOrden.bind(null, o.id, id, false)}
                              boton="Devolver al médico"
                              variante="secundario"
                              className="flex flex-wrap items-end gap-2"
                            >
                              <label className={claseEtiqueta}>
                                Motivo de devolución
                                <input name="motivo" className={claseCampo} placeholder="Dosis, vía, alergia, duplicada…" />
                              </label>
                            </FormAccion>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {activas.length === 0 && porValidar.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Sin órdenes vigentes.</p>
                ) : (
                  activas.length > 0 && (
                    <ul className="mt-2 divide-y divide-slate-100 text-sm">
                      {activas.map((o) => {
                        const e = estadoOrden(o.tipo, o.estado)
                        return (
                          <li key={o.id} className="py-1">
                            <span className={`mr-1 rounded px-1 text-xs ${e.color}`}>{e.texto}</span>
                            <span className="text-slate-500">{TIPO_ORDEN[o.tipo]}:</span> {o.detalle?.descripcion}
                            {o.detalle?.indicaciones ? ` (${o.detalle.indicaciones})` : ''}
                          </li>
                        )
                      })}
                    </ul>
                  )
                )}
              </section>

              {/* Medicación */}
              <section className={claseTarjeta}>
                <h2 className="text-sm font-semibold text-slate-800">Medicación (últimas 24 h y próximas)</h2>
                {enviosPendientes.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-2 text-sm text-violet-900">
                    Llegó por tubo: {listaDosis.filter((d) => d.estado === 'enviada').length} dosis.
                    {puedeRegistrar &&
                      enviosPendientes.map((e) => <BotonAccion key={e} etiqueta="Recibir envío" alHacer={recibirEnvio.bind(null, e, id)} />)}
                  </div>
                )}
                {puedeRegistrar && listaDosis.length > 0 && (
                  <div className="mt-2">
                    <AdministrarDosis
                      accion={administrarDosis.bind(null, id)}
                      verificadores={verificadores}
                      encuentroId={id}
                      ayuda={
                        modoPrueba
                          ? {
                              pulsera: pulseraActiva,
                              dosis: listaDosis
                                .filter((d) => d.estado === 'recibida' && d.codigo_barras)
                                .map((d) => ({ codigo: d.codigo_barras as string, texto: `${horaCorta(d.hora_programada)} ${d.medicamento} ${cantidad(d.dosis)} ${d.unidad_dosis}` })),
                            }
                          : null
                      }
                    />
                  </div>
                )}
                {ordenesPrn.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">PRN (por razón necesaria)</p>
                    {ordenesPrn.map((o) => (
                      <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>{o.detalle?.descripcion}</span>
                        {puedeRegistrar && <BotonAccion etiqueta="Solicitar dosis" variante="secundario" alHacer={solicitarPrn.bind(null, o.id, id)} />}
                      </div>
                    ))}
                  </div>
                )}
                {listaDosis.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Sin dosis de farmacia en este periodo.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {listaDosis.map((d) => {
                      const e = ESTADO_DOSIS[d.estado]
                      return (
                        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                          <span className="flex flex-wrap items-center gap-1">
                            <span className="font-semibold text-sky-800">{horaCorta(d.hora_programada)}</span>
                            <span className={`rounded px-1 text-xs ${e?.color}`}>{e?.texto}</span>
                            <strong>{d.medicamento}</strong> {cantidad(d.dosis)} {d.unidad_dosis} {d.via}
                            {d.alto_riesgo && <span className="rounded bg-red-100 px-1 text-xs text-red-800">Alto riesgo</span>}
                            {d.grupo_controlado && <span className="rounded bg-purple-100 px-1 text-xs text-purple-800">Controlado {d.grupo_controlado}</span>}
                            {d.administrado_en && <span className="text-xs text-emerald-800">· administrada {horaCorta(d.administrado_en)}</span>}
                            {d.motivo && d.estado === 'omitida' && <span className="text-xs text-red-700">· {d.motivo}</span>}
                          </span>
                          {['enviada', 'recibida'].includes(d.estado) && (
                            <a href={`/farmacia/etiqueta/${d.id}`} target="_blank" rel="noopener" className="text-xs text-sky-700 hover:underline">
                              Etiqueta ↗
                            </a>
                          )}
                          {puedeRegistrar && ['enviada', 'recibida'].includes(d.estado) && (
                            <details>
                              <summary className="cursor-pointer text-xs text-red-700">No se administró</summary>
                              <FormAccion
                                accion={omitirDosis.bind(null, d.id, id)}
                                boton="Registrar omisión"
                                variante="secundario"
                                className="mt-1 flex flex-wrap items-end gap-2"
                              >
                                <label className={claseEtiqueta}>
                                  Motivo
                                  <input name="motivo" required placeholder="Ayuno, rechazo, fuera de piso…" className={claseCampo} />
                                </label>
                              </FormAccion>
                            </details>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {/* Signos vitales */}
              <section className={claseTarjeta}>
                <h2 className="text-sm font-semibold text-slate-800">Signos vitales (últimas 24 h)</h2>
                {puedeRegistrar && (
                  <FormAccion accion={registrarSignos.bind(null, id)} boton="Registrar signos" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <Campo nombre="ta_sistolica" titulo="TA sistólica" unidad="mmHg" />
                      <Campo nombre="ta_diastolica" titulo="TA diastólica" unidad="mmHg" />
                      <Campo nombre="frecuencia_cardiaca" titulo="FC" unidad="lpm" />
                      <Campo nombre="frecuencia_respiratoria" titulo="FR" unidad="rpm" />
                      <Campo nombre="temperatura" titulo="Temperatura" unidad="°C" paso="0.1" />
                      <Campo nombre="spo2" titulo="SpO₂" unidad="%" />
                      <Campo nombre="dolor_eva" titulo="Dolor EVA" unidad="0–10" />
                      <Campo nombre="glucosa_capilar" titulo="Glucosa capilar" unidad="mg/dL" />
                      <Campo nombre="peso_kg" titulo="Peso" unidad="kg" paso="0.1" />
                      <Campo nombre="talla_cm" titulo="Talla" unidad="cm" paso="0.1" />
                    </div>
                  </FormAccion>
                )}
                {listaSignos.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin signos vitales en las últimas 24 horas.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-1.5 pr-3 font-medium">Hora</th>
                          <th className="py-1.5 pr-3 font-medium">TA</th>
                          {COLUMNAS_SIGNOS.map((c) => (
                            <th key={c.campo} className="py-1.5 pr-3 font-medium">{c.titulo}</th>
                          ))}
                          <th className="py-1.5 pr-3 font-medium">Registró</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaSignos.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="py-1.5 pr-3 whitespace-nowrap">{fechaHora(s.tomado_en)}</td>
                            <td className={`py-1.5 pr-3 ${fueraDeRango('ta_sistolica', s.ta_sistolica) || fueraDeRango('ta_diastolica', s.ta_diastolica) ? 'text-red-700 font-semibold' : ''}`}>
                              {s.ta_sistolica ?? '—'}/{s.ta_diastolica ?? '—'}
                            </td>
                            {COLUMNAS_SIGNOS.map((c) => (
                              <td key={c.campo} className={`py-1.5 pr-3 ${fueraDeRango(c.campo, s[c.campo]) ? 'text-red-700 font-semibold' : ''}`}>
                                {s[c.campo] ?? '—'}
                              </td>
                            ))}
                            <td className="py-1.5 pr-3 text-slate-500">{quien.get(s.registrado_por) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-xs text-slate-500">
                      En rojo, fuera de rango para adulto (p. ej. T &gt; {RANGO_ALERTA.temperatura.max} °C, SpO₂ &lt; {RANGO_ALERTA.spo2.min} %).
                    </p>
                  </div>
                )}
              </section>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Escalas */}
                <section className={claseTarjeta}>
                  <h2 className="text-sm font-semibold text-slate-800">Escalas</h2>
                  <ul className="mt-2 space-y-1">
                    {(Object.keys(ESCALAS) as TipoEscala[]).map((tipo) => {
                      const e = ultimaEscala.get(tipo)
                      const i = e ? interpretarEscala(tipo, Number(e.puntaje)) : null
                      return (
                        <li key={tipo} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-slate-700">{ESCALAS[tipo].nombre}</span>
                          {e && i ? (
                            <span className={`rounded border px-2 py-0.5 text-xs ${COLOR_NIVEL[i.nivel]}`}>
                              {Number(e.puntaje)} · {i.texto} · {fechaHora(e.registrado_en)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Sin registro</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {puedeRegistrar && (
                    <FormAccion accion={registrarEscala.bind(null, id)} boton="Registrar escala" variante="secundario" className="mt-3 flex flex-wrap items-end gap-2">
                      <label className={claseEtiqueta}>
                        Escala
                        <select name="tipo" required defaultValue="" className={claseCampo}>
                          <option value="" disabled>Elegir…</option>
                          {(Object.keys(ESCALAS) as TipoEscala[]).map((t) => (
                            <option key={t} value={t}>{ESCALAS[t].nombre} ({ESCALAS[t].min}–{ESCALAS[t].max})</option>
                          ))}
                        </select>
                      </label>
                      <label className={claseEtiqueta}>
                        Puntaje
                        <input name="puntaje" type="number" required min={0} max={125} className={`${claseCampo} w-24`} />
                      </label>
                    </FormAccion>
                  )}
                </section>

                {/* Líquidos */}
                <section className={claseTarjeta}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-800">Control de líquidos (24 h)</h2>
                    <span className={`text-sm font-semibold ${balance > 0 ? 'text-sky-800' : balance < 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                      Balance {balance > 0 ? '+' : ''}{balance.toLocaleString('es-MX')} mL
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Ingresos {ingresos.toLocaleString('es-MX')} mL · Egresos {egresos.toLocaleString('es-MX')} mL
                  </p>
                  {listaLiquidos.length > 0 && (
                    <ul className="mt-2 max-h-40 overflow-y-auto text-xs divide-y divide-slate-100">
                      {listaLiquidos.map((l) => (
                        <li key={l.id} className="py-1 flex justify-between gap-2">
                          <span>
                            {l.sentido === 'ingreso' ? '↓ Ingreso' : '↑ Egreso'} · {describirLiquido(l)}
                          </span>
                          <span className="text-slate-600">
                            {Number(l.volumen_ml).toLocaleString('es-MX')} mL · {fechaHora(l.registrado_en)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {puedeRegistrar && (
                    <FormLiquidos accion={registrarLiquidos.bind(null, id)} />
                  )}
                </section>
              </div>

              {/* Notas de enfermería */}
              <section className={claseTarjeta}>
                <h2 className="text-sm font-semibold text-slate-800">Notas de enfermería</h2>
                {puedeRegistrar && (
                  <FormAccion accion={firmarNotaEnfermeria.bind(null, id)} boton="Guardar y firmar nota" className="mt-3 space-y-3">
                    <label className={`${claseEtiqueta} sm:max-w-xs`}>
                      Turno
                      <select name="turno" required defaultValue={turnoActual()} className={claseCampo}>
                        {TURNOS.map((t) => (
                          <option key={t.clave} value={t.clave}>{t.nombre}</option>
                        ))}
                      </select>
                    </label>
                    <CampoDictado
                      name="valoracion"
                      etiqueta="Valoración *"
                      required
                      rows={3}
                      placeholder="Estado general, neurológico, respiratorio, herida, accesos venosos…"
                    />
                    <CampoDictado name="plan_cuidados" etiqueta="Plan de cuidados" rows={2} />
                    <CampoDictado name="observaciones" etiqueta="Observaciones / entrega de turno" rows={2} />
                    <p className="text-xs text-slate-500">
                      Al firmar, la nota queda sellada con tu nombre, cédula y hora, y ya no puede modificarse (NOM-004).
                    </p>
                  </FormAccion>
                )}
                {listaNotas.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin notas de enfermería.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {listaNotas.map((n) => {
                      const f = n.firma[0]
                      return (
                        <article key={n.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            Turno {n.contenido.turno} · {fechaHora(n.firmado_en)}
                          </p>
                          <p className="mt-1 whitespace-pre-line text-slate-900">{n.contenido.valoracion}</p>
                          {n.contenido.plan_cuidados && (
                            <p className="mt-1 whitespace-pre-line text-slate-700"><strong>Plan:</strong> {n.contenido.plan_cuidados}</p>
                          )}
                          {n.contenido.observaciones && (
                            <p className="mt-1 whitespace-pre-line text-slate-700"><strong>Observaciones:</strong> {n.contenido.observaciones}</p>
                          )}
                          {f && (
                            <p className="mt-2 text-xs text-emerald-800">
                              ✓ Firmada por {f.nombre_firmante} · Céd. {f.cedula} ·{' '}
                              <span className="font-mono" title={f.hash_sha256}>SHA-256 {f.hash_sha256.slice(0, 12)}…</span>
                            </p>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}

function Campo({ nombre, titulo, unidad, paso = '1' }: { nombre: string; titulo: string; unidad: string; paso?: string }) {
  return (
    <label className={claseEtiqueta}>
      {titulo} <span className="font-normal text-slate-400">({unidad})</span>
      <input name={nombre} type="number" step={paso} inputMode="decimal" className={claseCampo} />
    </label>
  )
}
