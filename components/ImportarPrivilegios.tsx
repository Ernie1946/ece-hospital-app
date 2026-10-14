'use client'

import { useState } from 'react'
import readXlsxFile from 'read-excel-file/browser'
import {
  ACCION_REVISION,
  interpretarEspecialidades,
  interpretarPrivilegios,
  type FilaEspecialidad,
  type FilaPrivilegio,
  type RevisionFila,
} from '@/lib/privilegios'

type Procesar<F> = (filas: F[], aplicar: boolean) => Promise<{ error?: string; resultado?: RevisionFila[] }>
const llano = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Privilegios y especialidades desde Excel: 1) leer  2) vista previa revisada por la base  3) aplicar
export function ImportarPrivilegios({ privilegios, especialidades }: { privilegios: Procesar<FilaPrivilegio>; especialidades: Procesar<FilaEspecialidad> }) {
  const [archivo, setArchivo] = useState<string | null>(null)
  const [filasP, setFilasP] = useState<FilaPrivilegio[]>([])
  const [filasE, setFilasE] = useState<FilaEspecialidad[]>([])
  const [revP, setRevP] = useState<RevisionFila[]>([])
  const [revE, setRevE] = useState<RevisionFila[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [progreso, setProgreso] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState<{ p: RevisionFila[]; e: RevisionFila[] } | null>(null)

  async function revisar<F>(filas: F[], fn: Procesar<F>, aplicar: boolean, nombre: string, lote: number) {
    const todas: RevisionFila[] = []
    for (let i = 0; i < filas.length; i += lote) {
      setProgreso(`${aplicar ? 'Aplicando' : 'Revisando'} ${nombre}: ${Math.min(i + lote, filas.length)} de ${filas.length}…`)
      const r = await fn(filas.slice(i, i + lote), aplicar)
      if (r.error) throw new Error(r.error)
      todas.push(...(r.resultado ?? []))
    }
    return todas
  }

  async function leer(f: File) {
    setArchivo(f.name)
    setRevP([])
    setRevE([])
    setAplicado(null)
    setAvisos([])
    let hojas: { sheet: string; data: unknown[][] }[]
    try {
      hojas = (await readXlsxFile(f)) as unknown as { sheet: string; data: unknown[][] }[]
    } catch {
      setAvisos(['No pude leer el archivo. Debe ser Excel (.xlsx); usa la plantilla.'])
      return
    }
    const hp = hojas.find((h) => llano(h.sheet).startsWith('privilegio')) ?? (hojas.length === 1 ? hojas[0] : undefined)
    const he = hojas.find((h) => llano(h.sheet).startsWith('especialidad'))
    const p = hp ? interpretarPrivilegios(hp.data) : { filas: [], avisos: [] }
    const e = he ? interpretarEspecialidades(he.data) : { filas: [], avisos: [] }
    const av = [...p.avisos, ...e.avisos]
    if (!hp && !he) av.push('El archivo no tiene hojas "Privilegios" ni "Especialidades". Usa la plantilla.')
    setFilasP(p.filas)
    setFilasE(e.filas)
    setAvisos(av)
    try {
      if (p.filas.length) setRevP(await revisar(p.filas, privilegios, false, 'privilegios', 500))
      if (e.filas.length) setRevE(await revisar(e.filas, especialidades, false, 'especialidades', 500))
    } catch (err) {
      setAvisos((a) => [...a, (err as Error).message])
    }
    setProgreso(null)
  }

  const listas = (rev: RevisionFila[]) => rev.filter((r) => r.accion !== 'error' && r.accion !== 'sin_cambios').map((r) => r.fila)
  const okP = listas(revP)
  const okE = listas(revE)
  const errores = [...revP, ...revE].filter((r) => r.accion === 'error').length

  async function aplicar() {
    if (!window.confirm(`¿Aplicar ${okP.length} fila(s) de privilegios y ${okE.length} de especialidades? Las filas con error no se aplican.`)) return
    try {
      const p = okP.length ? await revisar(filasP.filter((f) => okP.includes(f.fila)), privilegios, true, 'privilegios', 100) : []
      const e = okE.length ? await revisar(filasE.filter((f) => okE.includes(f.fila)), especialidades, true, 'especialidades', 100) : []
      setAplicado({ p, e })
      setRevP([])
      setRevE([])
    } catch (err) {
      setAvisos((a) => [...a, (err as Error).message])
    }
    setProgreso(null)
  }

  const Tabla = ({ titulo, filas }: { titulo: string; filas: RevisionFila[] }) =>
    filas.length === 0 ? null : (
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">
          {titulo} · {filas.length} fila(s)
        </h3>
        <table className="w-full text-left text-sm" aria-label={titulo}>
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Fila</th>
              <th>Usuario</th>
              <th>Médico</th>
              <th>Qué se hará</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={`${titulo}-${r.fila}`} className={`border-t border-slate-100 align-top ${r.accion === 'error' ? 'bg-red-50' : ''}`}>
                <td className="py-1 font-mono text-xs">{r.fila}</td>
                <td className="font-mono text-xs">{r.usuario}</td>
                <td>{r.medico ?? '—'}</td>
                <td>
                  <span className={`rounded px-1.5 text-xs ${ACCION_REVISION[r.accion]?.color}`}>{ACCION_REVISION[r.accion]?.texto ?? r.accion}</span>
                </td>
                <td className="text-xs">{r.errores ? <span className="text-red-800">{r.errores}</span> : r.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/plantilla-privilegios.xlsx" download className="rounded-lg border border-sky-700 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-50">
          Descargar plantilla de Excel
        </a>
        <label className="text-sm font-medium text-slate-700">
          Archivo lleno (.xlsx)
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])}
            className="ml-2 text-sm"
          />
        </label>
        {archivo && <span className="text-xs text-slate-500">{archivo}</span>}
      </div>
      {avisos.map((a) => (
        <p key={a} role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {a}
        </p>
      ))}
      {progreso && <p className="text-sm text-slate-600">{progreso}</p>}

      {(revP.length > 0 || revE.length > 0) && (
        <>
          <p className="text-sm text-slate-700">
            Vista previa (aún no se guarda nada): <strong>{okP.length}</strong> fila(s) de privilegios y <strong>{okE.length}</strong> de especialidades por aplicar
            {errores ? (
              <>
                {' '}
                · <strong className="text-red-800">{errores} con error</strong> (corrígelas en el Excel y vuelve a subirlo, o aplica solo las correctas)
              </>
            ) : null}
            .
          </p>
          <Tabla titulo="Privilegios" filas={revP} />
          <Tabla titulo="Especialidades" filas={revE} />
          <button
            type="button"
            disabled={!!progreso || okP.length + okE.length === 0}
            onClick={aplicar}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
          >
            Aplicar {okP.length + okE.length} fila(s)
          </button>
        </>
      )}

      {aplicado && (
        <div role="status" className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>
            Listo: {aplicado.p.filter((r) => r.accion !== 'error').length} fila(s) de privilegios y {aplicado.e.filter((r) => r.accion !== 'error').length} de
            especialidades aplicadas.
          </p>
          {[...aplicado.p, ...aplicado.e]
            .filter((r) => r.accion === 'error')
            .map((r) => (
              <p key={`x${r.fila}${r.usuario}`} className="text-red-800">
                Fila {r.fila} ({r.usuario}): {r.errores}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
