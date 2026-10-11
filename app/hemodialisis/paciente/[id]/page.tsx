import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloHemodialisis } from '@/components/SoloHemodialisis'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha, fechaHora } from '@/lib/formato'
import { ACCESOS, DIAS, ESTADO_SESION, SEROLOGIA, requiereAislado, serologiaVencida, type HdPaciente } from '@/lib/hemodialisis'
import { darDeBaja, fijarHorario, guardarPrescripcion, guardarPrograma } from '../../acciones'

type SesionFila = { id: string; fecha: string; horario: string; maquina: string; estado: string; peso_pre: number | null; peso_post: number | null; uf_meta_ml: number | null; uf_real_ml: number | null; complicaciones: string[] }

export default async function FichaHdPage({ params }: PageProps<'/hemodialisis/paciente/[id]'>) {
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
  const [{ data: h }, { data: p }, { data: fijo }, { data: ses }, { data: maq }, { data: hor }] = await Promise.all([
    db.from('hd_paciente').select('*').eq('paciente_id', id).maybeSingle(),
    db.from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente, sexo, fecha_nacimiento, telefono').eq('id', id).maybeSingle(),
    db.from('hd_horario_fijo').select('dia_semana, horario:hd_horario(clave), maquina:hd_maquina(clave)').eq('paciente_id', id),
    db.from('v_hd_sesion').select('id, fecha, horario, maquina, estado, peso_pre, peso_post, uf_meta_ml, uf_real_ml, complicaciones').eq('paciente_id', id).order('fecha', { ascending: false }).order('horario_orden', { ascending: false }).limit(30),
    supabase.schema('catalogo').from('hd_maquina').select('clave, nombre, aislada').eq('activa', true).order('orden'),
    supabase.schema('catalogo').from('hd_horario').select('clave, inicio').eq('activo', true).order('orden'),
  ])
  if (!h || !p) notFound()
  const x = h as HdPaciente
  const fijos = (fijo ?? []) as unknown as { dia_semana: number; horario: { clave: string } | null; maquina: { clave: string } | null }[]
  const sesiones = (ses ?? []) as SesionFila[]
  const pr = x.prescripcion ?? {}
  const esMedico = perfil.hd === 'medico'
  const editable = perfil.hd === 'medico' || perfil.hd === 'enfermeria'
  const aislado = requiereAislado(x)
  const maquinas = ((maq ?? []) as { clave: string; nombre: string; aislada: boolean }[]).filter((m) => m.aislada === aislado)

  return (
    <>
      <Encabezado perfil={perfil} activo="hemodialisis" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <span className="flex gap-3 text-sm">
            <Link href="/hemodialisis" className="text-sky-700 hover:underline">
              ← Agenda
            </Link>
            <Link href="/hemodialisis/pacientes" className="text-sky-700 hover:underline">
              Pacientes del programa
            </Link>
          </span>
          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{[p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')}</h1>
              <span className="flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-slate-100 px-2 py-0.5">{x.tipo === 'cronico' ? 'Crónico (externo)' : 'Agudo (internado)'}</span>
                {!x.activo && <span className="rounded bg-slate-200 px-2 py-0.5">Baja: {x.motivo_baja}</span>}
                {aislado ? (
                  <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-900">Cubículo aislado</span>
                ) : (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">Serología negativa</span>
                )}
                {serologiaVencida(x.serologia_fecha) && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">Repetir serología</span>}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Exp. {p.expediente} · {p.sexo} · {p.fecha_nacimiento ? `${edad(p.fecha_nacimiento)} años` : ''}
              {p.telefono ? ` · Cel. ${p.telefono}` : ''}
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={claseTarjeta}>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Programa, acceso vascular y serología</h2>
              <FormAccion accion={guardarPrograma.bind(null, id)} boton="Guardar" className="grid grid-cols-2 gap-3">
                <label className={claseEtiqueta}>
                  Tipo
                  <select name="tipo" defaultValue={x.tipo} disabled={!editable} className={claseCampo}>
                    <option value="cronico">Crónico (externo)</option>
                    <option value="agudo">Agudo (internado)</option>
                  </select>
                </label>
                <label className={claseEtiqueta}>
                  Peso seco (kg)
                  <input name="peso_seco" inputMode="decimal" defaultValue={x.peso_seco ?? ''} disabled={!editable} className={claseCampo} />
                </label>
                <label className={claseEtiqueta}>
                  Acceso vascular
                  <select name="acceso_tipo" defaultValue={x.acceso_tipo ?? ''} disabled={!editable} className={claseCampo}>
                    <option value="">—</option>
                    {Object.entries(ACCESOS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={claseEtiqueta}>
                  Sitio del acceso
                  <input name="acceso_sitio" defaultValue={x.acceso_sitio ?? ''} placeholder="Radiocefálica izquierda…" disabled={!editable} className={claseCampo} />
                </label>
                <label className={claseEtiqueta}>
                  Fecha del acceso
                  <input name="acceso_fecha" type="date" defaultValue={x.acceso_fecha ?? ''} disabled={!editable} className={claseCampo} />
                </label>
                <span />
                {(['hbsag', 'vhc', 'vih'] as const).map((k) => (
                  <label key={k} className={claseEtiqueta}>
                    {k === 'hbsag' ? 'HBsAg (hepatitis B)' : k === 'vhc' ? 'Anti-VHC (hepatitis C)' : 'VIH'}
                    <select name={k} defaultValue={x[k]} disabled={!editable} className={claseCampo}>
                      {Object.entries(SEROLOGIA).map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className={claseEtiqueta}>
                  Fecha de la serología
                  <input name="serologia_fecha" type="date" defaultValue={x.serologia_fecha ?? ''} disabled={!editable} className={claseCampo} />
                </label>
                <label className={`${claseEtiqueta} col-span-2`}>
                  Otra infección contagiosa (obliga al cubículo aislado)
                  <input name="otra_infeccion" defaultValue={x.otra_infeccion ?? ''} disabled={!editable} className={claseCampo} />
                </label>
                <label className={`${claseEtiqueta} col-span-2`}>
                  Notas
                  <textarea name="notas" rows={2} defaultValue={x.notas ?? ''} disabled={!editable} className={claseCampo} />
                </label>
                <p className="col-span-2 text-xs text-slate-500">
                  Con cualquier marcador positivo o pendiente, el paciente solo se programa en el cubículo aislado; con todos negativos, nunca en él.
                </p>
              </FormAccion>
            </section>

            <div className="space-y-4">
              <section className={claseTarjeta}>
                <h2 className="mb-1 text-sm font-semibold text-slate-800">Prescripción (nefrología)</h2>
                {x.prescrita_en && <p className="mb-2 text-xs text-slate-500">Actualizada {fechaHora(x.prescrita_en)}</p>}
                <FormAccion accion={guardarPrescripcion.bind(null, id)} boton="Guardar prescripción" className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ['duracion_min', 'Duración (min)', '240'],
                      ['qb', 'Qb sangre (mL/min)', '350'],
                      ['qd', 'Qd dializante (mL/min)', '500'],
                      ['uf_max_ml', 'UF máxima (mL)', '3500'],
                      ['filtro', 'Filtro / dializador', 'F8 HPS'],
                      ['heparina', 'Anticoagulación', 'Heparina 5000 UI'],
                      ['bano_k', 'Baño: potasio', '2 mEq/L'],
                      ['bano_ca', 'Baño: calcio', '2.5 mEq/L'],
                    ] as const
                  ).map(([k, t, ej]) => (
                    <label key={k} className={claseEtiqueta}>
                      {t}
                      <input name={k} defaultValue={String(pr[k] ?? '')} placeholder={ej} disabled={!esMedico} className={claseCampo} />
                    </label>
                  ))}
                  <label className={`${claseEtiqueta} col-span-2`}>
                    Indicaciones
                    <input name="indicaciones" defaultValue={String(pr.indicaciones ?? '')} disabled={!esMedico} className={claseCampo} />
                  </label>
                  {!esMedico && <p className="col-span-2 text-xs text-slate-500">Solo nefrología modifica la prescripción.</p>}
                </FormAccion>
              </section>

              <section className={claseTarjeta}>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Horario fijo semanal</h2>
                <FormAccion accion={fijarHorario.bind(null, id)} boton="Guardar horario fijo" className="space-y-2">
                  <div className="flex flex-wrap gap-3 text-sm">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <label key={d} className="flex items-center gap-1">
                        <input type="checkbox" name="dias" value={d} defaultChecked={fijos.some((f) => f.dia_semana === d)} disabled={!editable} />
                        {DIAS[d]}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className={claseEtiqueta}>
                      Horario
                      <select name="horario" defaultValue={fijos[0]?.horario?.clave ?? '07'} disabled={!editable} className={claseCampo}>
                        {((hor ?? []) as { clave: string; inicio: string }[]).map((hh) => (
                          <option key={hh.clave} value={hh.clave}>
                            {hh.inicio.slice(0, 5)} h
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={claseEtiqueta}>
                      Máquina habitual
                      <select name="maquina" defaultValue={fijos[0]?.maquina?.clave ?? ''} disabled={!editable} className={claseCampo}>
                        <option value="">Cualquiera libre</option>
                        {maquinas.map((m) => (
                          <option key={m.clave} value={m.clave}>
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </FormAccion>
              </section>
            </div>
          </div>

          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Sesiones ({sesiones.length})</h2>
            {sesiones.length === 0 ? (
              <p className="text-sm text-slate-500">Sin sesiones.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Fecha</th>
                    <th>Máquina</th>
                    <th>Estado</th>
                    <th>Peso pre → post</th>
                    <th>UF meta / real</th>
                    <th>Complicaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sesiones.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="py-1.5">
                        <Link href={`/hemodialisis/sesion/${s.id}`} className="text-sky-700 hover:underline">
                          {fecha(s.fecha)} {s.horario} h
                        </Link>
                      </td>
                      <td>{s.maquina}</td>
                      <td>
                        <span className={`rounded px-1 text-xs ${ESTADO_SESION[s.estado]?.color}`}>{ESTADO_SESION[s.estado]?.texto}</span>
                      </td>
                      <td className="text-slate-600">{s.peso_pre ? `${s.peso_pre} → ${s.peso_post ?? '…'} kg` : '—'}</td>
                      <td className="text-slate-600">
                        {s.uf_meta_ml != null ? `${s.uf_meta_ml.toLocaleString('es-MX')}` : '—'} / {s.uf_real_ml != null ? `${s.uf_real_ml.toLocaleString('es-MX')} mL` : '—'}
                      </td>
                      <td className="text-xs text-slate-600">{s.complicaciones?.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {editable && (
            <details className={claseTarjeta}>
              <summary className="cursor-pointer text-sm text-slate-700">{x.activo ? 'Dar de baja del programa' : 'Reactivar en el programa'}</summary>
              <FormAccion accion={darDeBaja.bind(null, id, !x.activo)} boton={x.activo ? 'Dar de baja' : 'Reactivar'} variante="secundario" className="mt-2 flex flex-wrap items-end gap-2">
                {x.activo && (
                  <label className={`${claseEtiqueta} flex-1`}>
                    Motivo (trasplante, cambio de unidad, defunción, diálisis peritoneal…)
                    <input name="motivo_baja" required className={claseCampo} />
                  </label>
                )}
              </FormAccion>
            </details>
          )}
        </div>
      </main>
    </>
  )
}
