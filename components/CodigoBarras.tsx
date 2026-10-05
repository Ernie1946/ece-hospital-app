'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

// Código de barras CODE128 (el que leen los escáneres de farmacia y enfermería)
export function CodigoBarras({ valor, alto = 40, ancho = 1.6 }: { valor: string; alto?: number; ancho?: number }) {
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svg.current) {
      JsBarcode(svg.current, valor, {
        format: 'CODE128',
        height: alto,
        width: ancho,
        margin: 0,
        fontSize: 12,
        displayValue: true,
      })
    }
  }, [valor, alto, ancho])

  return <svg ref={svg} className="max-w-full h-auto" role="img" aria-label={`Código de barras ${valor}`} />
}
