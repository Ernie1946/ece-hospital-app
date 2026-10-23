import Link from 'next/link'
import { obtenerPerfil } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { BotonAccion } from '@/components/BotonAccion'
import { BotonImprimir } from '@/components/BotonImprimir'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { fechaHora } from '@/lib/formato'
import { horaCorta } from '@/lib/farmacia'
import { CONSISTENCIAS, RESTRICCIONES, TIEMPOS, hoyChihuahua, nombreTiempo, tiempoSiguiente, type TipoDieta } from '@/lib/nutricion'
import { ajustarDieta, clasificarDieta, entregarArea, entregarCharola, generarCharolas, guardarTipoDieta, noEntregada } from './acciones'

// ---------------------------------------------------------------------
// Nutrición: tablero de dietas (desde las órdenes médicas), charolas por
// área y tiempo de comida, entrega con cargo automático y tipos de dieta.
// ---------------------------------------------------------------------

const VISTAS = [
  ['dietas', 'Tablero de dietas'],
  ['charolas', 'Charolas'],
  ['tipos', 'Tipos de dieta'],
] as const
type Vista = (typeof VISTAS)[number][0]

type FilaDieta = {
  area: string
  area_nombre: string
  area_padre: string | null
  area_padre_nombre: string | null
  area_orden: number
  cama: string
  encuentro_id: string
  expediente: string
  paciente: string
  sexo: string
  edad: number | null
  alergias: string | null
  aislamiento: string | null
  servicio_nombre: string | null
  orden_id: string | null
  indicacion: string | null
  ordenada_en: string | null
  medico: string | null
  tipo_dieta_id: number | null
  dieta: string | null
  es_ayuno: boolean | null
  consistencia: string | null
  restricciones: string[] | null
  kcal: number | null
  colaciones: boolean | null
  observaciones: string | null
  ajustada_en: string | null
  ajustada_por: string | null
  por_clasificar: boolean
}

type Charola = {
  charola_id: string
  fecha: string
  tiempo: string
  cama: string
  area: string
  area_nombre: string
  area_padre: string | null
  area_padre_nombre: string | null
  area_orden: number
  encuentro_id: string
  expediente: string
  paciente: string
  dieta: string
  consistencia: string | null
  restricciones: string[] | null
  kcal: number | null
  observaciones: string | null
  alergias: string | null
  aislamiento: string | null
  estado: string
  motivo: string | null
  entregada_en: string | null
  entregada_por: string | null
  precio: number | null
  precio_pendiente: boolean | null
}

// El área "de piso": la agrupadora (p. ej. alas 3 a 6) o el área misma
const grupo = (f: { area: string; area_nombre: string; area_padre: string | null; area_padre_nombre: string | null }) => ({
  clave: f.area_padre ?? f.area,
  nombre: f.area_padre_nombre ?? f.area_nombre,
})

function agrupar<T extends { area: string; area_nombre: string; area_padre: string | null; area_padre_nombre: string | null; area_orden: number; cama: string }>(filas: T[]) {
  const mapa = new Map<string, { clave: string; nombre: string; orden: number; filas: T[] }>()
  for (const f of filas) {
    const g = grupo(f)
    const e = mapa.get(g.clave) ?? { ...g, orden: f.area_orden, filas: [] }
    e.orden = Math.min(e.orden, f.area_orden)
    e.filas.push(f)
    mapa.set(g.clave, e)
  }
  return Array.from(mapa.values())
    .sort((a, b) => a.orden - b.orden)
    .map((g) => ({ ...g, filas: g.filas.sort((a, b) => a.cama.localeCompare(b.cama, 'es', { numeric: true })) }))
}

const ROLES = ['nutricion', 'admin_sistema', 'costos']

