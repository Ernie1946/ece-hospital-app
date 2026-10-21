'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { pesos } from '@/lib/catalogos'
import type { ArticuloCargo, CargoHecho, PacienteCargo } from '@/app/cargos/acciones'

type Acciones = {
  buscarPorPulsera: (c: string) => Promise<{ error?: string; paciente?: PacienteCargo }>
  buscarPacientes: (t: string) => Promise<PacienteCargo[]>
  elegirPaciente: (e: string) => Promise<{ error?: string; paciente?: PacienteCargo }>
  buscarArticulo: (c: string, e: string) => Promise<{ error?: string; articulo?: ArticuloCargo }>
  buscarArticulos: (t: string) => Promise<ArticuloCargo[]>
  cargar: (e: string, c: number, n: number, lote: string, serie: string) => Promise<{ error?: string; ok?: string }>
  cargosDelPaciente: (e: string) => Promise<CargoHecho[]>
  cancelarCargo: (id: number, motivo: string) => Promise<{ error?: string }>
}

// Cargo al paciente con lector: 1) pulsera  2) código del artículo  3) cantidad (y lote/serie si aplica)
export function CargoLector({ acciones, usuarioId, verCuenta }: { acciones: Acciones; usuarioId: string; verCuenta: boolean }) {
  const [paciente, setPaciente] = useState<PacienteCargo | null>(null)
  const [articulo, setArticulo] = useState<ArticuloCargo | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [lote, setLote] = useState('')
  const [serie, setSerie] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cargos, setCargos] = useState<CargoHecho[]>([])
  const [sugPac, setSugPac] = useState<PacienteCargo[]>([])
  const [sugArt, setSugArt] = useState<ArticuloCargo[]>([])
  const [pendiente, iniciar] = useTransition()
  const refPulsera = useRef<HTMLInputElement>(null)
  const refArticulo = useRef<HTMLInputElement>(null)
  const refCantidad = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!paciente) refPulsera.current?.focus()
    else if (!articulo) refArticulo.current?.focus()
    else refCantidad.current?.select()
  }, [paciente, articulo])

  const refrescar = (e: string) => acciones.cargosDelPaciente(e).then(setCargos)

  function tomarPaciente(r: { error?: string; paciente?: PacienteCargo }) {
    if (r.error || !r.paciente) return setMsg({ tipo: 'error', texto: r.error ?? 'Paciente no encontrado.' })
    setPaciente(r.paciente)
    setSugPac([])
    setMsg(null)
    refrescar(r.paciente.encuentro_id)
  }

  function tomarArticulo(a: ArticuloCargo) {
    setArticulo(a)
    setSugArt([])
    setCantidad('1')
    setLote('')
    setSerie('')
    setMsg(null)
  }

  function enviar() {
    if (!paciente || !articulo) return
    const n = Number(cantidad)
    if (!Number.isFinite(n) || n <= 0) return setMsg({ tipo: 'error', texto: 'Cantidad no válida.' })
    iniciar(async () => {
      const r = await acciones.cargar(paciente.encuentro_id, articulo.id, n, lote.trim(), serie.trim())
      if (r.error) return setMsg({ tipo: 'error', texto: r.error })
      setMsg({ tipo: 'ok', texto: `${articulo.descripcion} × ${n}: ${r.ok}` })
      setArticulo(null)
      if (refArticulo.current) refArticulo.current.value = ''
      refrescar(paciente.encuentro_id)
    })
  }

  const total = cargos.filter((c) => !c.cancelado).reduce((s, c) => s + Number(c.importe), 0)

  return (
    <div className="space-y-4">
      {/* 1. Paciente */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">1. Paciente</h2>
        {paciente ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{paciente.paciente}</p>
              <p className="text-sm text-slate-600">
                Exp. {paciente.expediente}
                {paciente.cama ? ` · ${paciente.area ?? ''} cama ${paciente.cama}` : ''} · Lista: {paciente.lista}
              </p>
            </div>
            <div className="flex gap-2">
              {verCuenta && (
                <a href={`/cargos/cuenta/${paciente.encuentro_id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  Estado de cuenta
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setPaciente(null)
                  setArticulo(null)
                  setCargos([])
                  setMsg(null)
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Otro paciente
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const v = refPulsera.current?.value.trim()
                if (v) iniciar(async () => tomarPaciente(await acciones.buscarPorPulsera(v)))
              }}
            >
              <label className={claseEtiqueta}>
                Escanea la pulsera
                <input ref={refPulsera} aria-label="Pulsera del paciente" autoComplete="off" placeholder="Código de la pulsera" className={claseCampo} />
              </label>
            </form>
            <div className="relative">
              <label className={claseEtiqueta}>
                o busca por nombre, expediente o cama
                <input
                  aria-label="Buscar paciente"
                  autoComplete="off"
                  className={claseCampo}
                  onChange={(e) => {
                    const t = e.target.value
                    if (t.trim().length < 3) return setSugPac([])
                    acciones.buscarPacientes(t).then(setSugPac)
                  }}
                />
              </label>
              {sugPac.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white text-sm shadow">
                  {sugPac.map((p) => (
                    <li key={p.encuentro_id}>
                      <button type="button" onClick={() => iniciar(async () => tomarPaciente(await acciones.elegirPaciente(p.encuentro_id)))} className="w-full px-3 py-1.5 text-left hover:bg-sky-50">
                        {p.paciente} <span className="text-xs text-slate-500">· {p.expediente} · {p.cama}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. Artículo */}
      {paciente && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">2. Artículo</h2>
          {!articulo ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = refArticulo.current?.value.trim()
                  if (!v) return
                  iniciar(async () => {
                    const r = await acciones.buscarArticulo(v, paciente.encuentro_id)
                    if (r.error || !r.articulo) return setMsg({ tipo: 'error', texto: r.error ?? 'Artículo no encontrado.' })
                    tomarArticulo(r.articulo)
                  })
                }}
              >
                <label className={claseEtiqueta}>
                  Escanea el código de barras
                  <input ref={refArticulo} aria-label="Código del artículo" autoComplete="off" placeholder="Código de barras o clave" className={claseCampo} />
                </label>
              </form>
              <div className="relative">
                <label className={claseEtiqueta}>
                  o busca por descripción
                  <input
                    aria-label="Buscar artículo"
                    autoComplete="off"
                    className={claseCampo}
                    onChange={(e) => {
                      const t = e.target.value
                      if (t.trim().length < 3) return setSugArt([])
                      acciones.buscarArticulos(t).then(setSugArt)
                    }}
                  />
                </label>
                {sugArt.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow">
                    {sugArt.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() =>
                            iniciar(async () => {
                              const r = await acciones.buscarArticulo(a.clave, paciente.encuentro_id)
                              if (r.articulo) tomarArticulo(r.articulo)
                              else setMsg({ tipo: 'error', texto: r.error ?? 'Artículo no encontrado.' })
                            })
                          }
                          className="w-full px-3 py-1.5 text-left hover:bg-sky-50"
                        >
                          {a.descripcion} <span className="text-xs text-slate-500">· {a.area} · {pesos(a.precio)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <form
              className="mt-2 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                enviar()
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {articulo.descripcion} <span className="font-mono text-xs text-slate-400">{articulo.clave}</span>
                </p>
                <p className="text-sm text-slate-700">
                  {articulo.precio === null ? <span className="text-amber-800">Sin precio autorizado (queda pendiente)</span> : `${pesos(articulo.precio)} / ${articulo.unidad}`}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-end">
                <label className={claseEtiqueta}>
                  Cantidad
                  <input ref={refCantidad} aria-label="Cantidad" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={claseCampo} />
                </label>
                {articulo.requiere_lote && (
                  <>
                    <label className={claseEtiqueta}>
                      Lote
                      <input aria-label="Lote" value={lote} onChange={(e) => setLote(e.target.value)} className={claseCampo} />
                    </label>
                    <label className={claseEtiqueta}>
                      Número de serie
                      <input aria-label="Número de serie" value={serie} onChange={(e) => setSerie(e.target.value)} className={claseCampo} />
                    </label>
                  </>
                )}
                <div className="flex gap-2">
                  <button disabled={pendiente} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60">
                    {pendiente ? 'Cargando…' : 'Cargar a la cuenta'}
                  </button>
                  <button type="button" onClick={() => setArticulo(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Cambiar
                  </button>
                </div>
              </div>
              {articulo.precio !== null && Number(cantidad) > 0 && <p className="text-sm text-slate-600">Importe: {pesos(articulo.precio * Number(cantidad))}</p>}
            </form>
          )}
          {msg && (
            <p role={msg.tipo === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-lg border px-3 py-2 text-sm ${msg.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {msg.texto}
            </p>
          )}
        </section>
      )}
      {!paciente && msg && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg.texto}
        </p>
      )}

      {/* Cargos recientes del paciente */}
      {paciente && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Últimos cargos de este paciente</h2>
            <span className="text-sm text-slate-600">Suma de los mostrados: {pesos(total)}</span>
          </div>
          {cargos.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Sin cargos todavía.</p>
          ) : (
            <table className="mt-2 w-full text-left text-sm" aria-label="Cargos del paciente">
              <tbody>
                {cargos.map((c) => (
                  <tr key={c.id} className={`border-t border-slate-100 ${c.cancelado ? 'text-slate-400 line-through' : ''}`}>
                    <td className="py-1 pr-2">
                      {c.descripcion}
                      {(c.lote || c.serie) && <span className="block text-xs text-slate-500">Lote {c.lote ?? '—'} · Serie {c.serie ?? '—'}</span>}
                    </td>
                    <td className="pr-2 text-xs text-slate-500">{c.area_nombre}</td>
                    <td className="pr-2 text-right tabular-nums">{Number(c.cantidad)}</td>
                    <td className="pr-2 text-right tabular-nums">
                      {c.precio_pendiente ? <span className="text-xs text-amber-800">precio pendiente</span> : pesos(c.importe)}
                    </td>
                    <td className="pr-2 text-xs text-slate-500">{c.creado_por_nombre}</td>
                    <td className="text-right">
                      {!c.cancelado && c.origen === 'area' && c.creado_por === usuarioId && (
                        <button
                          type="button"
                          className="text-xs text-red-700 hover:underline"
                          onClick={() => {
                            const motivo = window.prompt('Motivo de la cancelación')
                            if (!motivo) return
                            iniciar(async () => {
                              const r = await acciones.cancelarCargo(c.id, motivo)
                              if (r.error) setMsg({ tipo: 'error', texto: r.error })
                              refrescar(paciente.encuentro_id)
                            })
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
