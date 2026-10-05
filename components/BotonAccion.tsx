'use client'

import { useState, useTransition } from 'react'
import type { Resultado } from '@/components/FormAccion'

// Botón que ejecuta una Server Action sin formulario y muestra el resultado
export function BotonAccion({
  etiqueta,
  alHacer,
  variante = 'primario',
  confirmar,
}: {
  etiqueta: string
  alHacer: () => Promise<Resultado>
  variante?: 'primario' | 'secundario'
  confirmar?: string
}) {
  const [pendiente, iniciar] = useTransition()
  const [r, setR] = useState<Resultado>(null)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return
          iniciar(async () => setR(await alHacer()))
        }}
        className={
          variante === 'primario'
            ? 'rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60'
            : 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60'
        }
      >
        {pendiente ? 'Un momento…' : etiqueta}
      </button>
      {r?.error && (
        <span role="alert" className="text-sm text-red-700">
          {r.error}
        </span>
      )}
      {r?.ok && (
        <span role="status" className="text-sm text-emerald-800">
          {r.ok}
        </span>
      )}
    </span>
  )
}
