import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { FormEscalaGravedad } from '@/components/FormEscalaGravedad'
import { FormEscalaPed } from '@/components/FormEscalaPed'
import { claseEvaluacion, escalasDelPaciente, type EvalGravedad } from '@/components/EscalasGravedad'
import { claseCampo, claseTarjeta } from '@/lib/estilos'
import { ahora, edadDetalle, edadTextoCorto, fechaHora, nombreCompleto } from '@/lib/formato'
import { esMedico } from '@/lib/medica'
import { NOMBRE_COMPONENTE } from '@/lib/escalas'
import { ESCALAS_GRAVEDAD, INTERPRETACION, NOMBRE_COMPONENTE_PED, type FilaCrib } from '@/lib/escalas-ped'
import { anularEscalaGravedad, registrarEscalaGravedad, registrarEscalaPed } from '../../../acciones'

// Escalas de gravedad: APACHE II / SOFA (adultos), PIM3 / PELOD-2 / pSOFA / COMFORT-B / PEWS (niños)
// y SNAPPE-II / CRIB II / nSOFA / Silverman / N-PASS (recién nacidos). Enfermería registra las suyas.
export default async function EscalasGravedadPage({ params }: PageProps<'/medicos/encuentro/[id]/escalas'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: encuentro } = await supabase
    .schema('clinico')
    .from('encuentro')
    .select('id, folio, paciente_id, estado, medico_tratante_id')
    .eq('id', id)
    .maybeSingle()
  if (!encuentro) notFound()

  const hace24h = new Date(ahora() - 24 * 3600 * 1000).toISOString()
  const [paciente, cama, acceso, signos, evals, param, crib] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento, sexo').eq('id', encuentro.paciente_id).single(),
    supabase.schema('camas').from('v_censo').select('cama, area_nombre').eq('encuentro_id', id).maybeSingle(),
    supabase.schema('clinico').rpc('puede_ver_encuentro', { p_encuentro: id }),
    supabase
      .schema('clinico')
      .from('signos_vitales')
      .select('ta_sistolica, ta_diastolica, frecuencia_cardiaca, frecuencia_respiratoria, temperatura, spo2')
      .eq('encuentro_id', id)
      .gte('tomado_en', hace24h)
      .order('tomado_en', { ascending: false })
      .limit(1),
    supabase
      .schema('clinico')
      .from('v_escala_gravedad')
      .select('id, escala, evaluado_en, puntaje, mortalidad, delta, resultado, datos, registrado_por, registrado_por_nombre, anulado, motivo_anulacion')
      .eq('encuentro_id', id)
      .order('evaluado_en', { ascending: false }),
    supabase.schema('catalogo').from('parametro_clinico').select('valor').eq('clave', 'presion_barometrica_mmhg').maybeSingle(),
    supabase.schema('catalogo').from('crib2_peso_eg').select('sexo, peso_min, peso_max, semanas, puntos'),
  ])
  const p = paciente.data
  if (!p) notFound()

  const ed = edadDetalle(p.fecha_nacimiento as string | null)
  const anios = ed?.anios ?? null
  const adulto = anios === null || anios >= 16
  const vigente = ['activo', 'alta_medica'].includes(encuentro.estado as string)
  const medico = esMedico(perfil.rol)
  const enfermeria = perfil.rol === 'enfermeria'
  const puedeVer = acceso.data === true
  const lista = (evals.data ?? []) as EvalGravedad[]
  const s = signos.data?.[0]
  const patm = Number(param.data?.valor ?? 760)
  const esEnfermeria = perfil.rol === 'enfermeria'

  // Escalas que esta persona puede capturar para este paciente
  const delPaciente = escalasDelPaciente(ed)
  const capturables = adulto
    ? []
    : delPaciente.filter((e) => medico || (enfermeria && ESCALAS_GRAVEDAD[e].enfermeria))
  const puedeAdulto = adulto && medico && puedeVer && vigente
  const puedePed = !adulto && (medico || enfermeria) && puedeVer && vigente && capturables.length > 0

  return (
    <>
      <Encabezado perfil={perfil} activo={esEnfermeria ? 'enfermeria' : 'medicos'} />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href={esEnfermeria ? `/enfermeria/encuentro/${id}` : `/medicos/encuentro/${id}`} className="text-sm text-sky-700 hover:underline">
            ← {esEnfermeria ? 'Hoja de enfermería' : 'Expediente médico'}
          </Link>
          <section className={claseTarjeta}>
            <h1 className="text-lg font-semibold text-slate-900">Escalas de gravedad · {nombreCompleto(p)}</h1>
            <p className="text-sm text-slate-600">
              Exp. {p.expediente} · {edadTextoCorto(ed)} · {cama.data ? `${cama.data.area_nombre}, cama ${cama.data.cama}` : 'sin cama'} · Folio {encuentro.folio}
            </p>
          </section>

          {puedeAdulto ? (
            <section className={claseTarjeta}>
              <FormEscalaGravedad
                accion={registrarEscalaGravedad.bind(null, id)}
                edad={anios}
                patm={patm}
                inicial={{
                  temperatura: s?.temperatura == null ? null : Number(s.temperatura),
                  tas: s?.ta_sistolica ?? null,
                  tad: s?.ta_diastolica ?? null,
                  fc: s?.frecuencia_cardiaca ?? null,
                  fr: s?.frecuencia_respiratoria ?? null,
                }}
              />
            </section>
          ) : puedePed ? (
            <section className={claseTarjeta}>
              {enfermeria && <p className="mb-3 text-sm text-slate-600">Enfermería registra COMFORT-B, PEWS, Silverman y N-PASS; las escalas de mortalidad y disfunción orgánica las registra el médico.</p>}
              <FormEscalaPed
                accion={registrarEscalaPed.bind(null, id)}
                escalas={capturables as Parameters<typeof FormEscalaPed>[0]['escalas']}
                meses={ed?.meses ?? null}
                sexo={(p.sexo as string | null) ?? null}
                tablaCrib={(crib.data ?? []) as FilaCrib[]}
                inicial={{
                  tas: s?.ta_sistolica ?? null,
                  tad: s?.ta_diastolica ?? null,
                  spo2: s?.spo2 ?? null,
                }}
              />
            </section>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {!vigente
                ? 'Este ingreso ya no está activo; las escalas quedan en modo consulta.'
                : !puedeVer
                  ? 'Este paciente no es de tu servicio.'
                  : 'Vista de consulta: las escalas de este paciente las registra el personal médico.'}
            </p>
          )}

          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800">Evaluaciones ({lista.filter((e) => !e.anulado).length})</h2>
            {lista.length === 0 && <p className="mt-2 text-sm text-slate-500">Sin evaluaciones registradas.</p>}
            <ul className="mt-2 divide-y divide-slate-100">
              {lista.map((e) => {
                const info = ESCALAS_GRAVEDAD[e.escala]
                const interp = e.resultado?.interpretacion ? INTERPRETACION[e.resultado.interpretacion] : null
                const puedeAnular = !e.anulado && vigente && (e.registrado_por === perfil.id || perfil.rol === 'medico_tratante')
                const nombres = { ...NOMBRE_COMPONENTE, ...NOMBRE_COMPONENTE_PED }
                return (
                  <li key={e.id} className={`py-2 text-sm ${e.anulado ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{info?.nombre ?? e.escala}</span>
                      {e.escala !== 'PIM3' && <span className={`rounded px-1.5 font-semibold ${claseEvaluacion(e)} ${e.anulado ? 'line-through' : ''}`}>{e.puntaje}</span>}
                      {e.mortalidad != null && <span className={e.escala === 'PIM3' ? `rounded px-1.5 font-semibold ${claseEvaluacion(e)}` : 'text-slate-600'}>mortalidad ≈ {Number(e.mortalidad)} %</span>}
                      {interp && <span className={`rounded px-1.5 text-xs ${interp.clase}`}>{interp.texto}</span>}
                      {e.escala === 'NPASS' && <span className="text-slate-600">sedación {e.resultado?.sedacion}</span>}
                      {e.delta != null && e.delta !== 0 && <span className={e.delta >= 2 ? 'font-medium text-red-700' : 'text-slate-600'}>Δ {e.delta > 0 ? `+${e.delta}` : e.delta}</span>}
                      <span className="text-slate-500">· {fechaHora(e.evaluado_en)} · {e.registrado_por_nombre}</span>
                      {e.anulado && <span className="rounded bg-slate-200 px-1 text-xs">Anulada: {e.motivo_anulacion}</span>}
                    </div>
                    {e.escala !== 'PIM3' && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {Object.entries(e.resultado?.puntos ?? {})
                          .filter(([k, v]) => k in nombres && v !== 0)
                          .map(([k, v]) => `${nombres[k]} ${v}`)
                          .join(' · ') || 'Todos los componentes en 0'}
                        {(e.resultado?.faltantes?.length ?? 0) > 0 && ` · faltaron: ${e.resultado.faltantes!.map((f) => nombres[f] ?? f).join(', ')}`}
                      </p>
                    )}
                    {puedeAnular && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-slate-500">Anular (error de captura)</summary>
                        <FormAccion accion={anularEscalaGravedad.bind(null, id)} boton="Anular evaluación" variante="secundario" className="mt-1 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={e.id} />
                          <input name="motivo" placeholder="Motivo" className={`${claseCampo} max-w-sm`} />
                        </FormAccion>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </main>
    </>
  )
}
