import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloHemodialisis } from '@/components/SoloHemodialisis'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { fecha, fechaHora } from '@/lib/formato'
import { ACCESOS, COMPLICACIONES, ESTADO_SESION, requiereAislado } from '@/lib/hemodialisis'
import { horaCorta } from '@/lib/farmacia'
import { cancelarSesion, iniciarSesion, registrarControl, terminarSesion } from '../../acciones'

type Control = { id: number; tomado_en: string; ta_s: number | null; ta_d: number | null; fc: number | null; qb: number | null; presion_venosa: number | null; presion_arterial: number | null; ptm: number | null; uf_acumulada_ml: number | null; notas: string | null }

const Campo = ({ n, t, w = 'w-24', ...r }: { n: string; t: string; w?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className={claseEtiqueta}>
    {t}
    <input name={n} inputMode="decimal" className={`${claseCampo.replace('w-full', '')} ${w}`} {...r} />
  </label>
)

export default async function SesionHdPage({ params }: PageProps<'/hemodialisis/sesion/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!perfil.hd)
    return (
      <>
        <Encabezado perfil={perfil} activo="hemodialisis" />
        <SoloHemodialisis />
      </>
    )
  const { id } = await params
  const supabase = await crearClienteServidor()
  const db = supabase.schema('clinico')
  const { data: s } = await db.from('hd_sesion').select('*').eq('id', id).maybeSingle()
  if (!s) notFound()
  const [{ data: v }, { data: hp }, { data: ctr }, { data: al }] = await Promise.all([
    db.from('v_hd_sesion').select('paciente, expediente, maquina_nombre, aislada, inicio, enfermera').eq('id', id).single(),
    db.from('hd_paciente').select('peso_seco, hbsag, vhc, vih, otra_infeccion, acceso_tipo, acceso_sitio, prescripcion').eq('paciente_id', s.paciente_id).single(),
    db.from('hd_control').select('*').eq('sesion_id', id).order('tomado_en'),
    db.from('paciente_alergia').select('sustancia').eq('paciente_id', s.paciente_id).eq('activa', true),
  ])
  const controles = (ctr ?? []) as Control[]
  const enfermeria = perfil.hd === 'enfermeria'
  const pr = (s.prescripcion ?? hp?.prescripcion ?? {}) as Record<string, string | number>
  const e = ESTADO_SESION[s.estado]

  return (
    <>
      <Encabezado perfil={perfil} activo="hemodialisis" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <span className="flex gap-3 text-sm">
            <Link href={`/hemodialisis?fecha=${s.fecha}`} className="text-sky-700 hover:underline">
              ← Agenda del {fecha(s.fecha)}
            </Link>
            <Link href={`/hemodialisis/paciente/${s.paciente_id}`} className="text-sky-700 hover:underline">
              Ficha del paciente
            </Link>
          </span>
          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{v?.paciente}</h1>
              <span className={`rounded px-2 py-0.5 text-sm ${e?.color}`}>{e?.texto}</span>
            </div>
            <p className="text-sm text-slate-600">
              Exp. {v?.expediente} · {fecha(s.fecha)} {String(v?.inicio).slice(0, 5)} h · {v?.maquina_nombre}
              {v?.enfermera ? ` · Enf. ${v.enfermera}` : ''}
              {s.inicio_real ? ` · inició ${horaCorta(s.inicio_real)}` : ''}
              {s.fin_real ? ` · terminó ${horaCorta(s.fin_real)}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              {(al ?? []).map((a, i) => (
                <span key={i} className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">
                  Alergia: {a.sustancia as string}
                </span>
              ))}
              {hp && requiereAislado(hp) && <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-900">Cubículo aislado</span>}
              {hp?.acceso_tipo && (
                <span className="rounded bg-slate-100 px-2 py-0.5">
                  Acceso: {ACCESOS[hp.acceso_tipo] ?? hp.acceso_tipo} {hp.acceso_sitio ?? ''}
                </span>
              )}
              <span className="rounded bg-slate-100 px-2 py-0.5">Peso seco: {hp?.peso_seco ? `${hp.peso_seco} kg` : 'sin registrar'}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              <strong>Prescripción:</strong>{' '}
              {Object.keys(pr).length
                ? [
                    pr.duracion_min && `${pr.duracion_min} min`,
                    pr.qb && `Qb ${pr.qb}`,
                    pr.qd && `Qd ${pr.qd}`,
                    pr.filtro && `filtro ${pr.filtro}`,
                    pr.heparina,
                    pr.bano_k && `K ${pr.bano_k}`,
                    pr.bano_ca && `Ca ${pr.bano_ca}`,
                    pr.uf_max_ml && `UF máx ${pr.uf_max_ml} mL`,
                    pr.indicaciones,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'sin prescripción de nefrología'}
            </p>
          </section>

          {/* Antes de conectar */}
          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Antes de la sesión</h2>
            {s.estado === 'programada' ? (
              enfermeria ? (
                <FormAccion accion={iniciarSesion.bind(null, id)} boton="Iniciar sesión" className="flex flex-wrap items-end gap-3">
                  <Campo n="peso" t="Peso (kg) *" required />
                  <Campo n="ta_s" t="TA sistólica *" required />
                  <Campo n="ta_d" t="TA diastólica *" required />
                  <Campo n="fc" t="FC" />
                  <Campo n="temp" t="Temp. °C" />
                </FormAccion>
              ) : (
                <p className="text-sm text-slate-500">La inicia enfermería de hemodiálisis.</p>
              )
            ) : s.peso_pre ? (
              <p className="text-sm text-slate-800">
                Peso {s.peso_pre} kg · TA {s.ta_pre_s}/{s.ta_pre_d} · FC {s.fc_pre ?? '—'} · T {s.temp_pre ?? '—'} °C ·{' '}
                <strong>Meta de UF {s.uf_meta_ml != null ? `${Number(s.uf_meta_ml).toLocaleString('es-MX')} mL` : '—'}</strong>
              </p>
            ) : (
              <p className="text-sm text-slate-500">{s.motivo_cancelacion ? `Motivo: ${s.motivo_cancelacion}` : '—'}</p>
            )}
          </section>

          {/* Controles durante la sesión */}
          {s.estado !== 'programada' && s.estado !== 'cancelada' && s.estado !== 'no_asistio' && (
            <section className={claseTarjeta}>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Controles durante la sesión ({controles.length})</h2>
              {controles.length > 0 && (
                <table className="mb-3 w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1">Hora</th>
                      <th>TA</th>
                      <th>FC</th>
                      <th>Qb</th>
                      <th>PV</th>
                      <th>PA</th>
                      <th>PTM</th>
                      <th>UF acum.</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controles.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="py-1">{horaCorta(c.tomado_en)}</td>
                        <td className={c.ta_s != null && c.ta_s < 90 ? 'font-semibold text-red-700' : ''}>{c.ta_s != null ? `${c.ta_s}/${c.ta_d ?? '—'}` : '—'}</td>
                        <td>{c.fc ?? '—'}</td>
                        <td>{c.qb ?? '—'}</td>
                        <td>{c.presion_venosa ?? '—'}</td>
                        <td>{c.presion_arterial ?? '—'}</td>
                        <td>{c.ptm ?? '—'}</td>
                        <td>{c.uf_acumulada_ml != null ? c.uf_acumulada_ml.toLocaleString('es-MX') : '—'}</td>
                        <td className="text-xs text-slate-600">{c.notas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {s.estado === 'en_curso' && enfermeria && (
                <FormAccion accion={registrarControl.bind(null, id)} boton="Registrar control" className="flex flex-wrap items-end gap-2">
                  <Campo n="ta_s" t="TA sist." w="w-20" />
                  <Campo n="ta_d" t="TA diast." w="w-20" />
                  <Campo n="fc" t="FC" w="w-20" />
                  <Campo n="qb" t="Qb" w="w-20" />
                  <Campo n="presion_venosa" t="P. venosa" w="w-20" />
                  <Campo n="presion_arterial" t="P. arterial" w="w-20" />
                  <Campo n="ptm" t="PTM" w="w-20" />
                  <Campo n="uf_acumulada_ml" t="UF acum. (mL)" w="w-28" />
                  <label className={`${claseEtiqueta} flex-1 min-w-48`}>
                    Notas
                    <input name="notas" className={claseCampo} />
                  </label>
                </FormAccion>
              )}
            </section>
          )}

          {/* Fin */}
          {s.estado === 'en_curso' && enfermeria && (
            <section className={claseTarjeta}>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Terminar la sesión</h2>
              <FormAccion accion={terminarSesion.bind(null, id)} boton="Terminar sesión" className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Campo n="peso_post" t="Peso final (kg) *" required />
                  <Campo n="ta_post_s" t="TA sistólica *" required />
                  <Campo n="ta_post_d" t="TA diastólica *" required />
                  <Campo n="fc_post" t="FC" />
                  <Campo n="uf_real_ml" t="UF total (mL) *" w="w-28" required />
                </div>
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">Complicaciones</legend>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm">
                    {COMPLICACIONES.map((c) => (
                      <label key={c} className="flex items-center gap-1">
                        <input type="checkbox" name="complicaciones" value={c} /> {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={claseEtiqueta}>
                  Notas de la sesión
                  <textarea name="notas" rows={2} className={claseCampo} placeholder="Medicamentos administrados (eritropoyetina, hierro…), incidencias" />
                </label>
              </FormAccion>
            </section>
          )}
          {s.estado === 'terminada' && (
            <section className={claseTarjeta}>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Al terminar</h2>
              <p className="text-sm text-slate-800">
                Peso {s.peso_post} kg ({(Number(s.peso_pre) - Number(s.peso_post)).toFixed(1)} kg menos) · TA {s.ta_post_s}/{s.ta_post_d} · FC {s.fc_post ?? '—'} ·{' '}
                <strong>UF {Number(s.uf_real_ml).toLocaleString('es-MX')} mL</strong>
                {s.uf_meta_ml != null && ` (meta ${Number(s.uf_meta_ml).toLocaleString('es-MX')} mL)`}
              </p>
              <p className="text-sm text-slate-700">Complicaciones: {(s.complicaciones as string[]).join(', ') || 'ninguna'}</p>
              {s.notas && <p className="text-sm text-slate-700">{s.notas}</p>}
              <p className="text-xs text-slate-500">Cerrada {fechaHora(s.fin_real)}</p>
            </section>
          )}

          {s.estado === 'programada' && perfil.hd !== 'consulta' && (
            <details className={claseTarjeta}>
              <summary className="cursor-pointer text-sm text-red-700">Cancelar o registrar inasistencia</summary>
              <FormAccion accion={cancelarSesion.bind(null, id)} boton="Cancelar sesión" variante="secundario" className="mt-2 flex flex-wrap items-end gap-3">
                <label className={`${claseEtiqueta} flex-1`}>
                  Motivo
                  <input name="motivo" required className={claseCampo} />
                </label>
                <label className="flex items-center gap-1 pb-2 text-sm">
                  <input type="checkbox" name="no_asistio" /> El paciente no asistió
                </label>
              </FormAccion>
            </details>
          )}
        </div>
      </main>
    </>
  )
}
