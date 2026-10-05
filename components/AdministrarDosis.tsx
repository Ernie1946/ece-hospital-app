'use client'

import { useRef } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'

// Administración a pie de cama: se escanea la pulsera y luego la etiqueta.
// El lector de código de barras "teclea" el código y un Enter: con el Enter
// de la pulsera pasa a la etiqueta y con el de la etiqueta se registra.
export function AdministrarDosis({
  accion,
  verificadores,
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  verificadores: { id: string; texto: string }[]
}) {
  const etiqueta = useRef<HTMLInputElement>(null)
  return (
    <FormAccion accion={accion} boton="Registrar administración" className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
      <p className="text-sm font-semibold text-sky-900">Administración a pie de cama</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={claseEtiqueta}>
          1. Escanea la pulsera
          <input
            name="pulsera"
            autoComplete="off"
            placeholder="Código de la pulsera"
            className={claseCampo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                etiqueta.current?.focus()
              }
            }}
          />
        </label>
        <label className={claseEtiqueta}>
          2. Escanea la etiqueta de la dosis
          <input ref={etiqueta} name="etiqueta" autoComplete="off" placeholder="Código de la etiqueta (MED…)" className={claseCampo} />
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
    </FormAccion>
  )
}
