'use client'

import { useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { CampoDictado } from '@/components/CampoDictado'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { ALDRETE, colorAldrete, textoAldrete } from '@/lib/anestesia-trans'

type Accion = (previo: Resultado, datos: FormData) => Promise<Resultado>

// Valoración de Aldrete modificada en recuperación, con total en vivo
export function FormAldrete({ accion }: { accion: Accion }) {
  const [puntos, setPuntos] = useState<Record<string, number>>({})
  const completos = ALDRETE.every((a) => puntos[a.clave] !== undefined)
  const total = ALDRETE.reduce((s, a) => s + (puntos[a.clave] ?? 0), 0)

  return (
    <FormAccion accion={accion} boton="Registrar Aldrete" alGuardar={() => setPuntos({})} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {ALDRETE.map((a) => (
          <fieldset key={a.clave}>
            <legend className={claseEtiqueta}>{a.titulo}</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {a.opciones.map((texto, i) => (
                <label
                  key={i}
                  className={`cursor-pointer rounded-lg border px-2 py-1 text-xs ${
                    puntos[a.clave] === i
                      ? i === 2
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : i === 1
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-red-600 bg-red-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={a.clave}
                    value={i}
                    checked={puntos[a.clave] === i}
                    onChange={() => setPuntos({ ...puntos, [a.clave]: i })}
                    className="sr-only"
                  />
                  <strong>{i}</strong> · {texto}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${completos ? colorAldrete(total) : 'bg-slate-100 text-slate-600'}`}>
        Aldrete {total}/10{completos ? ` · ${textoAldrete(total)}` : ' (faltan criterios)'}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block text-xs text-slate-600">
          EVA (0-10)
          <input name="eva" inputMode="numeric" className={claseCampo} />
        </label>
        <label className="block text-xs text-slate-600">
          SpO₂ (%)
          <input name="spo2" inputMode="numeric" aria-label="SpO₂ en recuperación" className={claseCampo} />
        </label>
        <label className="block text-xs text-slate-600">
          FC
          <input name="fc" inputMode="numeric" aria-label="FC en recuperación" className={claseCampo} />
        </label>
        <label className="block text-xs text-slate-600">
          TA
          <input name="ta" placeholder="120/80" aria-label="TA en recuperación" className={claseCampo} />
        </label>
      </div>
      <CampoDictado name="notas" etiqueta="Notas de recuperación" rows={2} placeholder="Náusea, dolor, sangrado, diuresis…" />
    </FormAccion>
  )
}

// Alta de recuperación (anestesiólogo). Con Aldrete < 9 pide justificación.
export function FormAltaRecuperacion({ accion, ultimoAldrete }: { accion: Accion; ultimoAldrete: number | null }) {
  const bajo = ultimoAldrete !== null && ultimoAldrete < 9
  return (
    <FormAccion accion={accion} boton="Firmar alta de recuperación" className="space-y-3">
      <label className={claseEtiqueta}>
        Destino *
        <select name="destino" required defaultValue="Piso" className={claseCampo}>
          {['Piso', 'UCI', 'Domicilio (ambulatorio)', 'Otro hospital'].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <CampoDictado name="notas" etiqueta="Nota de alta" rows={2} placeholder="Estado al alta, indicaciones…" />
      {bajo && (
        <label className={claseEtiqueta}>
          Justificación (Aldrete {ultimoAldrete}, menor a 9) *
          <input name="justificacion" required className={claseCampo} />
        </label>
      )}
    </FormAccion>
  )
}
