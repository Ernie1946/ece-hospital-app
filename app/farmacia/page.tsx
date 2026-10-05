import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { BotonAccion } from '@/components/BotonAccion'
import { ImportarCatalogo } from '@/components/ImportarCatalogo'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { ahora, fecha } from '@/lib/formato'
import { ESTADO_DOSIS, cantidad, horaCorta } from '@/lib/farmacia'
import { devolverDosis, enviarPorTubo, importarCatalogo, prepararDosis, programarPendientes, registrarEntrada } from './acciones'

// ---------------------------------------------------------------------
// Farmacia intrahospitalaria: órdenes validadas → programar → preparar
// (etiqueta) → enviar por tubo; inventario por lote y catálogo del hospital.
// ---------------------------------------------------------------------

const VISTAS = [
  ['ordenes', 'Órdenes'],
  ['preparar', 'Por preparar'],
  ['enviar', 'Por enviar'],
  ['transito', 'En tubo y en piso'],
  ['inventario', 'Inventario'],
  ['catalogo', 'Catálogo'],
] as const
type Vista = (typeof VISTAS)[number][0]

type Dosis = {
  id: string
  orden_id: string
  medicamento: string
  concentracion: string
  dosis: number
  unidad_dosis: string
  via: string
  hora_programada: string
  estado: string
  codigo_barras: string
  paciente: string
  expediente: string
  cama: string | null
  estacion: string | null
  lote: string | null
  alto_riesgo: boolean
  grupo_controlado: string | null
  prn: boolean
  envio_id: string | null
}
type Orden = {
  id: string
  estado: string
  prioridad: string
  descripcion: string
  medicamento: string
  paciente: string
  expediente: string
  cama: string | null
  prn: boolean
  validada_en: string
  por_preparar: number
  programada_hasta: string | null
  alertas: string | null
  bloqueada: boolean
  alto_riesgo: boolean
  grupo_controlado: string | null
}

const COLUMNAS_DOSIS =
  'id, orden_id, medicamento, concentracion, dosis, unidad_dosis, via, hora_programada, estado, codigo_barras, paciente, expediente, cama, estacion, lote, alto_riesgo, grupo_controlado, prn, envio_id'

export default async function FarmaciaPage({ searchParams }: PageProps<'/farmacia'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const sp = await searchParams
  const vista: Vista = VISTAS.some(([k]) => k === sp.vista) ? (sp.vista as Vista) : 'ordenes'
  const esFarmacia = perfil.rol === 'farmacia'
  const puedeInventario = ['farmacia', 'almacen'].includes(perfil.rol)
  const puedeCatalogo = ['farmacia', 'admin_sistema'].includes(perfil.rol)

  const supabase = await crearClienteServidor()
  const en24h = new Date(ahora() + 24 * 3600 * 1000).toISOString()
  const f = () => supabase.schema('farmacia')

  // Contadores de cada bandeja
  const [cOrd, cPrep, cEnv, cTra] = await Promise.all([
    f().from('v_ordenes_vigentes').select('id', { count: 'exact', head: true }),
    f().from('v_dosis').select('id', { count: 'exact', head: true }).eq('estado', 'programada').lt('hora_programada', en24h),
    f().from('v_dosis').select('id', { count: 'exact', head: true }).eq('estado', 'preparada'),
    f().from('v_dosis').select('id', { count: 'exact', head: true }).in('estado', ['enviada', 'recibida']),
  ])
  const conteo: Partial<Record<Vista, number>> = {
    ordenes: cOrd.count ?? 0,
    preparar: cPrep.count ?? 0,
    enviar: cEnv.count ?? 0,
    transito: cTra.count ?? 0,
  }

  return (
    <>
      <Encabezado perfil={perfil} activo="farmacia" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Farmacia intrahospitalaria</h1>
          <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label="Bandejas de farmacia">
            {VISTAS.map(([k, t]) => (
              <Link
                key={k}
                href={`/farmacia?vista=${k}`}
                aria-current={vista === k ? 'page' : undefined}
                className={`rounded-t-lg px-3 py-1.5 text-sm ${vista === k ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-white'}`}
              >
                {t}
                {conteo[k] ? ` (${conteo[k]})` : ''}
              </Link>
            ))}
          </nav>
          {!esFarmacia && vista !== 'catalogo' && vista !== 'inventario' && (
            <p className="text-sm text-slate-600">Vista de consulta: la operación de farmacia la realiza el personal de farmacia.</p>
          )}

          {vista === 'ordenes' && <Ordenes esFarmacia={esFarmacia} />}
          {vista === 'preparar' && <PorPreparar esFarmacia={esFarmacia} hasta={en24h} />}
          {vista === 'enviar' && <PorEnviar esFarmacia={esFarmacia} />}
          {vista === 'transito' && <EnTransito esFarmacia={esFarmacia} />}
          {vista === 'inventario' && <Inventario puede={puedeInventario} />}
          {vista === 'catalogo' && <Catalogo puede={puedeCatalogo} />}
        </div>
      </main>
    </>
  )
}

