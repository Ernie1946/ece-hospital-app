import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloSistemas } from '@/components/SoloSistemas'
import { BotonImprimir } from '@/components/BotonImprimir'
import { claseTarjeta } from '@/lib/estilos'
import { fecha, fechaHora } from '@/lib/formato'
import { ESTADO_PRIVILEGIO, GRUPO_PRIVILEGIO, type PrivilegioMedico } from '@/lib/privilegios'

type Fuera = { id: string; inicio_programado: string; procedimiento: string; cie9mc: string | null; justificacion_privilegio: string; cirujano: string; paciente: string; expediente: string; estado: string }

// Padrón de privilegios para Dirección Médica: vigentes, por vencer, vencidos y cirugías fuera de privilegio
export default async function PadronPrivilegiosPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!esSistemas(perfil))
    return (
      <>
        <Encabezado perfil={perfil} activo="personal" />
        <SoloSistemas />
      </>
    )
  const supabase = await crearClienteServidor()
  const [{ data: pr }, { data: fu }] = await Promise.all([
    supabase.schema('seguridad').from('v_usuario_privilegio').select('*').is('revocado_en', null).order('medico').order('grupo'),
    supabase.schema('clinico').from('v_cirugia_fuera_privilegio').select('*').order('inicio_programado', { ascending: false }).limit(100),
  ])
  const privilegios = (pr ?? []) as PrivilegioMedico[]
  const fuera = (fu ?? []) as Fuera[]
  const alerta = privilegios.filter((p) => p.estado === 'vencido' || p.estado === 'por_vencer')
  const porMedico = new Map<string, PrivilegioMedico[]>()
  for (const p of privilegios) porMedico.set(p.usuario_id, [...(porMedico.get(p.usuario_id) ?? []), p])

  return (
    <>
      <Encabezado perfil={perfil} activo="personal" />
      <main className="flex-1 bg-slate-100 print:bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <Link href="/personal" className="text-sm text-sky-700 hover:underline print:hidden">
                ← Personal
              </Link>
              <h1 className="text-xl font-semibold text-slate-900">Padrón de privilegios médicos</h1>
              <p className="text-xs text-slate-500">Impreso {fechaHora(new Date().toISOString())}</p>
            </div>
            <span className="flex items-center gap-2 print:hidden">
              <Link href="/personal/privilegios/catalogo" className="rounded-lg border border-sky-700 bg-white px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-50">
                Catálogo de privilegios
              </Link>
              <Link href="/personal/privilegios/importar" className="rounded-lg border border-sky-700 bg-white px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-50">
                Cargar desde Excel
              </Link>
              <BotonImprimir />
            </span>
          </div>

          <section className={claseTarjeta} aria-label="Vencimientos">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Vencidos o por vencer (60 días) · {alerta.length}</h2>
            {alerta.length === 0 ? (
              <p className="text-sm text-slate-500">Ninguno.</p>
            ) : (
              <ul className="text-sm">
                {alerta.map((p) => (
                  <li key={p.id}>
                    <span className={`rounded px-1 text-xs ${ESTADO_PRIVILEGIO[p.estado]?.color}`}>{ESTADO_PRIVILEGIO[p.estado]?.texto}</span>{' '}
                    <Link href={`/personal/${p.usuario_id}`} className="text-sky-700 hover:underline">
                      {p.medico}
                    </Link>{' '}
                    · {p.privilegio} · vence {fecha(p.vigencia_hasta)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={claseTarjeta} aria-label="Fuera de privilegio">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Cirugías de urgencia fuera de privilegio · {fuera.length}</h2>
            {fuera.length === 0 ? (
              <p className="text-sm text-slate-500">Ninguna.</p>
            ) : (
              <ul className="text-sm">
                {fuera.map((f) => (
                  <li key={f.id}>
                    {fechaHora(f.inicio_programado)} · <strong>{f.cirujano}</strong> · {f.procedimiento} {f.cie9mc ? `(CIE-9-MC ${f.cie9mc})` : ''} · {f.paciente} (exp.{' '}
                    {f.expediente}) · <span className="text-amber-900">{f.justificacion_privilegio}</span>
                    {f.estado === 'cancelada' ? ' · cancelada' : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={claseTarjeta} aria-label="Padrón">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Médicos con privilegios · {porMedico.size}</h2>
            {porMedico.size === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay privilegios registrados.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Médico</th>
                    <th>Privilegios</th>
                  </tr>
                </thead>
                <tbody>
                  {[...porMedico.values()].map((ps) => (
                    <tr key={ps[0].usuario_id} className="border-t border-slate-100 align-top">
                      <td className="py-1.5 pr-3">
                        <Link href={`/personal/${ps[0].usuario_id}`} className="font-medium text-sky-700 hover:underline">
                          {ps[0].medico}
                        </Link>
                        <span className="block font-mono text-xs text-slate-500">{ps[0].usuario}</span>
                      </td>
                      <td>
                        {Object.keys(GRUPO_PRIVILEGIO)
                          .filter((g) => ps.some((p) => p.grupo === g))
                          .map((g) => (
                            <p key={g}>
                              <span className="text-slate-500">{GRUPO_PRIVILEGIO[g]}: </span>
                              {ps
                                .filter((p) => p.grupo === g)
                                .map((p) => `${p.privilegio}${p.vigencia_hasta ? ` (hasta ${fecha(p.vigencia_hasta)})` : ''}${p.estado === 'vencido' ? ' — VENCIDO' : ''}`)
                                .join(' · ')}
                            </p>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
