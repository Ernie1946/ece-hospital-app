import Link from 'next/link'
import { obtenerPerfil, esCostos } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseTarjeta } from '@/lib/estilos'
import { fechaHora } from '@/lib/formato'
import { pesos } from '@/lib/catalogos'
import { resolverPropuestas } from '../acciones'

type Propuesta = {
  id: number
  clave: string
  descripcion: string
  unidad: string
  area_clave: string
  area_nombre: string
  lista_nombre: string
  precio: number
  precio_anterior: number | null
  vigente_desde: string
  motivo: string | null
  estado: string
  propuesto_en: string
  propuesto_por_nombre: string
  resuelto_en: string | null
  motivo_rechazo: string | null
  articulo_nuevo: boolean
  cargos_esperando: number
}

// Costos: autorizar o rechazar precios propuestos por las áreas
export default async function PreciosPage({ searchParams }: PageProps<'/catalogos/precios'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!esCostos(perfil)) {
    return (
      <>
        <Encabezado perfil={perfil} activo="catalogos" />
        <main className="flex-1 bg-slate-100 p-6 text-sm text-slate-600">Solo Costos autoriza precios.</main>
      </>
    )
  }
  const sp = await searchParams
  const area = typeof sp.area === 'string' ? sp.area : ''
  const hecho = typeof sp.hecho === 'string' ? Number(sp.hecho) : null
  const supabase = await crearClienteServidor()
  let pendQ = supabase.schema('catalogo').from('v_precio_propuesta').select('*').eq('estado', 'pendiente').order('area_clave').order('propuesto_en').limit(500)
  if (area) pendQ = pendQ.eq('area_clave', area)
  const [pend, hechos] = await Promise.all([
    pendQ,
    supabase.schema('catalogo').from('v_precio_propuesta').select('*').in('estado', ['autorizada', 'rechazada']).order('resuelto_en', { ascending: false }).limit(30),
  ])
  const lista = (pend.data ?? []) as Propuesta[]
  const recientes = (hechos.data ?? []) as Propuesta[]
  const areas = Array.from(new Map(lista.map((p) => [p.area_clave, p.area_nombre])).entries())
  const cambio = (p: Propuesta) => {
    if (p.precio_anterior === null || Number(p.precio_anterior) === 0) return null
    const d = ((Number(p.precio) - Number(p.precio_anterior)) / Number(p.precio_anterior)) * 100
    return { d, texto: `${d > 0 ? '+' : ''}${d.toFixed(1)} %` }
  }

  return (
    <>
      <Encabezado perfil={perfil} activo="catalogos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/catalogos" className="text-sm text-sky-700 hover:underline">
            ← Catálogos
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">Precios por autorizar ({lista.length})</h1>
          {hecho !== null && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {hecho} {hecho === 1 ? 'precio' : 'precios'} {sp.decision === 'rechazar' ? 'rechazado(s)' : 'autorizado(s)'}.
              {sp.decision !== 'rechazar' && ' Los cargos que esperaban precio ya quedaron completos.'}
            </p>
          )}
          {areas.length > 1 && (
            <nav className="flex flex-wrap gap-1 text-xs" aria-label="Filtrar por área">
              <Link href="/catalogos/precios" className={`rounded-full border px-2 py-0.5 ${!area ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white'}`}>Todas</Link>
              {areas.map(([c, n]) => (
                <Link key={c} href={`?area=${c}`} className={`rounded-full border px-2 py-0.5 ${area === c ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white'}`}>{n}</Link>
              ))}
            </nav>
          )}

          <section className={claseTarjeta}>
            {lista.length === 0 ? (
              <p className="text-sm text-slate-500">No hay precios pendientes.</p>
            ) : (
              <FormAccion accion={resolverPropuestas} boton="Autorizar seleccionados" className="space-y-3">
                <input type="hidden" name="decision" value="autorizar" />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm" aria-label="Precios pendientes">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-1 pr-2">
                          <span className="sr-only">Elegir</span>
                        </th>
                        <th className="pr-2">Artículo</th>
                        <th className="pr-2">Área / lista</th>
                        <th className="pr-2 text-right">Actual</th>
                        <th className="pr-2 text-right">Propuesto</th>
                        <th className="pr-2">Vigente desde</th>
                        <th className="pr-2">Propuso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((p) => {
                        const c = cambio(p)
                        return (
                          <tr key={p.id} className="border-t border-slate-100 align-top">
                            <td className="py-1.5 pr-2">
                              <input type="checkbox" name="propuesta" value={p.id} defaultChecked aria-label={`Autorizar ${p.descripcion}`} />
                            </td>
                            <td className="pr-2">
                              {p.descripcion} <span className="font-mono text-xs text-slate-400">{p.clave}</span>
                              {p.articulo_nuevo && <span className="ml-1 rounded bg-sky-100 px-1 text-xs text-sky-800">nuevo</span>}
                              {p.cargos_esperando > 0 && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">{p.cargos_esperando} cargo(s) esperando</span>}
                              {p.motivo && <span className="block text-xs text-slate-500">{p.motivo}</span>}
                            </td>
                            <td className="pr-2 text-xs">
                              {p.area_nombre}
                              <span className="block text-slate-500">{p.lista_nombre}</span>
                            </td>
                            <td className="pr-2 text-right tabular-nums">{pesos(p.precio_anterior)}</td>
                            <td className="pr-2 text-right font-medium tabular-nums">
                              {pesos(p.precio)}
                              {c && <span className={`block text-xs ${Math.abs(c.d) >= 20 ? 'font-semibold text-red-700' : 'text-slate-500'}`}>{c.texto}</span>}
                            </td>
                            <td className="pr-2 text-xs">{p.vigente_desde}</td>
                            <td className="pr-2 text-xs">
                              {p.propuesto_por_nombre}
                              <span className="block text-slate-500">{fechaHora(p.propuesto_en)}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">Cambios de ±20 % o más aparecen en rojo. Al autorizar, los cargos que esperaban precio se completan solos.</p>
              </FormAccion>
            )}
          </section>

          {lista.length > 0 && (
            <details className={claseTarjeta}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Rechazar precios</summary>
              <FormAccion accion={resolverPropuestas} boton="Rechazar seleccionados" variante="secundario" className="mt-2 space-y-2">
                <input type="hidden" name="decision" value="rechazar" />
                <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                  {lista.map((p) => (
                    <li key={p.id}>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="propuesta" value={p.id} /> {p.descripcion} · {pesos(p.precio)} ({p.area_nombre})
                      </label>
                    </li>
                  ))}
                </ul>
                <input name="motivo" required placeholder="Motivo del rechazo (lo verá el área)" className={`${claseCampo} max-w-lg`} />
              </FormAccion>
            </details>
          )}

          {recientes.length > 0 && (
            <section className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800">Resueltos recientemente</h2>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {recientes.map((p) => (
                  <li key={p.id} className="py-1">
                    <span className={`mr-2 rounded px-1.5 text-xs ${p.estado === 'autorizada' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{p.estado}</span>
                    {p.descripcion} · {pesos(p.precio)} · {p.lista_nombre}
                    <span className="text-xs text-slate-500"> · {p.resuelto_en ? fechaHora(p.resuelto_en) : ''}</span>
                    {p.motivo_rechazo && <span className="block text-xs text-red-700">{p.motivo_rechazo}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
