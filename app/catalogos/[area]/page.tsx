import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerPerfil, esCostos } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { ImportarArticulos } from '@/components/ImportarArticulos'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { TIPOS_ARTICULO, pesos, type Articulo } from '@/lib/catalogos'
import { etiquetaRol } from '@/lib/roles'
import { asignarResponsable, guardarArticulo, procesarArticulos, proponerPrecio } from '../acciones'

const POR_PAGINA = 100

function CamposArticulo({ a }: { a?: Articulo }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <label className={claseEtiqueta}>
        Clave
        <input name="clave" required defaultValue={a?.clave} readOnly={!!a} className={`${claseCampo} uppercase ${a ? 'bg-slate-50' : ''}`} />
      </label>
      <label className={`${claseEtiqueta} sm:col-span-3`}>
        Descripción
        <input name="descripcion" required maxLength={200} defaultValue={a?.descripcion} className={claseCampo} />
      </label>
      <label className={claseEtiqueta}>
        Código de barras
        <input name="codigo_barras" defaultValue={a?.codigo_barras ?? ''} className={claseCampo} />
      </label>
      <label className={claseEtiqueta}>
        Unidad
        <input name="unidad" defaultValue={a?.unidad ?? 'pieza'} className={claseCampo} />
      </label>
      <label className={claseEtiqueta}>
        Tipo
        <select name="tipo" defaultValue={a?.tipo ?? 'insumo'} className={claseCampo}>
          {TIPOS_ARTICULO.map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
      </label>
      <label className={claseEtiqueta}>
        Precio (sin IVA)
        <input name="precio" inputMode="decimal" required={!a} defaultValue={a ? (a.precio_propuesto ?? a.precio ?? '') : ''} className={claseCampo} />
      </label>
      <label className={claseEtiqueta}>
        IVA
        <select name="iva" defaultValue={a?.iva ?? '16'} className={claseCampo}>
          <option value="16">16 %</option>
          <option value="0">0 %</option>
          <option value="exento">Exento</option>
        </select>
      </label>
      <label className={claseEtiqueta}>
        Clave SAT
        <input name="clave_sat" inputMode="numeric" maxLength={8} defaultValue={a?.clave_sat ?? ''} className={claseCampo} />
      </label>
      <label className={claseEtiqueta}>
        Unidad SAT
        <input name="unidad_sat" maxLength={4} defaultValue={a?.unidad_sat ?? ''} className={`${claseCampo} uppercase`} />
      </label>
      <div className="space-y-1 self-end pb-1 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requiere_lote" defaultChecked={a?.requiere_lote} /> Requiere lote / serie
        </label>
        {a && (
          <label className="flex items-center gap-2">
            <select name="activo" defaultValue={a.activo ? 'on' : 'off'} className="rounded border border-slate-300 px-1 text-sm">
              <option value="on">Activo</option>
              <option value="off">Retirado</option>
            </select>
          </label>
        )}
      </div>
    </div>
  )
}

