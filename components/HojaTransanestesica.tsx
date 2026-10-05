'use client'

import { useState, useTransition } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { CampoDictado } from '@/components/CampoDictado'
import { GraficaSignos, type SignoTrans } from '@/components/GraficaSignos'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { TECNICAS, sangradoPermisible } from '@/lib/anestesia'
import {
  CONDICIONES_SALIDA,
  CONSCIENCIA_SALIDA,
  DESTINOS_SALIDA,
  EGRESOS_TRANS,
  INGRESOS_TRANS,
  LISTA_FARMACOS,
  TECNICA_SECCIONES,
  TIEMPOS,
  UNIDADES_DOSIS,
  VIAS_TRANS,
  buscarFarmacoRef,
  dosisSugerida,
  duracion,
  hora,
} from '@/lib/anestesia-trans'

type Accion = (previo: Resultado, datos: FormData) => Promise<Resultado>

export type RegistroTrans = {
  id: string
  ingreso_sala: string
  inicio_anestesia: string | null
  inicio_cirugia: string | null
  fin_cirugia: string | null
  fin_anestesia: string | null
  tipo_anestesia: string | null
  datos: Record<string, Record<string, string>>
}
export type SignoHoja = SignoTrans & { registrado_por: string }
export type FarmacoTrans = {
  id: number
  momento: string
  farmaco: string
  dosis: number | null
  unidad: string | null
  via: string
  notas: string | null
  registrado_por: string
}
export type LiquidoTrans = { id: number; momento: string; tipo: 'ingreso' | 'egreso'; concepto: string; volumen_ml: number; registrado_por: string }

const PESTANAS = ['Tiempos y signos', 'Fármacos', 'Líquidos', 'Técnica', 'Salida de quirófano'] as const
const VACIO = { spo2: '', fc: '', tas: '', tad: '', etco2: '', temp: '', bis: '', tof: '' }
const CAMPOS_SIGNO: [keyof typeof VACIO, string][] = [
  ['spo2', 'SpO₂ (%)'],
  ['fc', 'FC'],
  ['tas', 'TAS'],
  ['tad', 'TAD'],
  ['etco2', 'EtCO₂'],
  ['temp', 'Temp (°C)'],
  ['bis', 'BIS'],
  ['tof', 'TOF (%)'],
]
const ml = (n: number) => `${n.toLocaleString('es-MX')} mL`

