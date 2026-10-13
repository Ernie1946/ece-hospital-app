import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { SinAlta } from '@/components/SinAlta'
import { BotonImprimir } from '@/components/BotonImprimir'
import { edad, fecha, fechaHora } from '@/lib/formato'
import { hora } from '@/lib/gabinetes'
import {
  ACCESOS,
  CIERRE,
  EVENTO,
  PAPEL,
  PULSO,
  SEDACION,
  SITIO,
  TIPO_MATERIAL,
  VERIFICACION,
  nombreProc,
  type Caso,
  type Material,
  type Participante,
  type Vigilancia,
} from '@/lib/hemodinamia'

// Informe imprimible del procedimiento de hemodinamia
export default async function ImprimirHemoPage({ params }: PageProps<'/hemodinamia/caso/[id]/imprimir'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const { id } = await params
  const supabase = await crearClienteServidor()
  const [{ data }, { data: part }, { data: mat }, { data: vig }] = await Promise.all([
    supabase.schema('clinico').from('v_hemo_caso').select('*').eq('id', id).maybeSingle(),
    supabase.schema('clinico').from('v_hemo_participante').select('*').eq('caso_id', id),
    supabase.schema('clinico').from('hemo_material').select('*').eq('caso_id', id).eq('anulado', false).order('registrado_en'),
    supabase.schema('clinico').from('v_hemo_vigilancia').select('*').eq('caso_id', id).order('hora'),
  ])
  const c = data as Caso | null
  if (!c) notFound()
  const equipo = (part ?? []) as Participante[]
  const materiales = (mat ?? []) as Material[]
  const vigilancia = (vig ?? []) as Vigilancia[]
  const d = c.datos ?? {}
  const F = ({ t, v }: { t: string; v: React.ReactNode }) => (
    <p>
      <span className="font-semibold">{t}:</span> {v || '—'}
    </p>
  )
  const firmante = equipo.find((e) => e.usuario_id === c.firmado_por)

  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-sm text-slate-900">
      <div className="mb-3 flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-2">
        <div>
          <h1 className="text-lg font-semibold">Informe de procedimiento de hemodinamia</h1>
          <p className="text-base">{nombreProc(c)}</p>
          <p className="text-xs text-slate-500">
            {c.firmado_en ? `Firmado ${fechaHora(c.firmado_en)}` : 'BORRADOR · sin firma del hemodinamista'} · Impreso {fechaHora(new Date().toISOString())}
          </p>
        </div>
        <BotonImprimir />
      </div>

      <section className="mb-3 grid grid-cols-2 gap-x-6">
        <F t="Paciente" v={c.paciente} />
        <F t="Expediente" v={c.expediente} />
        <F t="Sexo / edad" v={`${c.sexo}${c.fecha_nacimiento ? ` · ${edad(c.fecha_nacimiento)} años (${fecha(c.fecha_nacimiento)})` : ''}`} />
        <F t="Fecha" v={fechaHora(c.en_sala_en ?? c.inicio)} />
        <F t="Indicación" v={c.indicacion} />
        <F t="Prioridad" v={c.prioridad === 'urgente' ? 'Urgente' : 'Electivo'} />
        <F t="Alergias" v={c.alergias ?? 'Negadas / no registradas'} />
        <F t="Peso / creatinina" v={`${c.peso_kg ?? '—'} kg · ${c.creatinina ?? '—'} mg/dL${c.contraste_max_ml ? ` · contraste máx. ${c.contraste_max_ml} mL` : ''}`} />
      </section>

      <section className="mb-3">
        <h2 className="mb-1 border-b border-slate-400 font-semibold">Equipo</h2>
        <div className="grid grid-cols-2 gap-x-6">
          {equipo.map((e) => (
            <p key={e.usuario_id + e.papel}>
              <span className="font-semibold">{PAPEL[e.papel]}:</span> {e.nombre}
              {e.cedula_profesional ? ` · Céd. ${e.cedula_profesional}` : ''}
            </p>
          ))}
        </div>
      </section>

      <section className="mb-3">
        <h2 className="mb-1 border-b border-slate-400 font-semibold">Verificación previa y tiempos</h2>
        <p>
          {VERIFICACION.map((v) => `${c.verificacion?.[v.clave] ? '☑' : '☐'} ${v.texto.split(' (')[0]}`).join('   ')}
        </p>
        <p className="mt-1">
          Entrada a sala {hora(c.en_sala_en ?? c.inicio)} · inicio {c.inicio_proc_en ? hora(c.inicio_proc_en) : '—'} · fin {c.fin_proc_en ? hora(c.fin_proc_en) : '—'} ·
          salida {c.salida_sala_en ? hora(c.salida_sala_en) : '—'}
        </p>
      </section>

      <section className="mb-3 space-y-1">
        <h2 className="mb-1 border-b border-slate-400 font-semibold">Procedimiento</h2>
        <div className="grid grid-cols-2 gap-x-6">
          <F t="Acceso" v={d.acceso ? ACCESOS[d.acceso] : null} />
          <F t="Introductor" v={d.introductor_fr ? `${d.introductor_fr} Fr` : null} />
          <F t="Sedación / anestesia" v={d.sedacion ? SEDACION[d.sedacion] : null} />
          <F t="Heparina" v={d.heparina_ui ? `${d.heparina_ui} UI` : null} />
        </div>
        <F t="Hallazgos" v={<span className="whitespace-pre-line">{d.hallazgos}</span>} />
        <F t="Procedimiento realizado" v={<span className="whitespace-pre-line">{d.procedimiento_realizado}</span>} />
        <F t="Resultado" v={d.resultado} />
        <F t="Complicaciones" v={[...(d.complicaciones ?? []), d.complicaciones_nota].filter(Boolean).join(' · ')} />
        <F t="Cierre del acceso" v={d.cierre ? CIERRE[d.cierre] : null} />
        <F t="Plan" v={<span className="whitespace-pre-line">{d.plan}</span>} />
      </section>

      <section className="mb-3">
        <h2 className="mb-1 border-b border-slate-400 font-semibold">Radiación y contraste</h2>
        <p>
          Contraste: {c.contraste_ml ?? '—'} mL {c.contraste_tipo ?? ''} · Fluoroscopia: {c.fluoro_min ?? '—'} min · Kerma aire: {c.kerma_mgy ?? '—'} mGy · DAP:{' '}
          {c.dap ?? '—'} Gy·cm²
        </p>
      </section>

      <section className="mb-3">
        <h2 className="mb-1 border-b border-slate-400 font-semibold">Materiales e implantes</h2>
        {materiales.length === 0 ? (
          <p>Sin materiales registrados.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300">
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Medida</th>
                <th>Lote</th>
                <th>Serie</th>
                <th>Cant.</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td>
                    {TIPO_MATERIAL[m.tipo]}
                    {m.implante ? ' (implante)' : ''}
                  </td>
                  <td>
                    {m.descripcion}
                    {m.marca ? ` · ${m.marca}` : ''}
                    {m.sitio ? ` · ${m.sitio}` : ''}
                  </td>
                  <td>{m.medida}</td>
                  <td className="font-mono">{m.lote}</td>
                  <td className="font-mono">{m.serie}</td>
                  <td>{m.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {vigilancia.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-1 border-b border-slate-400 font-semibold">Recuperación</h2>
          <table className="w-full text-left text-xs">
            <tbody>
              {vigilancia.map((v) => (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="font-mono">{hora(v.hora)}</td>
                  <td>{EVENTO[v.evento]}</td>
                  <td>{v.ta_sis ? `TA ${v.ta_sis}/${v.ta_dia ?? '—'}` : ''}</td>
                  <td>{v.fc ? `FC ${v.fc}` : ''}</td>
                  <td>{v.spo2 ? `SpO₂ ${v.spo2}` : ''}</td>
                  <td>{v.sitio ? SITIO[v.sitio] : ''}</td>
                  <td>{v.pulso ? `Pulso ${PULSO[v.pulso].toLowerCase()}` : ''}</td>
                  <td>{v.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.terminado_en && (
            <p className="mt-1">
              Alta de recuperación {fechaHora(c.terminado_en)} · destino: {c.destino}
            </p>
          )}
        </section>
      )}

      <div className="mt-10 grid grid-cols-2 gap-10 text-center text-xs">
        <div className="border-t border-slate-800 pt-1">
          {c.firmado_en ? `Dr(a). ${c.firmado_por_nombre}${firmante?.cedula_profesional ? ` · Céd. ${firmante.cedula_profesional}` : ''}` : 'Hemodinamista'}
          <br />
          Firma electrónica {c.firmado_en ? fechaHora(c.firmado_en) : 'pendiente'}
        </div>
        <div className="border-t border-slate-800 pt-1">Firma autógrafa</div>
      </div>
    </main>
  )
}