export default async function NutricionPage({ searchParams }: PageProps<'/nutricion'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const sp = await searchParams
  const vista: Vista = VISTAS.some(([k]) => k === sp.vista) ? (sp.vista as Vista) : 'dietas'
  const esNutricion = perfil.rol === 'nutricion'

  return (
    <>
      <Encabezado perfil={perfil} activo="nutricion" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900 print:hidden">Nutrición</h1>
          {!ROLES.includes(perfil.rol) ? (
            <p className="text-sm text-slate-600">Esta sección es para el personal de Nutrición.</p>
          ) : (
            <>
              <nav className="flex flex-wrap gap-1 border-b border-slate-200 print:hidden" aria-label="Vistas de nutrición">
                {VISTAS.map(([k, t]) => (
                  <Link
                    key={k}
                    href={`/nutricion?vista=${k}`}
                    aria-current={vista === k ? 'page' : undefined}
                    className={`rounded-t-lg px-3 py-1.5 text-sm ${vista === k ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-white'}`}
                  >
                    {t}
                  </Link>
                ))}
              </nav>
              {!esNutricion && vista !== 'tipos' && (
                <p className="text-sm text-slate-600 print:hidden">Vista de consulta: la operación la realiza el personal de Nutrición.</p>
              )}
              {vista === 'dietas' && <Tablero area={typeof sp.area === 'string' ? sp.area : ''} puede={esNutricion} />}
              {vista === 'charolas' && (
                <Charolas
                  fecha={typeof sp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyChihuahua()}
                  tiempo={typeof sp.tiempo === 'string' && TIEMPOS.some((t) => t.clave === sp.tiempo) ? sp.tiempo : tiempoSiguiente()}
                  area={typeof sp.area === 'string' ? sp.area : ''}
                  puede={esNutricion}
                />
              )}
              {vista === 'tipos' && <Tipos puede={ROLES.includes(perfil.rol)} />}
            </>
          )}
        </div>
      </main>
    </>
  )
}

