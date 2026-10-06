'use client'

import { useEffect, useRef, useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'

export type AyudaSinLector = { pulsera: string | null; dosis: { codigo: string; texto: string }[] }

// Administración a pie de cama: se escanea la pulsera y luego la etiqueta.
// El lector de código de barras "teclea" el código y un Enter: con el Enter
// de la pulsera pasa a la etiqueta y con el de la etiqueta se registra.
// La pulsera escaneada se conserva 15 minutos (la visita a la cama): para
// varias dosis del mismo paciente solo se escanea la etiqueta de cada una.
// En modo de prueba (sin lector) la pulsera se llena sola y cada dosis tiene "Usar".
const VIGENCIA_PULSERA_MS = 15 * 60 * 1000
export function AdministrarDosis({
  accion,
  verificadores,
  encuentroId,
  ayuda,
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  verificadores: { id: string; texto: string }[]
  encuentroId: string
  ayuda: AyudaSinLector | null
}) {
  const clave = `ece-administrar-${encuentroId}`
  const etiquetaRef = useRef<HTMLInputElement>(null)
  const [pulsera, setPulsera] = useState('')
  const [etiqueta, setEtiqueta] = useState('')

  const [listo, setListo] = useState(false)
  const pulseraPrueba = ayuda?.pulsera ?? null

  // Recupera lo capturado antes de salir de la página (la pulsera, solo si es reciente)
  useEffect(() => {
    let p = ''
    let e = ''
    try {
      const g = JSON.parse(sessionStorage.getItem(clave) ?? '{}') as { pulsera?: string; etiqueta?: string; en?: number }
      if (g.pulsera && g.en && Date.now() - g.en < VIGENCIA_PULSERA_MS) p = g.pulsera
      if (g.etiqueta) e = g.etiqueta
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
    setPulsera(p || pulseraPrueba || '')
    setEtiqueta(e)
    setListo(true)
  }, [clave, pulseraPrueba])

  useEffect(() => {
    if (!listo) return
    try {
      sessionStorage.setItem(clave, JSON.stringify({ pulsera, etiqueta, en: Date.now() }))
    } catch {
      /* sin almacenamiento */
    }
  }, [clave, pulsera, etiqueta, listo])

  // Tras administrar se limpia solo la etiqueta: la pulsera sigue para la siguiente dosis
  const limpiar = () => {
    setEtiqueta('')
    etiquetaRef.current?.focus({ preventScroll: true })
  }

  return (
    <FormAccion accion={accion} boton="Registrar administración" alGuardar={limpiar} className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
      <p className="text-sm font-semibold text-sky-900">Administración a pie de cama</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={claseEtiqueta}>
          1. Escanea la pulsera
          <input
            name="pulsera"
            value={pulsera}
            onChange={(e) => setPulsera(e.target.value)}
            autoComplete="off"
            placeholder="Código de la pulsera"
            className={claseCampo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                etiquetaRef.current?.focus()
              }
            }}
          />
        </label>
        <label className={claseEtiqueta}>
          2. Escanea la etiqueta de la dosis
          <input
            ref={etiquetaRef}
            name="etiqueta"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            autoComplete="off"
            placeholder="Código de la etiqueta (MED…)"
            className={claseCampo}
          />
        </label>
        <label className={claseEtiqueta}>
          Doble verificación (alto riesgo o controlado)
          <select name="verificador" defaultValue="" className={claseCampo}>
            <option value="">— No aplica —</option>
            {verificadores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.texto}
              </option>
            ))}
          </select>
        </label>
        <label className={claseEtiqueta}>
          Observaciones
          <input name="observaciones" className={claseCampo} />
        </label>
      </div>

      {ayuda && (
        <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-2 text-xs text-amber-900">
          <p className="font-semibold">Modo de prueba — sin lector de código de barras</p>
          <p>En el hospital la pulsera y cada etiqueta se escanean; aquí la pulsera se llena sola y la dosis se elige con un clic.</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {ayuda.pulsera ? (
              <button type="button" onClick={() => setPulsera(ayuda.pulsera!)} className="rounded border border-amber-400 bg-white px-2 py-0.5 hover:bg-amber-100">
                Usar pulsera <span className="font-mono">{ayuda.pulsera}</span>
              </button>
            ) : (
              <span>El paciente no tiene pulsera activa (se imprime en Admisión).</span>
            )}
          </div>
          {ayuda.dosis.length > 0 && (
            <ul className="mt-1 space-y-1">
              {ayuda.dosis.map((d) => (
                <li key={d.codigo}>
                  <button type="button" onClick={() => {
                      setEtiqueta(d.codigo)
                      etiquetaRef.current?.focus({ preventScroll: true })
                    }} className="rounded border border-amber-400 bg-white px-2 py-0.5 hover:bg-amber-100">
                    Usar etiqueta <span className="font-mono">{d.codigo}</span> · {d.texto}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </FormAccion>
  )
}
