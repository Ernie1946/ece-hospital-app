'use client'

import { useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { ADITIVOS, CONCEPTOS_EGRESO, CONCEPTOS_INGRESO, OTRO, PRODUCTOS, UNIDADES_ADITIVO } from '@/lib/clinica'

type Fila = { clave: number; nombre: string; unidad: string }

const SOLUCION_IV = 'Solución intravenosa'

// Registro de ingresos y egresos. En una solución intravenosa se captura el
// tipo de solución, los aditivos (uno o varios) y la velocidad de infusión.
export function FormLiquidos({ accion }: { accion: (previo: Resultado, datos: FormData) => Promise<Resultado> }) {
  const [sentido, setSentido] = useState<'ingreso' | 'egreso'>('ingreso')
  const [concepto, setConcepto] = useState(SOLUCION_IV)
  const [producto, setProducto] = useState('')
  const [aditivos, setAditivos] = useState<Fila[]>([])
  const [siguiente, setSiguiente] = useState(1)

  const conceptos = sentido === 'ingreso' ? CONCEPTOS_INGRESO : CONCEPTOS_EGRESO
  const productos = sentido === 'ingreso' ? PRODUCTOS[concepto] : undefined
  const esSolucion = sentido === 'ingreso' && concepto === SOLUCION_IV

  function limpiar() {
    setSentido('ingreso')
    setConcepto(SOLUCION_IV)
    setProducto('')
    setAditivos([])
  }

  function agregarAditivo() {
    setAditivos((filas) => [...filas, { clave: siguiente, nombre: '', unidad: 'mEq' }])
    setSiguiente((n) => n + 1)
  }

  function cambiarAditivo(clave: number, nombre: string) {
    const conocido = ADITIVOS.find((a) => a.nombre === nombre)
    setAditivos((filas) =>
      filas.map((f) => (f.clave === clave ? { ...f, nombre, unidad: conocido?.unidad ?? f.unidad } : f))
    )
  }

  return (
    <FormAccion accion={accion} boton="Registrar" variante="secundario" alGuardar={limpiar} className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className={claseEtiqueta}>
          Tipo
          <select
            name="sentido"
            value={sentido}
            onChange={(e) => {
              const nuevo = e.target.value as 'ingreso' | 'egreso'
              setSentido(nuevo)
              setConcepto(nuevo === 'ingreso' ? SOLUCION_IV : CONCEPTOS_EGRESO[0])
              setProducto('')
              setAditivos([])
            }}
            className={claseCampo}
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </label>
        <label className={claseEtiqueta}>
          Concepto
          <select
            name="concepto"
            value={concepto}
            onChange={(e) => {
              setConcepto(e.target.value)
              setProducto('')
              if (e.target.value !== SOLUCION_IV) setAditivos([])
            }}
            className={claseCampo}
          >
            {[...conceptos, OTRO].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {concepto === OTRO && (
          <label className={claseEtiqueta}>
            ¿Cuál?
            <input name="concepto_otro" required className={claseCampo} />
          </label>
        )}
        <label className={claseEtiqueta}>
          mL
          <input name="volumen_ml" type="number" required min={1} className={`${claseCampo} w-24`} />
        </label>
      </div>

      {productos && (
        <div className="flex flex-wrap items-end gap-2">
          <label className={claseEtiqueta}>
            {esSolucion ? 'Solución' : 'Producto'}
            <select
              name="producto"
              value={producto}
              required={esSolucion}
              onChange={(e) => setProducto(e.target.value)}
              className={claseCampo}
            >
              <option value="">{esSolucion ? 'Elige…' : 'Sin especificar'}</option>
              {[...productos, OTRO].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          {producto === OTRO && (
            <label className={claseEtiqueta}>
              ¿Cuál?
              <input name="producto_otro" required className={claseCampo} />
            </label>
          )}
          {esSolucion && (
            <label className={claseEtiqueta}>
              Velocidad (mL/h)
              <input name="velocidad_ml_h" type="number" min={0.1} max={2000} step="0.1" className={`${claseCampo} w-28`} />
            </label>
          )}
        </div>
      )}

      {esSolucion && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Aditivos</legend>
          {aditivos.length === 0 && <p className="text-xs text-slate-500">Sin aditivos.</p>}
          {aditivos.map((f, i) => (
            <div key={f.clave} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
              <label className={claseEtiqueta}>
                Aditivo {i + 1}
                <select
                  name="aditivo_nombre"
                  required
                  value={ADITIVOS.some((a) => a.nombre === f.nombre) || f.nombre === '' ? f.nombre : OTRO}
                  onChange={(e) => cambiarAditivo(f.clave, e.target.value)}
                  className={claseCampo}
                >
                  <option value="">Elige…</option>
                  {ADITIVOS.map((a) => (
                    <option key={a.nombre} value={a.nombre}>
                      {a.nombre}
                    </option>
                  ))}
                  <option value={OTRO}>{OTRO}</option>
                </select>
              </label>
              {f.nombre === OTRO && (
                <label className={claseEtiqueta}>
                  ¿Cuál?
                  <input name={`aditivo_otro_${i}`} required className={claseCampo} />
                </label>
              )}
              <label className={claseEtiqueta}>
                Cantidad
                <input name="aditivo_cantidad" type="number" required min={0.01} step="0.01" className={`${claseCampo} w-24`} />
              </label>
              <label className={claseEtiqueta}>
                Unidad
                <select
                  name="aditivo_unidad"
                  value={f.unidad}
                  onChange={(e) =>
                    setAditivos((filas) => filas.map((x) => (x.clave === f.clave ? { ...x, unidad: e.target.value } : x)))
                  }
                  className={claseCampo}
                >
                  {UNIDADES_ADITIVO.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setAditivos((filas) => filas.filter((x) => x.clave !== f.clave))}
                className="text-sm text-red-700 hover:underline pb-2"
              >
                Quitar
              </button>
            </div>
          ))}
          {aditivos.length < 10 && (
            <button type="button" onClick={agregarAditivo} className="text-sm font-medium text-sky-700 hover:underline">
              + Agregar aditivo
            </button>
          )}
        </fieldset>
      )}
    </FormAccion>
  )
}
