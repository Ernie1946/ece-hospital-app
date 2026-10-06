'use client'

import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'

// Código de barras CODE128 (el que leen los escáneres de farmacia y enfermería).
// Con "copiable", debajo aparece el código con un botón para copiarlo: sirve
// para capturarlo a mano cuando no hay lector a la mano.
export function CodigoBarras({
  valor,
  alto = 40,
  ancho = 1.6,
  copiable = false,
}: {
  valor: string
  alto?: number
  ancho?: number
  copiable?: boolean
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (svg.current) {
      JsBarcode(svg.current, valor, {
        format: 'CODE128',
        height: alto,
        width: ancho,
        margin: 0,
        fontSize: 12,
        displayValue: !copiable,
      })
    }
  }, [valor, alto, ancho, copiable])

  return (
    <div className="inline-block max-w-full">
      <svg ref={svg} className="max-w-full h-auto" role="img" aria-label={`Código de barras ${valor}`} />
      {copiable && (
        <div className="flex items-center justify-center gap-2">
          <span className="select-all font-mono text-xs text-slate-900">{valor}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(valor)
                setCopiado(true)
                setTimeout(() => setCopiado(false), 2000)
              } catch {
                setCopiado(false)
              }
            }}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50 print:hidden"
          >
            {copiado ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  )
}
