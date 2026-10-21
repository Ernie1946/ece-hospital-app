import Link from 'next/link'
import { obtenerPerfil, esCostos } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { guardarArea } from './acciones'

type Area = { id: number; clave: string; nombre: string; carga_enfermeria: boolean; activa: boolean; orden: number }

// Catálogos de cargos: cada área administra sus artículos; Costos autoriza precios
export default async function CatalogosPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const costos = esCostos(perfil)
  const supabase = await crearClienteServidor()
  const [areasQ, articulosQ, pendientesQ, cargosQ] = await Promise.all([
    supabase.schema('catalogo').from('area_cargo').select('id, clave, nombre, carga_enfermeria, activa, orden').order('orden'),
    supabase.schema('catalogo').from('concepto_cargo').select('area_cargo_id, activo, estado'),
    supabase.schema('catalogo').from('v_precio_propuesta').select('id, area_clave').eq('estado', 'pendiente'),
    supabase.schema('cuenta').from('cargo').select('id', { count: 'exact', head: true }).eq('precio_pendiente', true).eq('cancelado', false),
  ])
  const areas = ((areasQ.data ?? []) as Area[]).filter((a) => costos || (a.activa && perfil.catalogos.includes(a.id)))
  const art = (articulosQ.data ?? []) as { area_cargo_id: number; activo: boolean; estado: string }[]
  const pend = (pendientesQ.data ?? []) as { id: number; area_clave: string }[]

  return (
    <>
      <Encabezado perfil={perfil} activo="catalogos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Catálogos de cargos</h1>
            {costos && (
              <nav className="flex flex-wrap gap-2 text-sm" aria-label="Costos">
                <Link href="/catalogos/precios" className="rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800">
                  Precios por autorizar{pend.length ? ` (${pend.length})` : ''}
                </Link>
                <Link href="/catalogos/listas" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
                  Listas de precios
                </Link>
              </nav>
            )}
          </div>
          {costos && (cargosQ.count ?? 0) > 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Hay {cargosQ.count} cargo(s) a pacientes esperando precio: se completan solos al autorizar el precio del artículo.
            </p>
          )}
          <p className="text-sm text-slate-600">
            {costos
              ? 'Cada área da de alta sus artículos (en pantalla o con Excel); los precios nuevos o cambiados esperan tu autorización.'
              : 'Da de alta y actualiza los artículos de tu área. Los precios nuevos o cambiados los autoriza Costos antes de cobrarse.'}
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => {
              const suyos = art.filter((x) => x.area_cargo_id === a.id)
              const p = pend.filter((x) => x.area_clave === a.clave).length
              return (
                <li key={a.id}>
                  <Link href={`/catalogos/${a.clave}`} className={`block rounded-xl border bg-white p-3 hover:border-sky-400 hover:shadow-sm ${a.activa ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{a.nombre}</span>
                      <span className="font-mono text-xs text-slate-400">{a.clave}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {suyos.filter((x) => x.activo).length} artículo(s)
                      {p > 0 && <span className="ml-2 rounded bg-violet-100 px-1.5 text-xs text-violet-800">{p} precio(s) por autorizar</span>}
                      {!a.activa && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs">inactiva</span>}
                    </p>
                    {a.carga_enfermeria && <p className="text-xs text-slate-500">Enfermería puede cargar estos artículos</p>}
                  </Link>
                </li>
              )
            })}
          </ul>
          {areas.length === 0 && <p className="text-sm text-slate-500">No tienes áreas asignadas. Pide a Costos que te asigne como responsable.</p>}

          {costos && (
            <details className={claseTarjeta}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Agregar o modificar un área</summary>
              <p className="mt-1 text-xs text-slate-500">Cada hospital activa solo las áreas que tiene. Usa la misma clave para modificar una existente.</p>
              <FormAccion accion={guardarArea} boton="Guardar área" className="mt-2 grid gap-2 sm:grid-cols-4 sm:items-end">
                <label className={claseEtiqueta}>
                  Clave
                  <input name="clave" required maxLength={12} placeholder="ENDO" className={`${claseCampo} uppercase`} />
                </label>
                <label className={`${claseEtiqueta} sm:col-span-2`}>
                  Nombre
                  <input name="nombre" required placeholder="Endoscopia" className={claseCampo} />
                </label>
                <div className="space-y-1 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="activa" defaultChecked /> Activa
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="carga_enfermeria" /> Enfermería carga
                  </label>
                </div>
              </FormAccion>
            </details>
          )}
        </div>
      </main>
    </>
  )
}
