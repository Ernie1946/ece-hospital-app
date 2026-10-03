'use client'

import { useEffect, useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { CampoDictado } from '@/components/CampoDictado'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import {
  FRECUENCIAS,
  PRIORIDADES,
  TIPO_DIAGNOSTICO,
  TIPO_ORDEN,
  TIPOS_NOTA,
  VIAS,
  resumenOrden,
  type Cie10,
  type DxElegido,
  type Medicamento,
  type OrdenNueva,
} from '@/lib/medica'

type Accion = (previo: Resultado, datos: FormData) => Promise<Resultado>

// Nota médica: campos con dictado, diagnósticos CIE-10 y órdenes.
// Todo se envía junto; la base guarda y firma en un solo paso.
export function FormNotaMedica({
  accion,
  buscarCie10,
  buscarMedicamentos,
  tipoInicial,
  esResidente,
}: {
  accion: Accion
  buscarCie10: (q: string) => Promise<Cie10[]>
  buscarMedicamentos: (q: string) => Promise<Medicamento[]>
  tipoInicial: string
  esResidente: boolean
}) {
  const [tipo, setTipo] = useState(tipoInicial)
  const [diagnosticos, setDiagnosticos] = useState<DxElegido[]>([])
  const [ordenes, setOrdenes] = useState<OrdenNueva[]>([])
  const [version, setVersion] = useState(0) // para vaciar los campos de texto al guardar

  const definicion = TIPOS_NOTA[tipo]

  function limpiar() {
    setTipo((t) => (t === 'nota_ingreso' ? 'nota_evolucion' : t))
    setDiagnosticos([])
    setOrdenes([])
    setVersion((v) => v + 1)
  }

  return (
    <FormAccion
      accion={accion}
      boton={esResidente ? 'Guardar y firmar (pasa a cofirma)' : 'Guardar y firmar nota'}
      alGuardar={limpiar}
      className="space-y-4"
    >
      <label className={`${claseEtiqueta} max-w-xs`}>
        Tipo de nota
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={claseCampo}>
          {Object.entries(TIPOS_NOTA).map(([clave, t]) => (
            <option key={clave} value={clave}>
              {t.nombre}
            </option>
          ))}
        </select>
      </label>

      <div key={`${tipo}-${version}`} className="space-y-3">
        {definicion.campos.map((c) => (
          <CampoDictado
            key={c.clave}
            name={c.clave}
            etiqueta={c.obligatorio ? `${c.titulo} *` : c.titulo}
            required={c.obligatorio}
            rows={c.filas}
            placeholder={c.ayuda}
          />
        ))}
      </div>

      {/* Diagnósticos */}
      <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">Diagnósticos (CIE-10)</legend>
        <BuscadorCie10
          buscar={buscarCie10}
          elegidos={diagnosticos.map((d) => d.cie10)}
          alElegir={(c) =>
            setDiagnosticos((ds) => [
              ...ds,
              {
                cie10: c.codigo,
                descripcion: c.descripcion,
                tipo: ds.some((d) => d.tipo === 'principal') || !c.afeccion_principal ? 'secundario' : 'principal',
              },
            ])
          }
        />
        {diagnosticos.length > 0 && (
          <ul className="space-y-1">
            {diagnosticos.map((d) => (
              <li key={d.cie10} className="flex flex-wrap items-center gap-2 rounded bg-slate-50 px-2 py-1 text-sm">
                <span className="font-mono font-semibold text-slate-900">{d.cie10}</span>
                <span className="flex-1 text-slate-800">{d.descripcion}</span>
                <select
                  aria-label={`Tipo de diagnóstico ${d.cie10}`}
                  value={d.tipo}
                  onChange={(e) =>
                    setDiagnosticos((ds) => ds.map((x) => (x.cie10 === d.cie10 ? { ...x, tipo: e.target.value } : x)))
                  }
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  {['principal', 'secundario', 'ingreso', 'complicacion'].map((t) => (
                    <option key={t} value={t}>
                      {TIPO_DIAGNOSTICO[t]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setDiagnosticos((ds) => ds.filter((x) => x.cie10 !== d.cie10))}
                  className="text-xs text-red-700 hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <input type="hidden" name="diagnosticos" value={JSON.stringify(diagnosticos.map(({ cie10, tipo }) => ({ cie10, tipo })))} />
        <label className={claseEtiqueta}>
          Diagnóstico en texto <span className="font-normal text-slate-400">(opcional: si lo dejas vacío se usan los códigos elegidos)</span>
          <input key={`dx-${version}`} name="diagnostico" className={claseCampo} />
        </label>
      </fieldset>

      {tipo !== 'nota_interconsulta' && (
        <label className={`${claseEtiqueta} max-w-md`}>
          Pronóstico *
          <input key={`pr-${version}`} name="pronostico" list="pronosticos" className={claseCampo} />
          <datalist id="pronosticos">
            <option value="Bueno para la vida y la función" />
            <option value="Reservado a evolución" />
            <option value="Malo para la vida" />
          </datalist>
        </label>
      )}

      {/* Órdenes */}
      <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">Órdenes</legend>
        {ordenes.length === 0 && <p className="text-xs text-slate-500">Sin órdenes nuevas en esta nota.</p>}
        {ordenes.length > 0 && (
          <ol className="space-y-1 text-sm">
            {ordenes.map((o, i) => (
              <li key={i} className="flex items-start justify-between gap-2 rounded bg-slate-50 px-2 py-1">
                <span>
                  {i + 1}. {resumenOrden(o)}
                  {o.prioridad !== 'rutina' && (
                    <span className="ml-1 rounded bg-red-100 px-1 text-xs font-medium text-red-800">{PRIORIDADES[o.prioridad]}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setOrdenes((os) => os.filter((_, j) => j !== i))}
                  className="text-xs text-red-700 hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ol>
        )}
        <input
          type="hidden"
          name="ordenes"
          value={JSON.stringify(
            ordenes.map((o) =>
              o.tipo === 'medicamento'
                ? {
                    tipo: o.tipo,
                    medicamento_id: o.medicamento_id,
                    dosis: o.dosis,
                    via: o.via,
                    frecuencia_horas: o.frecuencia_horas,
                    prn: o.prn,
                    duracion_dias: o.duracion_dias,
                    indicaciones: o.indicaciones,
                    prioridad: o.prioridad,
                  }
                : o
            )
          )}
        />
        <NuevaOrden buscarMedicamentos={buscarMedicamentos} alAgregar={(o) => setOrdenes((os) => [...os, o])} />
      </fieldset>

      <p className="text-xs text-slate-500">
        Al firmar, la nota queda sellada con tu nombre, cédula y hora (NOM-004) y sus órdenes se activan de inmediato.
        {esResidente && ' Como residente, tu nota queda pendiente de cofirma del médico tratante.'}
      </p>
    </FormAccion>
  )
}

// ---------------------------------------------------------------------
// Buscador CIE-10 (por texto, sin acentos, o por código)
// ---------------------------------------------------------------------
function BuscadorCie10({
  buscar,
  elegidos,
  alElegir,
}: {
  buscar: (q: string) => Promise<Cie10[]>
  elegidos: string[]
  alElegir: (c: Cie10) => void
}) {
  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState<Cie10[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const q = consulta.trim()
    if (q.length < 2) return
    let vigente = true
    const t = setTimeout(async () => {
      setBuscando(true)
      const r = await buscar(q)
      if (vigente) {
        setResultados(r)
        setBuscando(false)
      }
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consulta, buscar])

  const visibles = consulta.trim().length < 2 ? [] : resultados.filter((r) => !elegidos.includes(r.codigo))

  return (
    <div>
      <label className={claseEtiqueta}>
        Buscar diagnóstico
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          placeholder="Ej. apendicitis, neumonía, K35…"
          className={claseCampo}
        />
      </label>
      {buscando && <p className="mt-1 text-xs text-slate-500">Buscando…</p>}
      {visibles.length > 0 && (
        <ul role="listbox" aria-label="Resultados CIE-10" className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
          {visibles.map((r) => (
            <li key={r.codigo}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  alElegir(r)
                  setConsulta('')
                  setResultados([])
                }}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-sky-50"
              >
                <span className="w-14 shrink-0 font-mono font-semibold text-slate-900">{r.codigo}</span>
                <span className="flex-1 text-slate-800">{r.descripcion}</span>
                {r.notificacion_inmediata && <span className="rounded bg-red-100 px-1 text-xs text-red-800">Notificación inmediata</span>}
                {!r.afeccion_principal && <span className="rounded bg-slate-100 px-1 text-xs text-slate-600">Solo secundario</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Captura de una orden
// ---------------------------------------------------------------------
function NuevaOrden({
  buscarMedicamentos,
  alAgregar,
}: {
  buscarMedicamentos: (q: string) => Promise<Medicamento[]>
  alAgregar: (o: OrdenNueva) => void
}) {
  const [tipo, setTipo] = useState<OrdenNueva['tipo']>('medicamento')
  const [prioridad, setPrioridad] = useState('rutina')
  const [descripcion, setDescripcion] = useState('')
  const [consulta, setConsulta] = useState('')
  const [opciones, setOpciones] = useState<Medicamento[]>([])
  const [med, setMed] = useState<Medicamento | null>(null)
  const [dosis, setDosis] = useState('')
  const [via, setVia] = useState('IV')
  const [frecuencia, setFrecuencia] = useState('8')
  const [prn, setPrn] = useState(false)
  const [duracion, setDuracion] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const q = consulta.trim()
    if (tipo !== 'medicamento' || med || q.length < 2) return
    let vigente = true
    const t = setTimeout(async () => {
      const r = await buscarMedicamentos(q)
      if (vigente) setOpciones(r)
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consulta, tipo, med, buscarMedicamentos])

  function reiniciar() {
    setDescripcion('')
    setConsulta('')
    setOpciones([])
    setMed(null)
    setDosis('')
    setFrecuencia('8')
    setPrn(false)
    setDuracion('')
    setIndicaciones('')
    setPrioridad('rutina')
    setAviso(null)
  }

  function agregar() {
    if (tipo === 'medicamento') {
      const d = Number(dosis.replace(',', '.'))
      if (!med) return setAviso('Elige el medicamento del catálogo.')
      if (!Number.isFinite(d) || d <= 0) return setAviso('Escribe la dosis.')
      const horas = frecuencia === '' ? null : Number(frecuencia)
      const dias = duracion ? Number(duracion) : null
      if (horas === null && !prn && dias) return setAviso('Una dosis única no lleva duración en días.')
      alAgregar({
        tipo,
        medicamento_id: med.id,
        nombre: `${med.denominacion_generica} ${med.concentracion}`,
        dosis: d,
        unidad: med.unidad_dosis,
        via,
        frecuencia_horas: horas,
        prn,
        duracion_dias: dias,
        indicaciones: indicaciones.trim(),
        prioridad,
      })
    } else {
      if (!descripcion.trim()) return setAviso('Escribe la indicación.')
      alAgregar({ tipo, descripcion: descripcion.trim(), prioridad })
    }
    reiniciar()
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className={claseEtiqueta}>
          Nueva orden
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as OrdenNueva['tipo'])
              reiniciar()
            }}
            className={claseCampo}
          >
            {Object.entries(TIPO_ORDEN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={claseEtiqueta}>
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className={claseCampo}>
            {Object.entries(PRIORIDADES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tipo === 'medicamento' ? (
        <>
          {med ? (
            <p className="text-sm">
              <strong>
                {med.denominacion_generica} {med.concentracion}
              </strong>{' '}
              <span className="text-slate-600">· {med.forma_farmaceutica}</span>
              {med.alto_riesgo && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-900">Alto riesgo</span>}
              {med.grupo_controlado && (
                <span className="ml-1 rounded bg-purple-100 px-1 text-xs text-purple-900">Controlado grupo {med.grupo_controlado}</span>
              )}{' '}
              <button type="button" onClick={() => setMed(null)} className="text-xs text-sky-700 hover:underline">
                Cambiar
              </button>
            </p>
          ) : (
            <div>
              <label className={claseEtiqueta}>
                Medicamento
                <input
                  type="search"
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="Nombre genérico o comercial"
                  className={claseCampo}
                />
              </label>
              {consulta.trim().length >= 2 && opciones.length > 0 && (
                <ul aria-label="Medicamentos" className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white text-sm">
                  {opciones.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMed(m)
                          setVia(m.via_default)
                          setOpciones([])
                          setConsulta('')
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-sky-50"
                      >
                        {m.denominacion_generica} {m.concentracion}{' '}
                        <span className="text-slate-500">· {m.forma_farmaceutica}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className={claseEtiqueta}>
              Dosis {med && <span className="font-normal text-slate-400">({med.unidad_dosis})</span>}
              <input value={dosis} onChange={(e) => setDosis(e.target.value)} inputMode="decimal" className={`${claseCampo} w-24`} />
            </label>
            <label className={claseEtiqueta}>
              Vía
              <select value={via} onChange={(e) => setVia(e.target.value)} className={claseCampo}>
                {VIAS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className={claseEtiqueta}>
              Frecuencia
              <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} className={claseCampo}>
                {FRECUENCIAS.map((f) => (
                  <option key={f.texto} value={f.horas ?? ''}>
                    {f.texto}
                  </option>
                ))}
              </select>
            </label>
            <label className={claseEtiqueta}>
              Días
              <input value={duracion} onChange={(e) => setDuracion(e.target.value)} type="number" min={1} className={`${claseCampo} w-20`} />
            </label>
            <label className="flex items-center gap-1 pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={prn} onChange={(e) => setPrn(e.target.checked)} /> PRN
            </label>
          </div>
          <label className={claseEtiqueta}>
            Indicaciones
            <input value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} placeholder="Diluir en 100 mL, pasar en 30 min…" className={claseCampo} />
          </label>
        </>
      ) : (
        <label className={claseEtiqueta}>
          Indicación
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                agregar()
              }
            }}
            placeholder={
              tipo === 'dieta'
                ? 'Ayuno, dieta blanda, para diabético 1800 kcal…'
                : tipo === 'estudio'
                  ? 'Biometría hemática, radiografía de tórax…'
                  : tipo === 'interconsulta'
                    ? 'Cardiología: valoración preoperatoria…'
                    : 'Curación de herida cada 24 h, posición semifowler…'
            }
            className={claseCampo}
          />
        </label>
      )}
      {aviso && <p className="text-xs text-red-700">{aviso}</p>}
      <button type="button" onClick={agregar} className="text-sm font-medium text-sky-700 hover:underline">
        + Agregar orden a la nota
      </button>
    </div>
  )
}
