'use client'

export function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-sky-700 text-white text-sm font-medium px-4 py-2 hover:bg-sky-800 print:hidden"
    >
      Imprimir
    </button>
  )
}
