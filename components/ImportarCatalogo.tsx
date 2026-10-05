'use client'

import { useState, useTransition } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { COLUMNAS_CATALOGO, interpretarHoja, type FilaCatalogo } from '@/lib/farmacia'
import type { ResultadoImportacion } from '@/app/farmacia/acciones'

// Importa el catálogo de medicamentos del hospital desde la plantilla de Excel:
// se lee en el navegador, se muestra una vista previa y luego se envía.
export function ImportarCatalogo({ importar }: { importar: (filas: FilaCatalogo[]) => Promise<ResultadoImportacion> }) {
  const [archivo, setArchivo] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaCatalogo[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [errores, setErrores] = useState<{ fila: number; error: string }[]>([])
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [pendiente, iniciar] = useTransition()

  async function leer(f: File) {
    setResultado(null)
    setArchivo(f.name)
    try {
      const hoja = (await readSheet(f)) as unknown[][]
      const r = interpretarHoja(hoja)
      setFilas(r.filas)
      setAvisos(r.avisos)
      setErrores(r.errores)
    } catch {
      setFilas([])
      setErrores([])
      setAvisos(['No pude leer el archivo. Debe ser Excel (.xlsx); si es .xls o .csv, ábrelo en Excel y guárdalo como .xlsx.'])
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-700">
        Descarga la{' '}
        <a href="/plantilla-medicamentos.xlsx" download className="font-medium text-sky-700 underline">
          plantilla de Excel
        </a>
        , que trae un catálogo base de medicamentos de uso hospitalario para que el comité de farmacia lo revise, ajuste claves y precios, y agregue los
        suyos. Si una clave ya existe se actualiza.
      </p>
      <details className="rounded-lg border border-slate-200 p-2">
        <summary className="cursor-pointer text-slate-700">Columnas de la plantilla</summary>
        <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
          {COLUMNAS_CATALOGO.map((c) => (
            <li key={c.clave}>
              <strong>
                {c.titulo}
                {c.obligatoria ? ' *' : ''}
              </strong>{' '}
              — {c.nota}
            </li>
          ))}
        </ul>
      </details>
      <label className="block font-medium text-slate-700">
        Archivo de Excel (.xlsx)
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])}
          className="mt-1 block w-full text-sm"
        />
      </label>

      {archivo && (
        <div className="space-y-2">
          {avisos.map((a) => (
            <p key={a} role="alert" className="rounded bg-red-50 px-2 py-1 text-red-800">
              {a}
            </p>
          ))}
          <p className="text-slate-700">
            <strong>{archivo}</strong>: {filas.length} medicamento(s) listos para importar
            {errores.length > 0 && `, ${errores.length} fila(s) con error que no se importarán`}.
          </p>
          {errores.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {errores.map((e) => (
                <li key={e.fila}>
                  Fila {e.fila}: {e.error}
                </li>
              ))}
            </ul>
          )}
          {filas.length > 0 && (
            <div className="max-h-72 overflow-auto rounded border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    {['Clave', 'Genérico', 'Concentración', 'Forma', 'Vía', 'Unidad', 'Máx/día', 'Ctrl', 'Alto riesgo', 'Precio', 'Lote'].map((t) => (
                      <th key={t} className="px-2 py-1">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 200).map((f) => (
                    <tr key={f.fila} className="border-t border-slate-100">
                      <td className="px-2 py-1 font-medium">{f.clave}</td>
                      <td className="px-2 py-1">{f.generico}</td>
                      <td className="px-2 py-1">{f.concentracion}</td>
                      <td className="px-2 py-1">{f.forma}</td>
                      <td className="px-2 py-1">{f.via}</td>
                      <td className="px-2 py-1">{f.unidad}</td>
                      <td className="px-2 py-1">{f.dosis_max_dia ?? ''}</td>
                      <td className="px-2 py-1">{f.controlado}</td>
                      <td className="px-2 py-1">{f.alto_riesgo}</td>
                      <td className="px-2 py-1">{f.precio}</td>
                      <td className="px-2 py-1">{f.lote ? `${f.lote} · ${f.caducidad} · ${f.existencia}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filas.length > 0 && !resultado && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => iniciar(async () => setResultado(await importar(filas)))}
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
            >
              {pendiente ? 'Importando…' : `Importar ${filas.length} medicamento(s)`}
            </button>
          )}
          {resultado?.error && (
            <p role="alert" className="rounded bg-red-50 px-2 py-1 text-red-800">
              {resultado.error}
            </p>
          )}
          {resultado && !resultado.error && (
            <div role="status" className="rounded bg-emerald-50 px-3 py-2 text-emerald-900">
              Importación terminada: {resultado.nuevos} nuevo(s), {resultado.actualizados} actualizado(s), {resultado.lotes} lote(s) de inventario.
              {(resultado.errores?.length ?? 0) > 0 && (
                <ul className="mt-1 text-xs text-red-800">
                  {resultado.errores!.map((e) => (
                    <li key={`${e.fila}-${e.clave}`}>
                      Fila {e.fila} ({e.clave}): {e.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