export default async function CatalogoAreaPage({ params, searchParams }: PageProps<'/catalogos/[area]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const { area: claveArea } = await params
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const pagina = Math.max(1, Number(sp.p) || 1)
  const supabase = await crearClienteServidor()
  const { data: area } = await supabase.schema('catalogo').from('area_cargo').select('id, clave, nombre, activa').eq('clave', claveArea.toUpperCase()).maybeSingle()
  if (!area) notFound()
  const costos = esCostos(perfil)
  const puede = costos || perfil.catalogos.includes(Number(area.id))

  let consulta = supabase
    .schema('catalogo')
    .from('v_articulo')
    .select('id, clave, descripcion, tipo, unidad, codigo_barras, iva, clave_sat, unidad_sat, requiere_lote, activo, estado, area_cargo_id, area_clave, area_nombre, precio, precio_propuesto, propuesto_desde', { count: 'exact' })
    .eq('area_cargo_id', area.id)
  if (q) {
    const t = q.replace(/[%,()]/g, '')
    consulta = consulta.or(`descripcion.ilike.%${t}%,clave.ilike.%${t}%,codigo_barras.eq.${t}`)
  }
  const [{ data, count }, responsablesQ, usuariosQ, listasQ] = await Promise.all([
    consulta.order('activo', { ascending: false }).order('descripcion').range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    supabase.schema('catalogo').from('area_cargo_responsable').select('usuario_id').eq('area_cargo_id', area.id),
    costos ? supabase.schema('seguridad').from('usuario').select('id, nombre, primer_apellido, rol').eq('activo', true).order('primer_apellido') : Promise.resolve({ data: [] }),
    costos ? supabase.schema('catalogo').from('lista_precios').select('clave, nombre').eq('activa', true).order('es_base', { ascending: false }) : Promise.resolve({ data: [] }),
  ])
  const articulos = (data ?? []) as Articulo[]
  const usuarios = (usuariosQ.data ?? []) as { id: string; nombre: string; primer_apellido: string; rol: string }[]
  const responsables = new Set(((responsablesQ.data ?? []) as { usuario_id: string }[]).map((r) => r.usuario_id))
  const listas = (listasQ.data ?? []) as { clave: string; nombre: string }[]
  const paginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA))
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })

  return (
    <>
      <Encabezado perfil={perfil} activo="catalogos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/catalogos" className="text-sm text-sky-700 hover:underline">
            ← Catálogos
          </Link>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              {area.nombre} <span className="font-mono text-sm text-slate-400">{area.clave}</span>
            </h1>
            <span className="text-sm text-slate-600">{count ?? 0} artículo(s)</span>
          </div>
          {!puede && <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">No eres responsable de este catálogo; solo puedes consultarlo.</p>}

          <section className={claseTarjeta}>
            <form className="flex flex-wrap gap-2" role="search">
              <input name="q" defaultValue={q} placeholder="Buscar por descripción, clave o código de barras" aria-label="Buscar artículo" className={`${claseCampo} mt-0 max-w-md`} />
              <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Buscar</button>
            </form>
            {articulos.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{q ? 'Sin resultados.' : 'El catálogo está vacío: agrega artículos abajo o sube un Excel.'}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm" aria-label="Artículos">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-2">Clave</th>
                      <th className="pr-2">Descripción</th>
                      <th className="pr-2">Código de barras</th>
                      <th className="pr-2">Unidad</th>
                      <th className="pr-2 text-right">Precio</th>
                      <th className="pr-2">IVA</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {articulos.map((a) => (
                      <tr key={a.id} className={`border-t border-slate-100 align-top ${a.activo ? '' : 'text-slate-400'}`}>
                        <td className="py-1.5 pr-2 font-mono text-xs">{a.clave}</td>
                        <td className="pr-2">
                          {a.descripcion}
                          {a.requiere_lote && <span className="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-600">lote/serie</span>}
                          {!a.activo && <span className="ml-1 rounded bg-slate-100 px-1 text-xs">retirado</span>}
                          {puede && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-sky-700">Editar</summary>
                              <FormAccion accion={guardarArticulo.bind(null, area.clave)} boton="Guardar cambios" variante="secundario" className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <CamposArticulo a={a} />
                              </FormAccion>
                              <FormAccion accion={proponerPrecio.bind(null, area.clave)} boton={costos ? 'Fijar precio' : 'Proponer precio con fecha'} variante="secundario" className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4 sm:items-end">
                                <input type="hidden" name="concepto" value={a.id} />
                                <label className={claseEtiqueta}>
                                  Precio
                                  <input name="precio" required inputMode="decimal" className={claseCampo} />
                                </label>
                                <label className={claseEtiqueta}>
                                  Vigente desde
                                  <input name="vigente_desde" type="date" min={hoy} defaultValue={hoy} className={claseCampo} />
                                </label>
                                {costos && (
                                  <label className={claseEtiqueta}>
                                    Lista
                                    <select name="lista" className={claseCampo}>
                                      {listas.map((l) => (
                                        <option key={l.clave} value={l.clave}>{l.nombre}</option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                                <label className={claseEtiqueta}>
                                  Motivo
                                  <input name="motivo" placeholder="Aumento del proveedor" className={claseCampo} />
                                </label>
                              </FormAccion>
                            </details>
                          )}
                        </td>
                        <td className="pr-2 font-mono text-xs">{a.codigo_barras ?? '—'}</td>
                        <td className="pr-2">{a.unidad}</td>
                        <td className="pr-2 text-right tabular-nums">
                          {a.precio === null ? <span className="text-slate-400">sin precio</span> : pesos(a.precio)}
                          {a.precio_propuesto !== null && (
                            <span className="block text-xs text-violet-700">
                              {pesos(a.precio_propuesto)} por autorizar{a.propuesto_desde && a.propuesto_desde > hoy ? ` (desde ${a.propuesto_desde})` : ''}
                            </span>
                          )}
                        </td>
                        <td className="pr-2">{a.iva === 'exento' ? 'Exento' : `${a.iva} %`}</td>
                        <td>{a.estado === 'pendiente' && <span className="rounded bg-violet-100 px-1.5 text-xs text-violet-800">nuevo</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {paginas > 1 && (
              <nav className="mt-2 flex gap-2 text-sm" aria-label="Páginas">
                {pagina > 1 && <Link href={`?${new URLSearchParams({ q, p: String(pagina - 1) })}`} className="text-sky-700 hover:underline">← Anterior</Link>}
                <span className="text-slate-500">Página {pagina} de {paginas}</span>
                {pagina < paginas && <Link href={`?${new URLSearchParams({ q, p: String(pagina + 1) })}`} className="text-sky-700 hover:underline">Siguiente →</Link>}
              </nav>
            )}
          </section>

          {puede && (
            <>
              <section className={claseTarjeta}>
                <h2 className="text-sm font-semibold text-slate-800">Nuevo artículo</h2>
                <FormAccion accion={guardarArticulo.bind(null, area.clave)} boton="Dar de alta" className="mt-2 space-y-3">
                  <CamposArticulo />
                </FormAccion>
              </section>
              <section className={claseTarjeta}>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Cargar o actualizar con Excel</h2>
                <ImportarArticulos area={area.clave} procesar={procesarArticulos.bind(null, area.clave)} />
              </section>
            </>
          )}

          {costos && (
            <section className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800">Responsables del catálogo</h2>
              <p className="text-xs text-slate-500">Pueden dar de alta artículos, proponer precios y cargar al paciente desde esta área.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {usuarios
                  .filter((u) => responsables.has(u.id))
                  .map((u) => (
                    <li key={u.id} className="flex items-center gap-2">
                      {u.nombre} {u.primer_apellido} <span className="text-xs text-slate-500">· {etiquetaRol(u.rol)}</span>
                      <FormAccion accion={asignarResponsable.bind(null, area.clave)} boton="Quitar" variante="secundario" className="inline-flex items-center gap-2">
                        <input type="hidden" name="usuario" value={u.id} />
                        <input type="hidden" name="quitar" value="1" />
                      </FormAccion>
                    </li>
                  ))}
                {responsables.size === 0 && <li className="text-slate-500">Sin responsables asignados.</li>}
              </ul>
              <FormAccion accion={asignarResponsable.bind(null, area.clave)} boton="Asignar" variante="secundario" className="mt-2 flex flex-wrap items-end gap-2">
                <label className={claseEtiqueta}>
                  Persona
                  <select name="usuario" className={claseCampo} defaultValue="">
                    <option value="">Elegir…</option>
                    {usuarios
                      .filter((u) => !responsables.has(u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.primer_apellido} {u.nombre} · {etiquetaRol(u.rol)}
                        </option>
                      ))}
                  </select>
                </label>
              </FormAccion>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
