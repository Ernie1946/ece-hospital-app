import Link from 'next/link'
import { obtenerPerfil, esCostos } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { pesos } from '@/lib/catalogos'
import { guardarLista } from '../acciones'

type Lista = { id: number; clave: string; nombre: string; aseguradora_id: number | null; descuento_pct: number; es_base: boolean; activa: boolean }

// Costos: listas de precios (Particular y convenios con aseguradoras)
export default async function ListasPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const costos = esCostos(perfil)
  const supabase = await crearClienteServidor()
  const [listasQ, asegQ, especialesQ] = await Promise.all([
    supabase.schema('catalogo').from('lista_precios').select('id, clave, nombre, aseguradora_id, descuento_pct, es_base, activa').order('es_base', { ascending: false }).order('nombre'),
    supabase.schema('catalogo').from('aseguradora').select('id, nombre').order('nombre'),
    supabase.schema('catalogo').from('precio').select('lista_id, precio, vigente_desde, concepto_cargo(clave, descripcion)').order('vigente_desde', { ascending: false }).limit(300),
  ])
  const listas = (listasQ.data ?? []) as Lista[]
  const aseg = (asegQ.data ?? []) as { id: number; nombre: string }[]
  const nombreAseg = new Map(aseg.map((a) => [a.id, a.nombre]))
  const especiales = ((especialesQ.data ?? []) as unknown as { lista_id: number; precio: number; vigente_desde: string; concepto_cargo: { clave: string; descripcion: string } | null }[])

  const formLista = (l?: Lista) => (
    <FormAccion accion={guardarLista} boton={l ? 'Guardar' : 'Crear lista'} variante={l ? 'secundario' : 'primario'} className="grid gap-2 sm:grid-cols-5 sm:items-end">
      <label className={claseEtiqueta}>
        Clave
        <input name="clave" required defaultValue={l?.clave} readOnly={!!l} placeholder="GNP" className={`${claseCampo} uppercase ${l ? 'bg-slate-50' : ''}`} />
      </label>
      <label className={`${claseEtiqueta} sm:col-span-2`}>
        Nombre
        <input name="nombre" required defaultValue={l?.nombre} placeholder="GNP Seguros (convenio 2026)" className={claseCampo} />
      </label>
      <label className={claseEtiqueta}>
        Aseguradora
        <select name="aseguradora" defaultValue={l?.aseguradora_id ?? ''} className={claseCampo}>
          <option value="">— (lista especial)</option>
          {aseg.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      </label>
      <label className={claseEtiqueta}>
        Descuento general %
        <input name="descuento" type="number" min={0} max={100} step="0.01" defaultValue={l?.descuento_pct ?? 0} className={claseCampo} />
      </label>
      {l && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <select name="activa" defaultValue={l.activa ? 'on' : 'off'} className="rounded border border-slate-300 px-1">
            <option value="on">Activa</option>
            <option value="off">Inactiva</option>
          </select>
        </label>
      )}
    </FormAccion>
  )

  return (
    <>
      <Encabezado perfil={perfil} activo="catalogos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/catalogos" className="text-sm text-sky-700 hover:underline">
            ← Catálogos
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">Listas de precios</h1>
          <p className="text-sm text-slate-600">
            Cada cuenta se cobra con la lista de la aseguradora de su póliza (o la que asigne Caja); sin póliza, con Particular. Si un artículo no tiene precio especial en la
            lista, se cobra el precio Particular menos el descuento general de la lista. Los precios especiales se fijan desde el catálogo de cada área (Editar → Fijar precio → Lista).
          </p>
          {listas.map((l) => {
            const suyos = especiales.filter((e) => e.lista_id === l.id)
            return (
              <section key={l.id} className={claseTarjeta}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">
                    {l.nombre} <span className="font-mono text-xs text-slate-400">{l.clave}</span>
                    {!l.activa && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs">inactiva</span>}
                  </h2>
                  <span className="text-xs text-slate-500">
                    {l.es_base ? 'Precio base' : `${l.aseguradora_id ? nombreAseg.get(l.aseguradora_id) : 'Lista especial'} · descuento general ${Number(l.descuento_pct)} %`}
                  </span>
                </div>
                {!l.es_base && costos && <details className="mt-2"><summary className="cursor-pointer text-xs text-sky-700">Modificar</summary><div className="mt-2">{formLista(l)}</div></details>}
                {!l.es_base && suyos.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-600">
                    {suyos.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        {e.concepto_cargo?.descripcion} ({e.concepto_cargo?.clave}): {pesos(e.precio)} desde {e.vigente_desde}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
          {costos && (
            <section className={claseTarjeta}>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Nueva lista</h2>
              {formLista()}
            </section>
          )}
        </div>
      </main>
    </>
  )
}