// Hoja transanestésica abierta: todo se guarda al momento en la base; al
// final "Salida de quirófano" la cierra y la firma.
export function HojaTransanestesica({
  registro,
  signos,
  farmacos,
  liquidos,
  usuarioId,
  peso,
  hb,
  sexo,
  alergias,
  acciones,
}: {
  registro: RegistroTrans
  signos: SignoHoja[]
  farmacos: FarmacoTrans[]
  liquidos: LiquidoTrans[]
  usuarioId: string
  peso: number | null
  hb: number | null
  sexo: string
  alergias: string[]
  acciones: {
    marcarTiempo: Accion
    agregarSigno: Accion
    agregarFarmaco: Accion
    agregarLiquido: Accion
    guardarTecnica: Accion
    cerrarHoja: Accion
    quitar: (tabla: 'signo' | 'farmaco' | 'liquido', id: number) => Promise<Resultado>
  }
}) {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]>('Tiempos y signos')
  const ingresos = liquidos.filter((l) => l.tipo === 'ingreso').reduce((s, l) => s + Number(l.volumen_ml), 0)
  const egresos = liquidos.filter((l) => l.tipo === 'egreso').reduce((s, l) => s + Number(l.volumen_ml), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">En sala desde {hora(registro.ingreso_sala)}</span>
        {registro.tipo_anestesia && <span className="rounded bg-slate-100 px-2 py-1">{registro.tipo_anestesia}</span>}
        {registro.inicio_anestesia && (
          <span className="rounded bg-slate-100 px-2 py-1">
            {registro.fin_anestesia
              ? `Anestesia ${duracion(registro.inicio_anestesia, registro.fin_anestesia)}`
              : `Anestesia desde ${hora(registro.inicio_anestesia)}`}
          </span>
        )}
        <span className="rounded bg-slate-100 px-2 py-1">
          Balance {ingresos - egresos >= 0 ? '+' : ''}
          {ml(ingresos - egresos)}
        </span>
      </div>

      <div role="tablist" aria-label="Hoja transanestésica" className="flex flex-wrap gap-1 border-b border-slate-200">
        {PESTANAS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={pestana === p}
            onClick={() => setPestana(p)}
            className={`rounded-t-lg px-3 py-1.5 text-sm ${pestana === p ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {p}
          </button>
        ))}
      </div>

      <div hidden={pestana !== 'Tiempos y signos'}>
        <Tiempos registro={registro} accion={acciones.marcarTiempo} />
        <Signos signos={signos} usuarioId={usuarioId} accion={acciones.agregarSigno} quitar={acciones.quitar} />
      </div>
      <div hidden={pestana !== 'Fármacos'}>
        <Farmacos farmacos={farmacos} usuarioId={usuarioId} peso={peso} alergias={alergias} accion={acciones.agregarFarmaco} quitar={acciones.quitar} />
      </div>
      <div hidden={pestana !== 'Líquidos'}>
        <Liquidos
          liquidos={liquidos}
          usuarioId={usuarioId}
          ingresos={ingresos}
          egresos={egresos}
          permisible={peso && hb ? sangradoPermisible(peso, hb, sexo) : null}
          accion={acciones.agregarLiquido}
          quitar={acciones.quitar}
        />
      </div>
      <div hidden={pestana !== 'Técnica'}>
        <Tecnica registro={registro} accion={acciones.guardarTecnica} />
      </div>
      <div hidden={pestana !== 'Salida de quirófano'}>
        <Salida registro={registro} nSignos={signos.length} accion={acciones.cerrarHoja} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
function BotonQuitar({ alQuitar }: { alQuitar: () => Promise<Resultado> }) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await alQuitar()
            setError(r?.error ?? null)
          })
        }
        className="text-xs text-red-700 hover:underline disabled:opacity-50"
      >
        {pendiente ? 'Quitando…' : 'Quitar'}
      </button>
      {error && <span className="ml-1 text-xs text-red-700">{error}</span>}
    </>
  )
}

function Tiempos({ registro, accion }: { registro: RegistroTrans; accion: Accion }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase text-slate-500">Tiempos</p>
      <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TIEMPOS.map(([clave, titulo]) => {
          const valor = registro[clave as keyof RegistroTrans] as string | null
          return (
            <div key={clave} className="rounded-lg border border-slate-200 p-2">
              <p className="text-sm font-medium text-slate-800">{titulo}</p>
              <p className={`text-lg font-semibold ${valor ? 'text-slate-900' : 'text-slate-400'}`}>{hora(valor)}</p>
              <FormAccion accion={accion} boton={valor ? 'Corregir' : 'Marcar'} variante={valor ? 'secundario' : 'primario'} className="flex items-end gap-2">
                <input type="hidden" name="evento" value={clave} />
                <label className="block text-xs text-slate-600">
                  Hora
                  <input type="time" name="hora" aria-label={`Hora de ${titulo.toLowerCase()}`} className={claseCampo} />
                </label>
              </FormAccion>
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-slate-500">Si dejas la hora vacía se registra la hora actual.</p>
    </div>
  )
}

function Signos({
  signos,
  usuarioId,
  accion,
  quitar,
}: {
  signos: SignoHoja[]
  usuarioId: string
  accion: Accion
  quitar: (tabla: 'signo', id: number) => Promise<Resultado>
}) {
  const [v, setV] = useState(VACIO)
  const ultimo = signos[signos.length - 1]
  const spo2Baja = (n: number | null) => n !== null && n < 92

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Signos vitales ({signos.length})</p>
      <GraficaSignos signos={signos} />
      {signos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 pr-2">Hora</th>
                {CAMPOS_SIGNO.map(([, t]) => (
                  <th key={t} className="py-1 pr-2">
                    {t}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {signos.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-1 pr-2 font-medium">{hora(s.momento)}</td>
                  {CAMPOS_SIGNO.map(([k]) => (
                    <td key={k} className={`py-1 pr-2 ${k === 'spo2' && spo2Baja(s.spo2) ? 'font-semibold text-red-700' : ''}`}>
                      {s[k] ?? '—'}
                    </td>
                  ))}
                  <td>{s.registrado_por === usuarioId && <BotonQuitar alQuitar={() => quitar('signo', s.id)} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FormAccion accion={accion} boton="Registrar signos" alGuardar={() => setV(VACIO)} className="rounded-lg bg-slate-50 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-slate-500">Nuevo registro</p>
          {ultimo && (
            <button
              type="button"
              onClick={() =>
                setV(
                  Object.fromEntries(CAMPOS_SIGNO.map(([k]) => [k, ultimo[k] === null ? '' : String(ultimo[k])])) as typeof VACIO,
                )
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
            >
              ↺ Copiar último
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          <label className="block text-xs text-slate-600">
            Hora
            <input type="time" name="hora" aria-label="Hora del registro" className={claseCampo} />
          </label>
          {CAMPOS_SIGNO.map(([k, t]) => (
            <label key={k} className="block text-xs text-slate-600">
              {t}
              <input
                name={k}
                inputMode="decimal"
                value={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
                className={claseCampo}
              />
            </label>
          ))}
        </div>
      </FormAccion>
    </div>
  )
}

function Farmacos({
  farmacos,
  usuarioId,
  peso,
  alergias,
  accion,
  quitar,
}: {
  farmacos: FarmacoTrans[]
  usuarioId: string
  peso: number | null
  alergias: string[]
  accion: Accion
  quitar: (tabla: 'farmaco', id: number) => Promise<Resultado>
}) {
  const [farmaco, setFarmaco] = useState('')
  const [unidad, setUnidad] = useState('mg')
  const [via, setVia] = useState('IV')
  const ref = buscarFarmacoRef(farmaco)
  const alergia = farmaco.trim().length >= 3
    ? alergias.find((a) => {
        const s = a.toLowerCase().replace(/ \(.*\)$/, '')
        const f = farmaco.trim().toLowerCase()
        return s.includes(f) || f.includes(s)
      })
    : undefined

  const elegir = (nombre: string) => {
    setFarmaco(nombre)
    const r = buscarFarmacoRef(nombre)
    if (r) {
      setUnidad(r.unidad === 'mcg/kg/min' ? 'mcg/kg/min' : r.unidad)
      setVia(r.via)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Fármacos administrados ({farmacos.length})</p>
      {farmacos.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {farmacos.map((f) => (
            <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1">
              <span>
                <span className="font-medium text-sky-800">{hora(f.momento)}</span> <strong>{f.farmaco}</strong>
                {f.dosis !== null && ` ${Number(f.dosis).toLocaleString('es-MX')} ${f.unidad ?? ''}`} · {f.via}
                {f.notas && <span className="text-slate-500"> · {f.notas}</span>}
              </span>
              {f.registrado_por === usuarioId && <BotonQuitar alQuitar={() => quitar('farmaco', f.id)} />}
            </li>
          ))}
        </ul>
      )}
      <FormAccion
        accion={accion}
        boton="Registrar fármaco"
        alGuardar={() => {
          setFarmaco('')
          setUnidad('mg')
          setVia('IV')
        }}
        className="rounded-lg bg-slate-50 p-3 space-y-2"
      >
        <div className="grid gap-2 sm:grid-cols-6">
          <label className="block text-xs text-slate-600">
            Hora
            <input type="time" name="hora" aria-label="Hora del fármaco" className={claseCampo} />
          </label>
          <label className="block text-xs text-slate-600 sm:col-span-2">
            Fármaco
            <input
              name="farmaco"
              list="farmacos-anestesia"
              value={farmaco}
              onChange={(e) => elegir(e.target.value)}
              autoComplete="off"
              className={claseCampo}
            />
            <datalist id="farmacos-anestesia">
              {LISTA_FARMACOS.map((f) => (
                <option key={f.nombre} value={f.nombre} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs text-slate-600">
            Dosis
            <input name="dosis" inputMode="decimal" className={claseCampo} />
          </label>
          <label className="block text-xs text-slate-600">
            Unidad
            <select name="unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} className={claseCampo}>
              {UNIDADES_DOSIS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            Vía
            <select name="via" value={via} onChange={(e) => setVia(e.target.value)} className={claseCampo}>
              {VIAS_TRANS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
        {ref && <p className="rounded bg-sky-50 px-2 py-1 text-xs text-sky-900">💉 {dosisSugerida(ref, peso)}</p>}
        {alergia && (
          <p role="alert" className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
            ⚠ Alergia registrada: {alergia}. Si aun así se administra, justifícalo en Notas.
          </p>
        )}
        <label className="block text-xs text-slate-600">
          Notas
          <input name="notas" placeholder="Bolo, infusión, dilución, justificación…" className={claseCampo} />
        </label>
      </FormAccion>
    </div>
  )
}

function Liquidos({
  liquidos,
  usuarioId,
  ingresos,
  egresos,
  permisible,
  accion,
  quitar,
}: {
  liquidos: LiquidoTrans[]
  usuarioId: string
  ingresos: number
  egresos: number
  permisible: ReturnType<typeof sangradoPermisible>
  accion: Accion
  quitar: (tabla: 'liquido', id: number) => Promise<Resultado>
}) {
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso')
  const [concepto, setConcepto] = useState(INGRESOS_TRANS[0])
  const sangrado = liquidos.filter((l) => l.tipo === 'egreso' && l.concepto === 'Sangrado').reduce((s, l) => s + Number(l.volumen_ml), 0)
  const opciones = tipo === 'ingreso' ? INGRESOS_TRANS : EGRESOS_TRANS
  const balance = ingresos - egresos

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Caja titulo="Ingresos" valor={ml(ingresos)} />
        <Caja titulo="Egresos" valor={ml(egresos)} />
        <Caja titulo="Balance" valor={`${balance >= 0 ? '+' : ''}${ml(balance)}`} color={balance >= 0 ? 'text-emerald-800' : 'text-red-700'} />
      </div>
      {permisible && (
        <p
          className={`rounded px-2 py-1 text-sm ${
            sangrado >= permisible.gross ? 'bg-red-50 font-medium text-red-800' : sangrado >= permisible.gross * 0.7 ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'
          }`}
        >
          Sangrado {ml(sangrado)} de {ml(permisible.gross)} permisibles (Gross) · transfundir a {ml(permisible.transfusion)}
          {sangrado >= permisible.gross ? ' — ⚠ se rebasó el sangrado permisible' : ''}
        </p>
      )}
      {liquidos.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {liquidos.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1">
              <span>
                <span className="font-medium text-sky-800">{hora(l.momento)}</span>{' '}
                <span className={l.tipo === 'ingreso' ? 'text-emerald-800' : 'text-red-700'}>{l.tipo === 'ingreso' ? '↓ Ingreso' : '↑ Egreso'}</span> ·{' '}
                {l.concepto} {ml(Number(l.volumen_ml))}
              </span>
              {l.registrado_por === usuarioId && <BotonQuitar alQuitar={() => quitar('liquido', l.id)} />}
            </li>
          ))}
        </ul>
      )}
      <FormAccion accion={accion} boton="Registrar líquido" className="rounded-lg bg-slate-50 p-3 space-y-2">
        <div className="grid gap-2 sm:grid-cols-5">
          <label className="block text-xs text-slate-600">
            Hora
            <input type="time" name="hora" aria-label="Hora del líquido" className={claseCampo} />
          </label>
          <label className="block text-xs text-slate-600">
            Tipo
            <select
              name="tipo"
              value={tipo}
              onChange={(e) => {
                const t = e.target.value as 'ingreso' | 'egreso'
                setTipo(t)
                setConcepto((t === 'ingreso' ? INGRESOS_TRANS : EGRESOS_TRANS)[0])
              }}
              className={claseCampo}
            >
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600 sm:col-span-2">
            Concepto
            <select name="concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} className={claseCampo}>
              {opciones.map((o) => (
                <option key={o}>{o}</option>
              ))}
              <option>Otro</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            Volumen (mL)
            <input name="volumen" inputMode="decimal" required className={claseCampo} />
          </label>
        </div>
        {concepto === 'Otro' && (
          <label className="block text-xs text-slate-600">
            ¿Cuál?
            <input name="concepto_otro" required className={claseCampo} />
          </label>
        )}
      </FormAccion>
    </div>
  )
}

function Caja({ titulo, valor, color = 'text-slate-900' }: { titulo: string; valor: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 text-center">
      <p className="text-xs uppercase text-slate-500">{titulo}</p>
      <p className={`text-lg font-semibold ${color}`}>{valor}</p>
    </div>
  )
}

function Tecnica({ registro, accion }: { registro: RegistroTrans; accion: Accion }) {
  const tipos = registro.tipo_anestesia && !TECNICAS.includes(registro.tipo_anestesia) ? [registro.tipo_anestesia, ...TECNICAS] : TECNICAS
  return (
    <FormAccion accion={accion} boton="Guardar técnica" variante="primario" className="space-y-3">
      <label className={claseEtiqueta}>
        Tipo de anestesia *
        <select name="tipo_anestesia" defaultValue={registro.tipo_anestesia ?? ''} required className={claseCampo}>
          <option value="">Elige…</option>
          {tipos.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {TECNICA_SECCIONES.map((s) => {
        const d = registro.datos?.[s.clave] ?? {}
        return (
          <fieldset key={s.clave} className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">{s.titulo}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {s.campos.map((c) => {
                const nombre = `t_${s.clave}_${c.clave}`
                if (c.tipo === 'largo') {
                  return (
                    <div key={c.clave} className="sm:col-span-2 lg:col-span-4">
                      <CampoDictado name={nombre} etiqueta={c.etiqueta} placeholder={c.placeholder} defaultValue={d[c.clave] ?? ''} />
                    </div>
                  )
                }
                if (c.tipo === 'casillas') {
                  const marcados = (d[c.clave] ?? '').split(', ')
                  return (
                    <fieldset key={c.clave} className="sm:col-span-2 lg:col-span-4">
                      <legend className="text-xs text-slate-600">{c.etiqueta}</legend>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {c.opciones!.map((o) => (
                          <label key={o} className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-sm">
                            <input type="checkbox" name={nombre} value={o} defaultChecked={marcados.includes(o)} />
                            {o}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )
                }
                return (
                  <label key={c.clave} className="block text-xs text-slate-600">
                    {c.etiqueta}
                    {c.tipo === 'opciones' ? (
                      <select name={nombre} defaultValue={d[c.clave] ?? ''} className={claseCampo}>
                        <option value="">—</option>
                        {c.opciones!.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={nombre}
                        defaultValue={d[c.clave] ?? ''}
                        placeholder={c.placeholder}
                        inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
                        className={claseCampo}
                      />
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </FormAccion>
  )
}

function Salida({ registro, nSignos, accion }: { registro: RegistroTrans; nSignos: number; accion: Accion }) {
  const pendientes = [
    !registro.inicio_anestesia && 'inicio de anestesia',
    !registro.inicio_cirugia && 'inicio de cirugía',
    !registro.fin_cirugia && 'fin de cirugía',
    nSignos === 0 && 'al menos un registro de signos vitales',
    !registro.tipo_anestesia && 'tipo de anestesia (pestaña Técnica)',
  ].filter(Boolean)
  const [condicion, setCondicion] = useState('Estable')

  return (
    <div className="space-y-3">
      {pendientes.length > 0 ? (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">Antes de cerrar falta: {pendientes.join(', ')}.</p>
      ) : (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ La hoja tiene lo necesario para cerrarse.</p>
      )}
      <FormAccion accion={accion} boton="Cerrar hoja y firmar salida de quirófano" className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={claseEtiqueta}>
            Destino *
            <select name="destino" defaultValue="UCPA" required className={claseCampo}>
              {DESTINOS_SALIDA.map((d) => (
                <option key={d} value={d}>
                  {d === 'UCPA' ? 'UCPA (recuperación)' : d}
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Estado de consciencia
            <select name="consciencia" defaultValue={CONSCIENCIA_SALIDA[0]} className={claseCampo}>
              {CONSCIENCIA_SALIDA.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            EVA dolor (0-10)
            <input name="eva" inputMode="numeric" className={claseCampo} />
          </label>
        </div>
        <fieldset>
          <legend className={claseEtiqueta}>Condición al egreso *</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {CONDICIONES_SALIDA.map((c) => (
              <label
                key={c}
                className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${condicion === c ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                <input type="radio" name="condicion" value={c} checked={condicion === c} onChange={() => setCondicion(c)} className="sr-only" />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ['ta', 'TA (mmHg)', '120/80'],
            ['fc', 'FC', ''],
            ['spo2', 'SpO₂ (%)', ''],
            ['fr', 'FR', ''],
            ['temp', 'Temp (°C)', ''],
          ].map(([k, t, ph]) => (
            <label key={k} className="block text-xs text-slate-600">
              {t}
              <input name={k} placeholder={ph} aria-label={`${t} a la salida`} className={claseCampo} />
            </label>
          ))}
        </div>
        <CampoDictado name="indicaciones" etiqueta="Indicaciones postanestésicas" placeholder="Vigilancia, analgesia, antiemético, oxígeno, dieta…" />
        <CampoDictado name="observaciones" etiqueta="Observaciones" rows={2} />
        <label className={claseEtiqueta}>
          Recibe
          <input name="recibe" placeholder="Nombre de quien recibe al paciente" className={claseCampo} />
        </label>
      </FormAccion>
    </div>
  )
}
