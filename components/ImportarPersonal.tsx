'use client'

import { useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { ACCION_FILA, COLUMNAS_PERSONAL, interpretarHojaPersonal, type Credencial, type FilaPersonal, type Validacion } from '@/lib/personal'
import type { ResultadoLote } from '@/app/personal/acciones'
import { Credenciales } from '@/components/Credenciales'

type Acciones = {
  validar: (filas: FilaPersonal[]) => Promise<{ error?: string; resultado?: Validacion[] }>
  aplicar: (filas: FilaPersonal[]) => Promise<ResultadoLote>
}

// Alta y cambios masivos del personal desde Excel:
// 1) leer el archivo  2) vista previa validada por la base  3) aplicar por lotes
export function ImportarPersonal({ validar, aplicar }: Acciones) {
  const [archivo, setArchivo] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaPersonal[]>([])
  const [validacion, setValidacion] = useState<Validacion[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [progreso, setProgreso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [resumen, setResumen] = useState<{ aplicadas: number; fallas: { usuario: string; error: string }[] } | null>(null)
  const [credenciales, setCredenciales] = useState<Credencial[]>([])

  async function leer(f: File) {
    setArchivo(f.name)
    setValidacion([])
    setResumen(null)
    setCredenciales([])
    let r: { filas: FilaPersonal[]; avisos: string[] }
    try {
      r = interpretarHojaPersonal((await readSheet(f)) as unknown[][])
    } catch {
      setFilas([])
      setAvisos(['No pude leer el archivo. Debe ser Excel (.xlsx); si es .xls o .csv, ábrelo en Excel y guárdalo como .xlsx.'])
      return
    }
    setFilas(r.filas)
    setAvisos(r.avisos)
    if (!r.filas.length) return
    setOcupado(true)
    const todas: Validacion[] = []
    for (let i = 0; i < r.filas.length; i += 500) {
      setProgreso(`Revisando ${Math.min(i + 500, r.filas.length)} de ${r.filas.length}…`)
      const v = await validar(r.filas.slice(i, i + 500))
      if (v.error) {
        setAvisos((a) => [...a, v.error!])
        setOcupado(false)
        setProgreso(null)
        return
      }
      todas.push(...(v.resultado ?? []))
    }
    // Repetidos entre lotes del mismo archivo
    const vistos = new Map<string, number>()
    for (const v of todas) if (v.usuario) vistos.set(v.usuario, (vistos.get(v.usuario) ?? 0) + 1)
    for (const v of todas)
      if (v.usuario && (vistos.get(v.usuario) ?? 0) > 1 && !v.errores?.includes('repetido')) v.errores = [v.errores, 'Usuario repetido en el archivo'].filter(Boolean).join('; ')
    setValidacion(todas)
    setProgreso(null)
    setOcupado(false)
  }

  const conError = validacion.filter((v) => v.errores)
  const porAplicar = validacion.filter((v) => !v.errores && v.accion !== 'sin_cambios')
  const cuenta = (a: string) => porAplicar.filter((v) => v.accion === a).length

  async function aplicarTodo() {
    const usuarios = new Set(porAplicar.map((v) => v.usuario))
    const lista = filas.filter((f) => usuarios.has(String(f.usuario ?? '').toLowerCase()))
    setOcupado(true)
    let aplicadas = 0
    const fallas: { usuario: string; error: string }[] = []
    const nuevas: Credencial[] = []
    for (let i = 0; i < lista.length; i += 20) {
      setProgreso(`Aplicando ${Math.min(i + 20, lista.length)} de ${lista.length}…`)
      const r = await aplicar(lista.slice(i, i + 20))
      if (r.error) {
        fallas.push({ usuario: `lote ${i / 20 + 1}`, error: r.error })
        if (r.error.includes('función "personal"')) break
        continue
      }
      aplicadas += r.aplicadas
      fallas.push(...r.fallas)
      nuevas.push(...r.credenciales)
      setCredenciales([...nuevas])
    }
    setResumen({ aplicadas, fallas })
    setValidacion([])
    setProgreso(null)
    setOcupado(false)
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-3 print:hidden">
        <p className="text-slate-700">
          Descarga la{' '}
          <a href="/plantilla-usuarios.xlsx" download className="font-medium text-sky-700 underline">
            plantilla de Excel
          </a>
          , llénala con una persona por renglón y súbela. Sirve para altas, cambios (de área, de rol, de vigencia) y bajas: si el usuario ya existe,
          solo se cambian las columnas que tengan algo escrito.
        </p>
        <details className="rounded-lg border border-slate-200 p-2">
          <summary className="cursor-pointer text-slate-700">Columnas de la plantilla</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
            {COLUMNAS_PERSONAL.map((c) => (
              <li key={c.clave}>
                <strong>
                  {c.titulo}
                  {c.obligatoria ? ' *' : ''}
                </strong>
                {c.nota ? ` — ${c.nota}` : ''}
              </li>
            ))}
          </ul>
        </details>
        <label className="block font-medium text-slate-700">
          Archivo de Excel (.xlsx)
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={ocupado}
            onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])}
            className="mt-1 block w-full text-sm"
          />
        </label>
        {avisos.map((a) => (
          <p key={a} role="alert" className="rounded bg-red-50 px-2 py-1 text-red-800">
            {a}
          </p>
        ))}
        {progreso && (
          <p role="status" className="rounded bg-sky-50 px-2 py-1 text-sky-900">
            {progreso}
          </p>
        )}

        {validacion.length > 0 && (
          <div className="space-y-2">
            <p className="text-slate-800">
              <strong>{archivo}</strong>: {validacion.length} renglones · {cuenta('alta')} altas · {cuenta('cambio')} cambios · {cuenta('baja')} bajas ·{' '}
              {cuenta('reactivar')} reactivaciones · {validacion.filter((v) => v.accion === 'sin_cambios' && !v.errores).length} sin cambios
              {conError.length > 0 && <span className="font-semibold text-red-800"> · {conError.length} con error (no se aplicarán)</span>}
            </p>
            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1">Fila</th>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Qué pasará</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {[...conError, ...validacion.filter((v) => !v.errores)].map((v) => (
                    <tr key={`${v.fila}-${v.usuario}`} className={`border-t border-slate-100 ${v.errores ? 'bg-red-50' : ''}`}>
                      <td className="px-2 py-1">{v.fila}</td>
                      <td className="font-mono">{v.usuario}</td>
                      <td>{v.nombre}</td>
                      <td>
                        {v.errores ? (
                          <span className="rounded bg-red-100 px-1 text-red-800">Error</span>
                        ) : (
                          <span className={`rounded px-1 ${ACCION_FILA[v.accion]?.color}`}>{ACCION_FILA[v.accion]?.texto ?? v.accion}</span>
                        )}
                      </td>
                      <td className={v.errores ? 'text-red-800' : 'text-slate-600'}>{v.errores ?? v.cambios ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={ocupado || porAplicar.length === 0}
              onClick={aplicarTodo}
              className="rounded-lg bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {porAplicar.length === 0 ? 'No hay nada que aplicar' : `Aplicar ${porAplicar.length} movimiento(s)`}
              {conError.length > 0 && porAplicar.length > 0 ? ` (se omiten ${conError.length} con error)` : ''}
            </button>
          </div>
        )}

        {resumen && (
          <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
            Listo: {resumen.aplicadas} movimiento(s) aplicados{credenciales.length ? `, ${credenciales.length} cuenta(s) nueva(s)` : ''}.
            {resumen.fallas.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-red-800">
                {resumen.fallas.map((f, i) => (
                  <li key={i}>
                    {f.usuario}: {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <Credenciales lista={credenciales} />
    </div>
  )
}