// ---------------------------------------------------------------------
async function Ordenes({ esFarmacia }: { esFarmacia: boolean }) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('farmacia')
    .from('v_ordenes_vigentes')
    .select('id, estado, prioridad, descripcion, medicamento, paciente, expediente, cama, prn, validada_en, por_preparar, programada_hasta, alertas, bloqueada, alto_riesgo, grupo_controlado')
    .order('validada_en')
  const ordenes = (data ?? []) as Orden[]
  return (
    <section className={claseTarjeta}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-600">
          Órdenes de medicamento validadas por enfermería. Programar crea las dosis unitarias de cada orden hasta el horizonte elegido; las PRN las pide
          enfermería cuando se necesitan.
        </p>
        {esFarmacia && (
          <FormAccion accion={programarPendientes} boton="Programar dosis" className="flex items-end gap-2">
            <label className={claseEtiqueta}>
              Horizonte
              <select name="horas" defaultValue="24" className={claseCampo}>
                <option value="12">12 h</option>
                <option value="24">24 h</option>
                <option value="48">48 h</option>
              </select>
            </label>
          </FormAccion>
        )}
      </div>
      {ordenes.length === 0 ? (
        <p className="text-sm text-slate-500">Sin órdenes validadas.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {ordenes.map((o) => (
            <li key={o.id} className="py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {o.prioridad !== 'rutina' && <span className="mr-1 rounded bg-red-100 px-1 text-xs text-red-800">{o.prioridad}</span>}
                  <strong>{o.descripcion}</strong>
                  {o.prn && <span className="ml-1 rounded bg-slate-100 px-1 text-xs">PRN</span>}
                </span>
                <span className="text-xs text-slate-500">
                  {o.cama ?? 'sin cama'} · {o.paciente} · Exp. {o.expediente}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Validada {horaCorta(o.validada_en)} ·{' '}
                {o.programada_hasta ? `programada hasta ${horaCorta(o.programada_hasta)} · ${o.por_preparar} por preparar` : 'sin dosis programadas'}
              </p>
              {o.alertas && (
                <p className={`mt-1 rounded px-2 py-0.5 text-xs ${o.bloqueada ? 'bg-red-50 font-medium text-red-800' : 'bg-amber-50 text-amber-900'}`}>
                  {o.bloqueada ? '⛔ ' : '⚠ '}
                  {o.alertas}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Avisos({ d }: { d: Dosis }) {
  return (
    <>
      {d.alto_riesgo && <span className="rounded bg-red-100 px-1 text-xs font-medium text-red-800">Alto riesgo</span>}
      {d.grupo_controlado && <span className="rounded bg-purple-100 px-1 text-xs font-medium text-purple-800">Controlado {d.grupo_controlado}</span>}
      {d.prn && <span className="rounded bg-slate-100 px-1 text-xs">PRN</span>}
    </>
  )
}

async function PorPreparar({ esFarmacia, hasta }: { esFarmacia: boolean; hasta: string }) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('farmacia')
    .from('v_dosis')
    .select(COLUMNAS_DOSIS)
    .eq('estado', 'programada')
    .lt('hora_programada', hasta)
    .order('hora_programada')
    .limit(300)
  const dosis = (data ?? []) as Dosis[]
  return (
    <section className={claseTarjeta}>
      <p className="mb-2 text-sm text-slate-600">
        Dosis de las próximas 24 h. Al preparar se toma el lote vigente con caducidad más próxima y se descuenta del inventario.
      </p>
      {dosis.length === 0 ? (
        <p className="text-sm text-slate-500">Nada por preparar.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {dosis.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex flex-wrap items-center gap-1">
                <span className="font-semibold text-sky-800">{horaCorta(d.hora_programada)}</span>
                <strong>{d.medicamento}</strong> {d.concentracion} · {cantidad(d.dosis)} {d.unidad_dosis} {d.via} · {d.cama ?? 'sin cama'} · {d.paciente}
                <Avisos d={d} />
              </span>
              {esFarmacia && <BotonAccion etiqueta="Preparar" alHacer={prepararDosis.bind(null, d.id)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

async function PorEnviar({ esFarmacia }: { esFarmacia: boolean }) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.schema('farmacia').from('v_dosis').select(COLUMNAS_DOSIS).eq('estado', 'preparada').order('hora_programada')
  const dosis = (data ?? []) as Dosis[]
  const porEstacion = new Map<string, Dosis[]>()
  for (const d of dosis) {
    const k = d.estacion ?? 'Sin estación (paciente sin cama)'
    porEstacion.set(k, [...(porEstacion.get(k) ?? []), d])
  }
  return (
    <div className="space-y-3">
      {dosis.length === 0 && (
        <section className={claseTarjeta}>
          <p className="text-sm text-slate-500">No hay dosis preparadas.</p>
        </section>
      )}
      {[...porEstacion.entries()].map(([estacion, lista]) => (
        <section key={estacion} className={claseTarjeta}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              {estacion} · {lista.length} dosis
            </h2>
            {esFarmacia && lista[0].estacion && (
              <BotonAccion etiqueta={`Enviar por tubo a ${estacion}`} alHacer={enviarPorTubo.bind(null, lista.map((d) => d.id))} />
            )}
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {lista.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span className="flex flex-wrap items-center gap-1">
                  <span className="font-semibold text-sky-800">{horaCorta(d.hora_programada)}</span>
                  <strong>{d.medicamento}</strong> {cantidad(d.dosis)} {d.unidad_dosis} {d.via} · {d.cama ?? 'sin cama'} · {d.paciente} · lote {d.lote}
                  <Avisos d={d} />
                </span>
                <span className="flex items-center gap-3">
                  <Link href={`/farmacia/etiqueta/${d.id}`} className="text-sky-700 hover:underline">
                    Etiqueta
                  </Link>
                  {esFarmacia && <Devolver id={d.id} />}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Devolver({ id }: { id: string }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm text-red-700">Devolver</summary>
      <FormAccion accion={devolverDosis.bind(null, id)} boton="Devolver al inventario" variante="secundario" className="mt-1 flex flex-wrap items-end gap-2">
        <label className={claseEtiqueta}>
          Motivo
          <input name="motivo" required className={claseCampo} />
        </label>
      </FormAccion>
    </details>
  )
}

async function EnTransito({ esFarmacia }: { esFarmacia: boolean }) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('farmacia')
    .from('v_dosis')
    .select(COLUMNAS_DOSIS)
    .in('estado', ['enviada', 'recibida', 'omitida'])
    .order('hora_programada')
    .limit(300)
  const dosis = (data ?? []) as Dosis[]
  return (
    <section className={claseTarjeta}>
      <p className="mb-2 text-sm text-slate-600">Dosis enviadas, recibidas en piso u omitidas por enfermería (las omitidas se devuelven al inventario).</p>
      {dosis.length === 0 ? (
        <p className="text-sm text-slate-500">Nada en tránsito.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {dosis.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
              <span className="flex flex-wrap items-center gap-1">
                <span className={`rounded px-1 text-xs ${ESTADO_DOSIS[d.estado]?.color}`}>{ESTADO_DOSIS[d.estado]?.texto}</span>
                <span className="font-semibold text-sky-800">{horaCorta(d.hora_programada)}</span>
                <strong>{d.medicamento}</strong> {cantidad(d.dosis)} {d.unidad_dosis} · {d.estacion} · {d.cama} · {d.paciente}
              </span>
              {esFarmacia && d.estado === 'omitida' && <Devolver id={d.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

async function Inventario({ puede }: { puede: boolean }) {
  const supabase = await crearClienteServidor()
  const [inv, meds] = await Promise.all([
    supabase
      .schema('farmacia')
      .from('v_inventario')
      .select('id, clave, medicamento, concentracion, presentacion, lote, caducidad, existencia, caducado, por_caducar')
      .order('medicamento')
      .order('caducidad'),
    puede
      ? supabase.schema('catalogo').from('medicamento').select('id, clave, denominacion_generica, concentracion').eq('activo', true).order('denominacion_generica')
      : Promise.resolve({ data: [] }),
  ])
  const lotes = (inv.data ?? []) as {
    id: number
    clave: string
    medicamento: string
    concentracion: string
    presentacion: string | null
    lote: string
    caducidad: string
    existencia: number
    caducado: boolean
    por_caducar: boolean
  }[]
  const listaMeds = (meds.data ?? []) as { id: number; clave: string; denominacion_generica: string; concentracion: string }[]
  return (
    <div className="space-y-3">
      {puede && (
        <section className={claseTarjeta}>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Entrada de inventario</h2>
          <FormAccion accion={registrarEntrada} boton="Registrar entrada" className="grid gap-2 sm:grid-cols-5 sm:items-end">
            <label className={`${claseEtiqueta} sm:col-span-2`}>
              Medicamento
              <select name="medicamento" required className={claseCampo}>
                <option value="">Elige…</option>
                {listaMeds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.denominacion_generica} {m.concentracion} ({m.clave})
                  </option>
                ))}
              </select>
            </label>
            <label className={claseEtiqueta}>
              Lote
              <input name="lote" required className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Caducidad
              <input name="caducidad" type="date" required className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Cantidad
              <input name="cantidad" inputMode="numeric" required className={claseCampo} />
            </label>
          </FormAccion>
        </section>
      )}
      <section className={claseTarjeta}>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Existencias por lote</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-2">Medicamento</th>
                <th className="py-1 pr-2">Lote</th>
                <th className="py-1 pr-2">Caducidad</th>
                <th className="py-1 pr-2 text-right">Existencia</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className={`border-t border-slate-100 ${l.caducado ? 'text-slate-400 line-through' : ''}`}>
                  <td className="py-1 pr-2">
                    {l.medicamento} {l.concentracion} <span className="text-xs text-slate-500">({l.clave})</span>
                  </td>
                  <td className="py-1 pr-2">{l.lote}</td>
                  <td className="py-1 pr-2">
                    {fecha(l.caducidad)}
                    {l.caducado ? ' · caducado' : l.por_caducar ? <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-900">por caducar</span> : ''}
                  </td>
                  <td className={`py-1 pr-2 text-right font-medium ${l.existencia < 10 && !l.caducado ? 'text-red-700' : ''}`}>{l.existencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

async function Catalogo({ puede }: { puede: boolean }) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('catalogo')
    .from('medicamento')
    .select('id, clave, denominacion_generica, nombre_comercial, concentracion, forma_farmaceutica, via_default, unidad_dosis, dosis_maxima_dia, grupo_controlado, alto_riesgo, activo, concepto_cargo(precio)')
    .order('denominacion_generica')
  const meds = (data ?? []) as unknown as {
    id: number
    clave: string
    denominacion_generica: string
    nombre_comercial: string | null
    concentracion: string
    forma_farmaceutica: string
    via_default: string
    unidad_dosis: string
    dosis_maxima_dia: number | null
    grupo_controlado: string | null
    alto_riesgo: boolean
    activo: boolean
    concepto_cargo: { precio: number } | null
  }[]
  return (
    <div className="space-y-3">
      {puede && (
        <section className={claseTarjeta}>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Importar catálogo desde Excel</h2>
          <ImportarCatalogo importar={importarCatalogo} />
        </section>
      )}
      <section className={claseTarjeta}>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Catálogo del hospital ({meds.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-2">Clave</th>
                <th className="py-1 pr-2">Medicamento</th>
                <th className="py-1 pr-2">Forma</th>
                <th className="py-1 pr-2">Vía</th>
                <th className="py-1 pr-2">Máx/día</th>
                <th className="py-1 pr-2">Avisos</th>
                <th className="py-1 pr-2 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {meds.map((m) => (
                <tr key={m.id} className={`border-t border-slate-100 ${m.activo ? '' : 'text-slate-400'}`}>
                  <td className="py-1 pr-2 font-mono text-xs">{m.clave}</td>
                  <td className="py-1 pr-2">
                    <strong>{m.denominacion_generica}</strong> {m.concentracion}
                    {m.nombre_comercial && <span className="text-slate-500"> ({m.nombre_comercial})</span>}
                    {!m.activo && ' · inactivo'}
                  </td>
                  <td className="py-1 pr-2">{m.forma_farmaceutica}</td>
                  <td className="py-1 pr-2">{m.via_default}</td>
                  <td className="py-1 pr-2">{m.dosis_maxima_dia ? `${cantidad(m.dosis_maxima_dia)} ${m.unidad_dosis}` : '—'}</td>
                  <td className="py-1 pr-2 space-x-1">
                    {m.alto_riesgo && <span className="rounded bg-red-100 px-1 text-xs text-red-800">Alto riesgo</span>}
                    {m.grupo_controlado && <span className="rounded bg-purple-100 px-1 text-xs text-purple-800">Grupo {m.grupo_controlado}</span>}
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {m.concepto_cargo ? `$${Number(m.concepto_cargo.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
