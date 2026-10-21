import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerPerfil } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseTarjeta } from '@/lib/estilos'
import { fechaHora } from '@/lib/formato'
import { pesos } from '@/lib/catalogos'
import { asignarLista, cancelarDesdeCuenta } from '../../acciones'

type Cargo = {
  id: number
  fecha_servicio: string
  creado_en: string
  clave: string
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  importe: number
  precio_pendiente: boolean
  origen: string
  lote: string | null
  serie: string | null
  cancelado: boolean
  motivo_cancelacion: string | null
  area_nombre: string | null
  lista_nombre: string | null
  iva: string
  creado_por_nombre: string
}

// Estado de cuenta del paciente (Caja, Admisión, Costos)
export default async function CuentaPacientePage({ params }: PageProps<'/cargos/cuenta/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const { id } = await params
  const supabase = await crearClienteServidor()
  const [cuentaQ, cargosQ, listasQ, listaQ, ecQ] = await Promise.all([
    supabase.schema('cuenta').from('v_estado_cuenta').select('*').eq('encuentro_id', id).maybeSingle(),
    supabase.schema('cuenta').from('v_cargo').select('*').eq('encuentro_id', id).order('fecha_servicio').order('creado_en'),
    supabase.schema('catalogo').from('lista_precios').select('clave, nombre').eq('activa', true).order('es_base', { ascending: false }),
    supabase.schema('cuenta').rpc('lista_de', { p_encuentro: id }),
    supabase.schema('cuenta').from('estado_cuenta').select('lista_id').eq('encuentro_id', id).maybeSingle(),
  ])
  const cuenta = cuentaQ.data as { folio: string; expediente: string; paciente: string; aseguradora: string | null; numero_poliza: string | null; estado: string; monto_autorizado: number | null; total_cargos: number | null; alerta_monto: boolean } | null
  if (!cuenta) notFound()
  const cargos = (cargosQ.data ?? []) as Cargo[]
  const listas = (listasQ.data ?? []) as { clave: string; nombre: string }[]
  const { data: listaActual } = await supabase.schema('catalogo').from('lista_precios').select('clave, nombre').eq('id', listaQ.data as number).maybeSingle()
  const asignada = (ecQ.data as { lista_id: number | null } | null)?.lista_id != null
  const puedeLista = ['caja', 'admision', 'costos', 'admin_sistema'].includes(perfil.rol) && cuenta.estado !== 'cerrada'
  const puedeCancelar = ['caja', 'costos', 'admin_sistema'].includes(perfil.rol) && cuenta.estado !== 'cerrada'

  const vivos = cargos.filter((c) => !c.cancelado)
  const subtotal = vivos.reduce((s, c) => s + Number(c.importe), 0)
  const iva = vivos.filter((c) => c.iva === '16').reduce((s, c) => s + Number(c.importe) * 0.16, 0)
  const pendientes = vivos.filter((c) => c.precio_pendiente).length
  const porArea = new Map<string, number>()
  for (const c of vivos) porArea.set(c.area_nombre ?? 'Otros', (porArea.get(c.area_nombre ?? 'Otros') ?? 0) + Number(c.importe))

  return (
    <>
      <Encabezado perfil={perfil} activo="cargos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/cargos" className="text-sm text-sky-700 hover:underline">
            ← Cargos
          </Link>
          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Estado de cuenta · {cuenta.paciente}</h1>
              <span className={`rounded px-2 py-0.5 text-xs ${cuenta.estado === 'cerrada' ? 'bg-slate-200' : 'bg-emerald-100 text-emerald-800'}`}>Cuenta {cuenta.estado}</span>
            </div>
            <p className="text-sm text-slate-600">
              Exp. {cuenta.expediente} · Folio {cuenta.folio}
              {cuenta.aseguradora ? ` · ${cuenta.aseguradora} póliza ${cuenta.numero_poliza}` : ' · Particular'}
              {cuenta.monto_autorizado ? ` · Autorizado ${pesos(cuenta.monto_autorizado)}` : ''}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase text-slate-500">Subtotal</p>
                <p className="text-xl font-semibold tabular-nums">{pesos(subtotal)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase text-slate-500">IVA estimado</p>
                <p className="text-xl font-semibold tabular-nums">{pesos(iva)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase text-slate-500">Total estimado</p>
                <p className={`text-xl font-semibold tabular-nums ${cuenta.alerta_monto ? 'text-red-700' : ''}`}>{pesos(subtotal + iva)}</p>
                {cuenta.alerta_monto && <p className="text-xs text-red-700">Rebasa el 90 % de lo autorizado</p>}
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase text-slate-500">Precios pendientes</p>
                <p className={`text-xl font-semibold ${pendientes ? 'text-amber-700' : ''}`}>{pendientes}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Por área: {Array.from(porArea.entries()).map(([a, t]) => `${a} ${pesos(t)}`).join(' · ') || '—'}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
              <span>
                Lista de precios: <strong>{listaActual?.nombre ?? 'Particular'}</strong>
                {!asignada && <span className="text-xs text-slate-500"> (automática)</span>}
              </span>
              {puedeLista && (
                <FormAccion accion={asignarLista.bind(null, id)} boton="Cambiar lista" variante="secundario" className="flex flex-wrap items-end gap-2">
                  <select name="lista" aria-label="Lista de precios" defaultValue={asignada ? listaActual?.clave : ''} className={`${claseCampo} mt-0 w-auto`}>
                    <option value="">Automática (según póliza)</option>
                    {listas.map((l) => (
                      <option key={l.clave} value={l.clave}>{l.nombre}</option>
                    ))}
                  </select>
                </FormAccion>
              )}
            </div>
            {puedeLista && <p className="text-xs text-slate-500">El cambio de lista aplica a los cargos que siguen; los ya registrados conservan su precio.</p>}
          </section>

          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800">Cargos ({vivos.length})</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm" aria-label="Cargos de la cuenta">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1 pr-2">Fecha</th>
                    <th className="pr-2">Concepto</th>
                    <th className="pr-2">Área</th>
                    <th className="pr-2 text-right">Cant.</th>
                    <th className="pr-2 text-right">Precio</th>
                    <th className="pr-2 text-right">Importe</th>
                    <th className="pr-2">Registró</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cargos.map((c) => (
                    <tr key={c.id} className={`border-t border-slate-100 align-top ${c.cancelado ? 'text-slate-400' : ''}`}>
                      <td className="py-1 pr-2 whitespace-nowrap text-xs">{c.fecha_servicio}</td>
                      <td className="pr-2">
                        <span className={c.cancelado ? 'line-through' : ''}>{c.descripcion}</span>
                        {(c.lote || c.serie) && <span className="block text-xs text-slate-500">Lote {c.lote ?? '—'} · Serie {c.serie ?? '—'}</span>}
                        {c.cancelado && <span className="block text-xs">Cancelado: {c.motivo_cancelacion}</span>}
                      </td>
                      <td className="pr-2 text-xs">{c.area_nombre}</td>
                      <td className="pr-2 text-right tabular-nums">{Number(c.cantidad)}</td>
                      <td className="pr-2 text-right tabular-nums">{c.precio_pendiente ? <span className="text-xs text-amber-800">pendiente</span> : pesos(c.precio_unitario)}</td>
                      <td className="pr-2 text-right tabular-nums">{c.precio_pendiente ? '—' : pesos(c.importe)}</td>
                      <td className="pr-2 text-xs text-slate-500">
                        {c.creado_por_nombre || 'Sistema'}
                        <span className="block">{fechaHora(c.creado_en)}</span>
                      </td>
                      <td>
                        {puedeCancelar && !c.cancelado && (
                          <details>
                            <summary className="cursor-pointer text-xs text-red-700">Cancelar</summary>
                            <FormAccion accion={cancelarDesdeCuenta.bind(null, id)} boton="Cancelar cargo" variante="secundario" className="mt-1 space-y-1">
                              <input type="hidden" name="id" value={c.id} />
                              <input name="motivo" required placeholder="Motivo" className={claseCampo} />
                            </FormAccion>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
