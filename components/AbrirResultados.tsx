'use client'

import { useActionState } from 'react'
import type { EstadoApertura } from '@/app/r/[token]/acciones'

export function AbrirResultados({ accion }: { accion: (previo: EstadoApertura, datos: FormData) => Promise<EstadoApertura> }) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null)
  return (
    <form action={ejecutar} className="space-y-3">
      <p className="text-sm text-slate-700">Para proteger su información, escriba la fecha de nacimiento del paciente.</p>
      <label className="block text-sm font-medium text-slate-700">
        Fecha de nacimiento
        <input
          name="fecha_nacimiento"
          type="date"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>
      {estado?.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      <button disabled={pendiente} className="w-full rounded-lg bg-sky-700 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60">
        {pendiente ? 'Verificando…' : 'Ver mis resultados'}
      </button>
    </form>
  )
}
