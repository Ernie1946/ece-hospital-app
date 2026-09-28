'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

// Código de barras CODE128 (el que leen los escáneres de farmacia y enfermería)
export function CodigoBarras({ valor, alto = 40 }: { valor: string; alto?: number }) {
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svg.current) {
      JsBarcode(svg.current, valor, {
        format: 'CODE128',
        height: alto,
        width: 1.6,
        margin: 0,
        fontSize: 12,
        displayValue: true,
      })
    }
  }, [valor, alto])

  return <svg ref={svg} role="img" aria-label={`Código de barras ${valor}`} />
}
