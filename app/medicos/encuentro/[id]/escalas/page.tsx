import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { FormEscalaGravedad } from '@/components/FormEscalaGravedad'
import { colorApache, colorSofa, type EvalGravedad } from '@/components/EscalasGravedad'
import { claseCampo, claseTarjeta } from '@/lib/estilos'
import { ahora, edad, fechaHora, nombreCompleto } from '@/lib/formato'
import { esMedico } from '@/lib/medica'
import { NOMBRE_COMPONENTE } from '@/lib/escalas'
import { anularEscalaGravedad, registrarEscalaGravedad } from '../../../acciones'

// Escalas de gravedad del paciente crítico adulto: APACHE II y SOFA.
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
  const [paciente, cama, acceso, signos, evals, param] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento, sexo').eq('id', encuentro.paciente_id).single(),
    supabase.schema('camas').from('v_censo').select('cama, area_nombre').eq('encuentro_id', id).maybeSingle(),
    supabase.schema('clinico').rpc('puede_ver_encuentro', { p_encuentro: id }),
    supabase
      .schema('clinico')
      .from('signos_vitales')
      .select('ta_sistolica, ta_diastolica, frecuencia_cardiaca, frecuencia_respiratoria, temperatura')
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
  ])
  const p = paciente.data
  if (!p) notFound()

  const anios = edad(p.fecha_nacimiento as string | null)
  const vigente = ['activo', 'alta_medica'].includes(encuentro.estado as string)
  const puedeRegistrar = esMedico(perfil.rol) && acceso.data === true && vigente
  const lista = (evals.data ?? []) as EvalGravedad[]
  const s = signos.data?.[0]
  const patm = Number(param.data?.valor ?? 760)
  const nino = anios !== null && anios < 16

  return (
    <>
      <Encabezado perfil={perfil} activo="medicos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href={`/medicos/encuentro/${id}`} className="text-sm text-sky-700 hover:underline">
            ← Expediente médico
          </Link>
          <section className={claseTarjeta}>
            <h1 className="text-lg font-semibold text-slate-900">Escalas de gravedad · {nombreCompleto(p)}</h1>
            <p className="text-sm text-slate-600">
              Exp. {p.expediente} · {anios !== null ? `${anios} años` : 'edad desconocida'} · {cama.data ? `${cama.data.area_nombre}, cama ${cama.data.cama}` : 'sin cama'} · Folio {encuentro.folio}
            </p>
          </section>

          {nino ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              APACHE II y SOFA son para mayores de 16 años. Para este paciente se usarán PIM3, PELOD-2 y pSOFA (o SNAPPE-II y CRIB II en neonatos), que se agregan en la siguiente etapa.
            </p>
          ) : puedeRegistrar ? (
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
          ) : (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {vigente ? 'Vista de consulta: las escalas las registra el personal médico.' : 'Este ingreso ya no está activo; las escalas quedan en modo consulta.'}
            </p>
          )}

          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800">Evaluaciones ({lista.filter((e) => !e.anulado).length})</h2>
            {lista.length === 0 && <p className="mt-2 text-sm text-slate-500">Sin evaluaciones registradas.</p>}
            <ul className="mt-2 divide-y divide-slate-100">
              {lista.map((e) => {
                const color = e.escala === 'SOFA' ? colorSofa(e.puntaje) : colorApache(e.puntaje)
                const puedeAnular = !e.anulado && vigente && (e.registrado_por === perfil.id || perfil.rol === 'medico_tratante')
                return (
                  <li key={e.id} className={`py-2 text-sm ${e.anulado ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{e.escala === 'APACHE_II' ? 'APACHE II' : 'SOFA'}</span>
                      <span className={`rounded px-1.5 font-semibold ${color} ${e.anulado ? 'line-through' : ''}`}>{e.puntaje}</span>
                      {e.mortalidad != null && <span className="text-slate-600">mortalidad ≈ {e.mortalidad} %</span>}
                      {e.delta != null && <span className={e.delta >= 2 ? 'font-medium text-red-700' : 'text-slate-600'}>Δ {e.delta > 0 ? `+${e.delta}` : e.delta}</span>}
                      <span className="text-slate-500">· {fechaHora(e.evaluado_en)} · {e.registrado_por_nombre}</span>
                      {e.anulado && <span className="rounded bg-slate-200 px-1 text-xs">Anulada: {e.motivo_anulacion}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {Object.entries(e.resultado?.puntos ?? {})
                        .filter(([k, v]) => k in NOMBRE_COMPONENTE && v > 0)
                        .map(([k, v]) => `${NOMBRE_COMPONENTE[k]} ${v}`)
                        .join(' · ') || 'Todos los componentes en 0'}
                      {(e.resultado?.faltantes?.length ?? 0) > 0 && ` · faltaron: ${e.resultado.faltantes!.map((f) => NOMBRE_COMPONENTE[f] ?? f).join(', ')}`}
                    </p>
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
