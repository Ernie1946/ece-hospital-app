'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ResultadoAsignacion } from '@/app/enfermeria/asignacion/acciones'

export type EnfermeraTurno = { id: string; nombre: string; area: string | null }
export type CamaTurno = { cama: string; grupo: string; estado: string; paciente: string | null; tipo: string }
type Asignada = { enfermera_id: string; enfermera: string }

// Asignación de camas a enfermeras en un turno: se elige una enfermera,
// se marcan sus camas y se asignan. La Jefatura de Enfermería edita;
// los demás solo consultan.
export function AsignacionTurno({
  editable,
  enfermeras,
  camas,
  asignaciones,
  asignar,
  copiar,
  etiquetaCopiar,
}: {
  editable: boolean
  enfermeras: EnfermeraTurno[]
  camas: CamaTurno[]
  asignaciones: Record<string, Asignada>
  asignar: (enfermera: string | null, camas: string[]) => Promise<ResultadoAsignacion>
  copiar: () => Promise<ResultadoAsignacion>
  etiquetaCopiar: string
}) {
  const [elegida, setElegida] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [mensaje, setMensaje] = useState<ResultadoAsignacion>({})
  const [pendiente, iniciar] = useTransition()

  // Carga de trabajo por enfermera en este turno
  const carga = useMemo(() => {
    const m = new Map<string, { camas: number; pacientes: number }>()
    for (const c of camas) {
      const a = asignaciones[c.cama]
      if (!a) continue
      const x = m.get(a.enfermera_id) ?? { camas: 0, pacientes: 0 }
      x.camas++
      if (c.paciente) x.pacientes++
      m.set(a.enfermera_id, x)
    }
    return m
  }, [camas, asignaciones])

  const grupos = useMemo(() => {
    const g = new Map<string, CamaTurno[]>()
    for (const c of camas) g.set(c.grupo, [...(g.get(c.grupo) ?? []), c])
    return [...g.entries()]
  }, [camas])

  const sinEnfermera = camas.filter((c) => c.paciente && !asignaciones[c.cama]).length
  const t = busqueda.trim().toLowerCase()
  const lista = enfermeras
    .filter((e) => !t || e.nombre.toLowerCase().includes(t) || (e.area ?? '').toLowerCase().includes(t))
    .sort((a, b) => (carga.has(b.id) ? 1 : 0) - (carga.has(a.id) ? 1 : 0) || a.nombre.localeCompare(b.nombre, 'es'))
  const nombreElegida = enfermeras.find((e) => e.id === elegida)?.nombre

  function alternar(cama: string) {
    setSeleccion((s) => {
      const n = new Set(s)
      if (n.has(cama)) n.delete(cama)
      else n.add(cama)
      return n
    })
  }

  function ejecutar(f: () => Promise<ResultadoAsignacion>) {
    setMensaje({})
    iniciar(async () => {
      const r = await f()
      setMensaje(r)
      if (r.ok) setSeleccion(new Set())
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {/* Enfermeras */}
      <aside className="space-y-2 lg:col-span-1">
        <h2 className="text-sm font-semibold text-slate-800">Enfermeras</h2>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar enfermera o área"
          aria-label="Buscar enfermera"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <ul className="max-h-[32rem] space-y-1 overflow-y-auto text-sm" aria-label="Enfermeras">
          {lista.map((e) => {
            const c = carga.get(e.id)
            return (
              <li key={e.id}>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 ${
                    elegida === e.id ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="enfermera"
                    checked={elegida === e.id}
                    onChange={() => setElegida(e.id)}
                    disabled={!editable}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">{e.nombre}</span>
                    <span className="block text-xs text-slate-500">
                      {e.area ?? 'Sin área base'}
                      {c ? ` · ${c.camas} cama(s), ${c.pacientes} paciente(s)` : ''}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Camas */}
      <div className="space-y-3 lg:col-span-3">
        {editable && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm">
            <span className="text-slate-700">
              {seleccion.size} cama(s) marcada(s){nombreElegida ? ` · ${nombreElegida}` : ' · elige una enfermera'}
            </span>
            <button
              type="button"
              disabled={pendiente || !elegida || seleccion.size === 0}
              onClick={() => ejecutar(() => asignar(elegida, [...seleccion]))}
              className="rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              Asignar a {nombreElegida ?? '…'}
            </button>
            <button
              type="button"
              disabled={pendiente || seleccion.size === 0}
              onClick={() => ejecutar(() => asignar(null, [...seleccion]))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Quitar asignación
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => ejecutar(copiar)}
              className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {etiquetaCopiar}
            </button>
          </div>
        )}
        {mensaje.error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mensaje.error}
          </p>
        )}
        {mensaje.ok && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {mensaje.ok}
          </p>
        )}
        {sinEnfermera > 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {sinEnfermera} paciente(s) sin enfermera asignada en este turno.
          </p>
        )}

        {grupos.map(([grupo, lista]) => (
          <section key={grupo} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{grupo}</h3>
              {editable && (
                <button
                  type="button"
                  onClick={() =>
                    setSeleccion((s) => {
                      const n = new Set(s)
                      const todas = lista.every((c) => n.has(c.cama))
                      for (const c of lista) if (todas) n.delete(c.cama)
                      else n.add(c.cama)
                      return n
                    })
                  }
                  className="text-xs text-sky-700 hover:underline"
                >
                  Marcar / desmarcar todas
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
              {lista.map((c) => {
                const a = asignaciones[c.cama]
                const marcada = seleccion.has(c.cama)
                return (
                  <label
                    key={c.cama}
                    className={`flex cursor-pointer items-start gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                      marcada ? 'border-sky-600 bg-sky-50' : c.paciente && !a ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                    }`}
                  >
                    {editable && (
                      <input type="checkbox" aria-label={`Cama ${c.cama}`} checked={marcada} onChange={() => alternar(c.cama)} className="mt-0.5" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{c.cama}</span>
                      <span className="block truncate text-slate-600" title={c.paciente ?? undefined}>
                        {c.paciente ?? (c.estado === 'disponible' ? 'Libre' : c.estado)}
                      </span>
                      <span className={`block truncate ${a ? 'text-sky-800' : 'text-slate-400'}`} title={a?.enfermera}>
                        {a ? a.enfermera : 'Sin enfermera'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
