'use client'

import { useEffect, useState } from 'react'
import { csvCredenciales, nombreArchivoCredenciales, type Credencial } from '@/lib/personal'

// Contraseñas temporales recién generadas: se muestran UNA sola vez.
// Se pueden descargar (Excel/CSV) o imprimir una hoja recortable por persona.
export function Credenciales({ lista }: { lista: Credencial[] }) {
  const [sitio, setSitio] = useState('')
  useEffect(() => setSitio(window.location.origin), [])
  if (lista.length === 0) return null

  function descargar() {
    const blob = new Blob([csvCredenciales(lista)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nombreArchivoCredenciales()
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section aria-label="Contraseñas temporales" className="space-y-2">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 print:hidden">
        <p className="font-semibold">Contraseñas temporales ({lista.length})</p>
        <p>
          Solo se muestran ahora: descárgalas o imprímelas antes de salir de esta pantalla. Entrégalas en persona; al entrar por primera vez el
          sistema pide cambiarla.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={descargar} className="rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800">
            Descargar para Excel
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-sky-700 bg-white px-3 py-1.5 font-medium text-sky-800 hover:bg-sky-50">
            Imprimir hojas de acceso
          </button>
        </div>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-amber-900">
              <th className="py-1">Usuario</th>
              <th>Nombre</th>
              <th>Contraseña temporal</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.usuario} className="border-t border-amber-200">
                <td className="py-1 font-mono">{c.usuario}</td>
                <td>{c.nombre}</td>
                <td className="font-mono font-semibold">{c.contrasena}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hojas de acceso (solo al imprimir) */}
      <div className="hidden print:block">
        {lista.map((c) => (
          <div key={c.usuario} className="mb-4 break-inside-avoid border border-dashed border-slate-500 p-4 text-sm">
            <p className="text-base font-semibold">Expediente Clínico Electrónico · Acceso personal</p>
            <p className="mt-1">{c.nombre}</p>
            <p className="mt-2">
              Dirección: <strong>{sitio}</strong>
            </p>
            <p>
              Usuario: <strong className="font-mono">{c.usuario}</strong>
            </p>
            <p>
              Contraseña temporal: <strong className="font-mono">{c.contrasena}</strong>
            </p>
            <p className="mt-2 text-xs">
              Al entrar por primera vez se te pedirá cambiar la contraseña. Es personal e intransferible: todo lo que se registre con ella queda a tu
              nombre.
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
