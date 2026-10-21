'use client'

import { useState } from 'react'
import readXlsxFile from 'read-excel-file/browser'
import { ACCION, interpretarArticulos, type FilaArticulo, type Revision } from '@/lib/catalogos'

type Procesar = (filas: FilaArticulo[], aplicar: boolean) => Promise<{ error?: string; resultado?: Revision[] }>

// Catálogo del área desde Excel: 1) leer  2) vista previa revisada por la base  3) aplicar
export function ImportarArticulos({ area, procesar }: { area: string; procesar: Procesar }) {
  const [archivo, setArchivo] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaArticulo[]>([])
  const [rev, setRev] = useState<Revision[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [progreso, setProgreso] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState<Revision[] | null>(null)
  const [verTodo, setVerTodo] = useState(false)

  async function porLotes(lista: FilaArticulo[], aplicar: boolean) {
    const todas: Revision[] = []
    const lote = aplicar ? 200 : 500
    for (let i = 0; i < lista.length; i += lote) {
      setProgreso(`${aplicar ? 'Guardando' : 'Revisando'} ${Math.min(i + lote, lista.length)} de ${lista.length}…`)
      const r = await procesar(lista.slice(i, i + lote), aplicar)
      if (r.error) throw new Error(r.error)
      todas.push(...(r.resultado ?? []))
    }
    return todas
  }

  async function leer(f: File) {
    setArchivo(f.name)
    setRev([])
    setAplicado(null)
    setAvisos([])
    let hojas: { sheet: string; data: unknown[][] }[]
    try {
      hojas = (await readXlsxFile(f)) as unknown as { sheet: string; data: unknown[][] }[]
    } catch {
      setAvisos(['No pude leer el archivo. Debe ser Excel (.xlsx); si es .xls o .csv, ábrelo en Excel y guárdalo como .xlsx.'])
      return
    }
    const hoja = hojas.find((h) => /art[ií]culos|cat[aá]logo/i.test(h.sheet)) ?? hojas[0]
    const r = interpretarArticulos(hoja?.data ?? [])
    setFilas(r.filas)
    setAvisos(r.avisos)
    if (!r.filas.length) return
    try {
      setRev(await porLotes(r.filas, false))
    } catch (err) {
      setAvisos((a) => [...a, (err as Error).message])
    }
    setProgreso(null)
  }

  const porAplicar = rev.filter((r) => r.accion !== 'error' && r.accion !== 'sin_cambios').map((r) => r.fila)
  const errores = rev.filter((r) => r.accion === 'error').length
  const cuenta = (a: Revision['accion']) => rev.filter((r) => r.accion === a).length
  const visibles = verTodo ? rev : rev.filter((r) => r.accion !== 'sin_cambios')

  async function aplicar() {
    if (!window.confirm(`¿Guardar ${porAplicar.length} artículo(s)? Los precios nuevos o cambiados quedan en espera de autorización de Costos.`)) return
    try {
      const r = await porLotes(filas.filter((f) => porAplicar.includes(f.fila)), true)
      setAplicado(r)
      setRev([])
    } catch (err) {
      setAvisos((a) => [...a, (err as Error).message])
    }
    setProgreso(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/catalogos/${area}/plantilla`} className="rounded-lg border border-sky-700 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-50">
          Descargar catálogo en Excel
        </a>
        <label className="text-sm font-medium text-slate-700">
          Subir Excel (.xlsx)
          <input
            type="file"
            aria-label="Subir Excel del catálogo"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])}
            className="ml-2 text-sm"
          />
        </label>
        {archivo && <span className="text-xs text-slate-500">{archivo}</span>}
      </div>
      <p className="text-xs text-slate-500">
        Descarga el catálogo actual, agrega o corrige renglones y vuelve a subirlo. Los artículos que no vengan en el archivo no se tocan. Para retirar uno, pon “No” en Activo.
      </p>
      {avisos.map((a) => (
        <p key={a} role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {a}
        </p>
      ))}
      {progreso && <p className="text-sm text-slate-600">{progreso}</p>}

      {rev.length > 0 && (
        <>
          <p className="text-sm text-slate-700">
            Vista previa (aún no se guarda nada): {cuenta('nuevo')} nuevo(s), {cuenta('cambio') + cuenta('cambio_precio')} con cambios,{' '}
            {cuenta('precio') + cuenta('cambio_precio')} con precio nuevo, {cuenta('sin_cambios')} sin cambios
            {errores ? (
              <>
                {' '}
                · <strong className="text-red-800">{errores} con error</strong> (corrígelos en el Excel o guarda solo los correctos)
              </>
            ) : null}
            .
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm" aria-label="Vista previa del catálogo">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1">Fila</th>
                  <th>Clave</th>
                  <th>Qué se hará</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.fila} className={`border-t border-slate-100 ${r.accion === 'error' ? 'bg-red-50' : ''}`}>
                    <td className="px-2 py-1 font-mono text-xs">{r.fila}</td>
                    <td className="font-mono text-xs">{r.clave}</td>
                    <td>
                      <span className={`rounded px-1.5 text-xs ${ACCION[r.accion].clase}`}>{ACCION[r.accion].texto}</span>
                    </td>
                    <td className={`text-xs ${r.accion === 'error' ? 'text-red-800' : 'text-slate-600'}`}>{r.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cuenta('sin_cambios') > 0 && (
            <button type="button" onClick={() => setVerTodo((v) => !v)} className="text-xs text-sky-700 hover:underline">
              {verTodo ? 'Ocultar los que no cambian' : `Ver también los ${cuenta('sin_cambios')} sin cambios`}
            </button>
          )}
          <div>
            <button
              type="button"
              disabled={!!progreso || porAplicar.length === 0}
              onClick={aplicar}
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
            >
              Guardar {porAplicar.length} artículo(s)
            </button>
          </div>
        </>
      )}

      {aplicado && (
        <div role="status" className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>
            Listo: {aplicado.filter((r) => r.accion !== 'error').length} artículo(s) guardados.
            {aplicado.some((r) => ['nuevo', 'precio', 'cambio_precio'].includes(r.accion)) && ' Los precios nuevos esperan la autorización de Costos.'}
          </p>
          {aplicado
            .filter((r) => r.accion === 'error')
            .map((r) => (
              <p key={`x${r.fila}`} className="text-red-800">
                Fila {r.fila} ({r.clave}): {r.mensaje}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
