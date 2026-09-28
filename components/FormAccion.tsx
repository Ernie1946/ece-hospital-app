'use client'

import { startTransition, useActionState, useEffect, useRef } from 'react'

export type Resultado = { error?: string; ok?: string } | null

// Formulario que llama una Server Action y muestra el error o la confirmación.
// Conserva lo capturado si hay error; se limpia solo cuando se guardó bien.
export function FormAccion({
  accion,
  boton,
  children,
  className = 'space-y-3',
  variante = 'primario',
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  boton: string
  children?: React.ReactNode
  className?: string
  variante?: 'primario' | 'secundario'
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null)
  const formulario = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (estado?.ok) formulario.current?.reset()
  }, [estado])

  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault()
        const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
        startTransition(() => ejecutar(datos))
      }}
      className={className}
    >
      {children}
      {estado?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {estado.error}
        </p>
      )}
      {estado?.ok && (
        <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {estado.ok}
        </p>
      )}
      <button
        type="submit"
        disabled={pendiente}
        className={
          variante === 'primario'
            ? 'rounded-lg bg-sky-700 text-white text-sm font-medium px-4 py-2 hover:bg-sky-800 disabled:opacity-60'
            : 'rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60'
        }
      >
        {pendiente ? 'Guardando…' : boton}
      </button>
    </form>
  )
}