// ---------------------------------------------------------------------
// Tablero de dietas
// ---------------------------------------------------------------------
async function Tablero({ area, puede }: { area: string; puede: boolean }) {
  const supabase = await crearClienteServidor()
  const [filasQ, tiposQ] = await Promise.all([
    supabase.schema('nutricion').from('v_tablero_dietas').select('*'),
    supabase.schema('catalogo').from('tipo_dieta').select('id, clave, nombre, es_ayuno, activo, concepto_cargo_id').eq('activo', true).order('nombre'),
  ])
  const todas = (filasQ.data ?? []) as FilaDieta[]
  const tipos = (tiposQ.data ?? []) as TipoDieta[]
  const grupos = agrupar(todas)
  const filas = area ? todas.filter((f) => grupo(f).clave === area) : todas
  const conteo = {
    total: filas.length,
    ayuno: filas.filter((f) => f.es_ayuno).length,
    sin: filas.filter((f) => !f.orden_id).length,
    clasificar: filas.filter((f) => f.por_clasificar).length,
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" action="/nutricion">
        <input type="hidden" name="vista" value="dietas" />
        <label className={claseEtiqueta}>
          Área
          <select name="area" defaultValue={area} className={claseCampo}>
            <option value="">Todas</option>
            {grupos.map((g) => (
              <option key={g.clave} value={g.clave}>
                {g.nombre}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Ver</button>
        <p className="ml-auto text-sm text-slate-600">
          {conteo.total} paciente(s) · {conteo.ayuno} en ayuno ·{' '}
          <span className={conteo.sin ? 'font-semibold text-amber-800' : ''}>{conteo.sin} sin dieta indicada</span>
          {conteo.clasificar > 0 && <span className="font-semibold text-red-700"> · {conteo.clasificar} por clasificar</span>}
        </p>
      </form>

      {agrupar(filas).map((g) => (
        <section key={g.clave} className={claseTarjeta} aria-label={`Dietas de ${g.nombre}`}>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            {g.nombre} <span className="font-normal text-slate-500">· {g.filas.length} paciente(s)</span>
          </h2>
          <ul className="divide-y divide-slate-100">
            {g.filas.map((f) => (
              <li key={f.encuentro_id} className="py-2">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-1 text-sm">
                  <span className="w-20 font-mono font-semibold text-slate-900">{f.cama}</span>
                  <span className="min-w-48 flex-1">
                    <span className="font-medium text-slate-900">{f.paciente}</span>
                    <span className="block text-xs text-slate-500">
                      {f.expediente} · {f.sexo} · {f.edad ?? '—'} años{f.servicio_nombre ? ` · ${f.servicio_nombre}` : ''}
                    </span>
                    {f.alergias && <span className="block text-xs font-semibold text-red-700">Alergias: {f.alergias}</span>}
                  </span>
                  <span className="min-w-64 flex-[2]">
                    {!f.orden_id ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Sin dieta indicada</span>
                    ) : f.por_clasificar ? (
                      <>
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Por clasificar</span>{' '}
                        <span className="text-slate-800">{f.indicacion}</span>
                      </>
                    ) : (
                      <>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${f.es_ayuno ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-900'}`}>{f.dieta}</span>
                        {!f.es_ayuno && (
                          <span className="ml-2 text-slate-700">
                            {[
                              f.consistencia && f.consistencia !== 'normal' ? `Consistencia ${CONSISTENCIAS[f.consistencia]?.toLowerCase() ?? f.consistencia}` : '',
                              f.kcal ? `${f.kcal} kcal` : '',
                              (f.restricciones ?? []).join(', '),
                              f.colaciones ? 'con colaciones' : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {f.observaciones && <span className="block text-xs text-slate-600">Obs.: {f.observaciones}</span>}
                      </>
                    )}
                    {f.orden_id && (
                      <span className="block text-xs text-slate-500">
                        Indicó {f.medico} · {fechaHora(f.ordenada_en)}
                        {f.ajustada_en ? ` · Ajustó ${f.ajustada_por} ${fechaHora(f.ajustada_en)}` : ''}
                      </span>
                    )}
                  </span>
                </div>
                {puede && f.orden_id && !f.es_ayuno && (
                  <details className="mt-1 ml-24">
                    <summary className="cursor-pointer text-xs font-medium text-sky-700">{f.por_clasificar ? 'Clasificar dieta' : 'Ajustar'}</summary>
                    <FormAccion
                      accion={(f.por_clasificar ? clasificarDieta : ajustarDieta).bind(null, f.orden_id)}
                      boton={f.por_clasificar ? 'Clasificar' : 'Guardar ajuste'}
                      className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        {f.por_clasificar && (
                          <label className={claseEtiqueta}>
                            Tipo de dieta
                            <select name="tipo_dieta" defaultValue="" className={claseCampo}>
                              <option value="">Elegir…</option>
                              {tipos.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nombre}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className={claseEtiqueta}>
                          Consistencia
                          <select name="consistencia" defaultValue={f.consistencia ?? 'normal'} className={claseCampo}>
                            {Object.entries(CONSISTENCIAS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!f.por_clasificar && (
                          <>
                            <label className={claseEtiqueta}>
                              Kcal al día
                              <input name="kcal" defaultValue={f.kcal ?? ''} inputMode="numeric" className={`${claseCampo} w-28`} />
                            </label>
                            <label className="flex items-center gap-1 pb-2 text-sm text-slate-700">
                              <input type="checkbox" name="colaciones" value="1" defaultChecked={!!f.colaciones} /> Con colaciones
                            </label>
                          </>
                        )}
                      </div>
                      <fieldset>
                        <legend className="text-sm font-medium text-slate-700">Restricciones</legend>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
                          {RESTRICCIONES.map((r) => (
                            <label key={r} className="flex items-center gap-1">
                              <input type="checkbox" name="restriccion" value={r} defaultChecked={(f.restricciones ?? []).includes(r)} /> {r}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label className={claseEtiqueta}>
                        Otras restricciones <span className="font-normal text-slate-400">(separadas por coma)</span>
                        <input name="otras" defaultValue={(f.restricciones ?? []).filter((r) => !RESTRICCIONES.includes(r)).join(', ')} className={claseCampo} />
                      </label>
                      <label className={claseEtiqueta}>
                        Observaciones para cocina
                        <input name="observaciones" defaultValue={f.observaciones ?? ''} placeholder="Tolera poco volumen, prefiere caldo…" className={claseCampo} />
                      </label>
                    </FormAccion>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {filas.length === 0 && <p className="text-sm text-slate-500">No hay pacientes en cama.</p>}
      <p className="text-xs text-slate-500">
        El tipo de dieta lo indica el médico en su nota; Nutrición ajusta consistencia, restricciones, kilocalorías y colaciones. Para cambiar el tipo de dieta se
        necesita una nueva indicación médica.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------
// Charolas por tiempo de comida
// ---------------------------------------------------------------------
async function Charolas({ fecha, tiempo, area, puede }: { fecha: string; tiempo: string; area: string; puede: boolean }) {
  const supabase = await crearClienteServidor()
  const [charolasQ, areasQ] = await Promise.all([
    supabase.schema('nutricion').from('v_charolas').select('*').eq('fecha', fecha).eq('tiempo', tiempo),
    supabase.schema('nutricion').from('v_tablero_dietas').select('area, area_nombre, area_padre, area_padre_nombre, area_orden, cama'),
  ])
  const todas = (charolasQ.data ?? []) as Charola[]
  const grupos = agrupar([...((areasQ.data ?? []) as Charola[]), ...todas])
  const charolas = area ? todas.filter((c) => grupo(c).clave === area) : todas
  const vivas = charolas.filter((c) => c.estado !== 'no_entregada')
  // Resumen para cocina: cuántas de cada dieta y consistencia
  const resumen = new Map<string, number>()
  for (const c of vivas) {
    const k = `${c.dieta}${c.consistencia && c.consistencia !== 'normal' ? ` · ${CONSISTENCIAS[c.consistencia]?.toLowerCase() ?? c.consistencia}` : ''}`
    resumen.set(k, (resumen.get(k) ?? 0) + 1)
  }
  const titulo = `${nombreTiempo(tiempo)} del ${fecha.split('-').reverse().join('/')}${area ? ` · ${grupos.find((g) => g.clave === area)?.nombre ?? area}` : ''}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <form className="flex flex-wrap items-end gap-2" action="/nutricion">
          <input type="hidden" name="vista" value="charolas" />
          <label className={claseEtiqueta}>
            Fecha
            <input type="date" name="fecha" defaultValue={fecha} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Tiempo de comida
            <select name="tiempo" defaultValue={tiempo} className={claseCampo}>
              {TIEMPOS.map((t) => (
                <option key={t.clave} value={t.clave}>
                  {t.nombre} ({t.hora}:00)
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Área
            <select name="area" defaultValue={area} className={claseCampo}>
              <option value="">Todas</option>
              {grupos.map((g) => (
                <option key={g.clave} value={g.clave}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Ver</button>
        </form>
        {puede && (
          <FormAccion accion={generarCharolas} boton="Generar o actualizar charolas" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="fecha" value={fecha} />
            <input type="hidden" name="tiempo" value={tiempo} />
            <input type="hidden" name="area" value={area} />
          </FormAccion>
        )}
        <span className="ml-auto">
          <BotonImprimir />
        </span>
      </div>
      <p className="text-xs text-slate-500 print:hidden">
        Generar toma las dietas vigentes en este momento: agrega a quien falte, corrige la dieta de las charolas aún no entregadas y retira las de pacientes en
        ayuno o que ya egresaron. Se puede oprimir las veces que haga falta.
      </p>

      <h2 className="text-base font-semibold text-slate-900">
        Charolas: {titulo} <span className="font-normal text-slate-500">· {vivas.length} charola(s)</span>
      </h2>

      {resumen.size > 0 && (
        <section className={claseTarjeta} aria-label="Resumen para cocina">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Resumen para cocina</h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {Array.from(resumen.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <li key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                  <strong>{n}</strong> {k}
                </li>
              ))}
          </ul>
        </section>
      )}

      {agrupar(charolas).map((g) => {
        const programadas = g.filas.filter((c) => c.estado === 'programada').length
        return (
          <section key={g.clave} className={`${claseTarjeta} break-inside-avoid`} aria-label={`Charolas de ${g.nombre}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {g.nombre} <span className="font-normal text-slate-500">· {g.filas.length} charola(s)</span>
              </h3>
              {puede && programadas > 0 && (
                <span className="print:hidden">
                  <BotonAccion
                    etiqueta={`Entregar todas (${programadas})`}
                    variante="secundario"
                    confirmar={`¿Se entregaron las ${programadas} charolas de ${g.nombre}? Se cargan a la cuenta de cada paciente.`}
                    alHacer={entregarArea.bind(null, fecha, tiempo, g.clave)}
                  />
                </span>
              )}
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 pr-2">Cama</th>
                  <th className="pr-2">Paciente</th>
                  <th className="pr-2">Dieta</th>
                  <th className="pr-2">Alergias / aislamiento</th>
                  <th className="pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {g.filas.map((c) => (
                  <tr key={c.charola_id} className={`border-t border-slate-100 align-top ${c.estado === 'no_entregada' ? 'text-slate-400' : ''}`}>
                    <td className="py-1.5 pr-2 font-mono font-semibold">{c.cama}</td>
                    <td className="pr-2">
                      {c.paciente}
                      <span className="block text-xs text-slate-500">{c.expediente}</span>
                    </td>
                    <td className="pr-2">
                      <strong>{c.dieta}</strong>
                      {[
                        c.consistencia && c.consistencia !== 'normal' ? CONSISTENCIAS[c.consistencia]?.toLowerCase() : '',
                        c.kcal ? `${c.kcal} kcal` : '',
                        (c.restricciones ?? []).join(', '),
                      ]
                        .filter(Boolean)
                        .map((x) => ` · ${x}`)
                        .join('')}
                      {c.observaciones && <span className="block text-xs">{c.observaciones}</span>}
                    </td>
                    <td className="pr-2 text-xs">
                      {c.alergias && <span className="block font-semibold text-red-700">{c.alergias}</span>}
                      {c.aislamiento && c.aislamiento !== 'ninguno' && <span className="block font-semibold text-amber-800">Aislamiento: {c.aislamiento}</span>}
                    </td>
                    <td className="pr-2">
                      {c.estado === 'programada' ? (
                        puede ? (
                          <span className="flex flex-wrap items-start gap-2 print:hidden">
                            <BotonAccion etiqueta="Entregada" alHacer={entregarCharola.bind(null, c.charola_id)} />
                            <details>
                              <summary className="cursor-pointer pt-1.5 text-xs text-slate-600">No entregada</summary>
                              <FormAccion accion={noEntregada.bind(null, c.charola_id)} boton="Registrar" variante="secundario" className="mt-1 space-y-1">
                                <input name="motivo" aria-label="Motivo" placeholder="Paciente en estudio, rechazó…" className={claseCampo} />
                              </FormAccion>
                            </details>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">Por entregar</span>
                        )
                      ) : c.estado === 'entregada' ? (
                        <span className="text-xs text-emerald-800">
                          Entregada {c.entregada_en ? horaCorta(c.entregada_en) : ''}
                          {c.precio_pendiente && <span className="block text-amber-800">Precio por autorizar</span>}
                        </span>
                      ) : (
                        <span className="text-xs">No entregada: {c.motivo}</span>
                      )}
                      <span className="hidden print:inline">☐</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
      {charolas.length === 0 && (
        <p className="text-sm text-slate-500">
          Aún no hay charolas para este tiempo.{puede ? ' Oprime «Generar o actualizar charolas».' : ''}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Tipos de dieta
// ---------------------------------------------------------------------
async function Tipos({ puede }: { puede: boolean }) {
  const supabase = await crearClienteServidor()
  const [tiposQ, preciosQ] = await Promise.all([
    supabase.schema('catalogo').from('tipo_dieta').select('id, clave, nombre, es_ayuno, activo, concepto_cargo_id').order('es_ayuno', { ascending: false }).order('nombre'),
    supabase.schema('catalogo').from('v_articulo').select('id, clave, precio, precio_propuesto').eq('area_clave', 'NUT'),
  ])
  const tipos = (tiposQ.data ?? []) as TipoDieta[]
  const precios = new Map(((preciosQ.data ?? []) as { id: number; clave: string; precio: number | null; precio_propuesto: number | null }[]).map((p) => [p.id, p]))
  const colacion = ((preciosQ.data ?? []) as { clave: string; precio: number | null; precio_propuesto: number | null }[]).find((p) => p.clave === 'ALIM-COLACION')
  const pesos = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`)

  return (
    <div className="space-y-4">
      <section className={claseTarjeta} aria-label="Tipos de dieta">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1 pr-2">Clave</th>
              <th className="pr-2">Dieta</th>
              <th className="pr-2">Precio por charola</th>
              <th className="pr-2">Estado</th>
              <th className="pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => {
              const p = t.concepto_cargo_id ? precios.get(t.concepto_cargo_id) : undefined
              return (
                <tr key={t.id} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-2 font-mono text-xs">{t.clave}</td>
                  <td className="pr-2">{t.nombre}</td>
                  <td className="pr-2">
                    {t.es_ayuno ? (
                      <span className="text-slate-500">No se cobra (ayuno)</span>
                    ) : (
                      <>
                        {pesos(p?.precio)}
                        {p?.precio_propuesto != null && <span className="block text-xs text-amber-800">Por autorizar: {pesos(p.precio_propuesto)}</span>}
                        {p && p.precio == null && p.precio_propuesto == null && <span className="block text-xs text-amber-800">Sin precio</span>}
                      </>
                    )}
                  </td>
                  <td className="pr-2">{t.activo ? 'Activa' : <span className="text-slate-500">Inactiva</span>}</td>
                  <td className="pr-2">
                    {puede && (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-sky-700">Editar</summary>
                        <FormAccion accion={guardarTipoDieta.bind(null, t.id)} boton="Guardar" className="mt-1 space-y-2">
                          <input type="hidden" name="clave" value={t.clave} />
                          <label className={claseEtiqueta}>
                            Nombre
                            <input name="nombre" defaultValue={t.nombre} className={claseCampo} />
                          </label>
                          <label className="flex items-center gap-1 text-sm">
                            <input type="checkbox" name="es_ayuno" value="1" defaultChecked={t.es_ayuno} /> Es ayuno (sin charola)
                          </label>
                          <label className="flex items-center gap-1 text-sm">
                            <input type="checkbox" name="activo" value="1" defaultChecked={t.activo} /> Activa
                          </label>
                          {!t.es_ayuno && !t.concepto_cargo_id && (
                            <label className={claseEtiqueta}>
                              Precio por charola (sin IVA)
                              <input name="precio" inputMode="decimal" className={claseCampo} />
                            </label>
                          )}
                        </FormAccion>
                      </details>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Colación: {pesos(colacion?.precio)}
          {colacion?.precio_propuesto != null ? ` (por autorizar: ${pesos(colacion.precio_propuesto)})` : ''}. Los precios se cambian en el{' '}
          <Link href="/catalogos/NUT" className="text-sky-700 hover:underline">
            catálogo de Nutrición
          </Link>{' '}
          con «Proponer precio con fecha»; Costos los autoriza.
        </p>
      </section>

      {puede && (
        <section className={claseTarjeta} aria-label="Agregar tipo de dieta">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Agregar tipo de dieta</h2>
          <FormAccion accion={guardarTipoDieta.bind(null, null)} boton="Agregar dieta" className="grid max-w-2xl gap-2 sm:grid-cols-2">
            <label className={claseEtiqueta}>
              Clave
              <input name="clave" placeholder="HIPOGRASA" className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Nombre
              <input name="nombre" placeholder="Hipograsa" className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Precio por charola (sin IVA)
              <input name="precio" inputMode="decimal" placeholder="230" className={claseCampo} />
            </label>
            <label className="flex items-center gap-1 pt-6 text-sm">
              <input type="checkbox" name="es_ayuno" value="1" /> Es ayuno (sin charola ni cobro)
            </label>
          </FormAccion>
        </section>
      )}
    </div>
  )
}
