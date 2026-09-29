#!/bin/bash
# =====================================================================
# ECE Hospital — Parche: control de líquidos detallado
#   · Solución IV: tipo de solución, aditivos (uno o varios, con cantidad
#     y unidad) y velocidad de infusión en mL/h
#   · Vía oral, enteral y hemoderivados: tipo de producto
#   · La hoja muestra p. ej. "Hartmann + KCl 20 mEq · 125 mL/h"
# Requiere haber corrido 15_liquidos_detalle.sql en Supabase.
# Uso (dentro de ece-hospital-app):  bash parche-liquidos.sh
# =====================================================================
set -e

if ! grep -q '"name": "ece-hospital-app"' package.json 2>/dev/null; then
  echo "✗ Corre este script dentro de la carpeta ece-hospital-app"; exit 1
fi
if [ ! -f app/enfermeria/acciones.ts ]; then
  echo "✗ Primero debe estar aplicado el parche de Enfermería"; exit 1
fi
PENDIENTES="$(git status --porcelain | grep -v 'parche-.*\.sh' || true)"
if [ -n "$PENDIENTES" ]; then
  echo "⚠ Hay cambios sin guardar en git (el parche sigue; si algo sale mal, regresa con: git checkout -- . ):"
  echo "$PENDIENTES"
fi

echo "→ Escribiendo archivos…"
cat > 'lib/clinica.ts' <<'__FIN_DEL_ARCHIVO__'
// ---------------------------------------------------------------------
// Referencias clínicas de enfermería (adultos).
// Ajustar aquí a los protocolos del hospital; pediatría y neonatos
// necesitarán rangos propios.
// ---------------------------------------------------------------------

export type Signos = {
  ta_sistolica: number | null
  ta_diastolica: number | null
  frecuencia_cardiaca: number | null
  frecuencia_respiratoria: number | null
  temperatura: number | null
  spo2: number | null
  dolor_eva: number | null
  glucosa_capilar: number | null
}

// Rango fuera del cual el valor se marca en rojo
export const RANGO_ALERTA: Record<keyof Signos, { min?: number; max?: number; unidad: string; nombre: string }> = {
  ta_sistolica: { min: 90, max: 160, unidad: 'mmHg', nombre: 'TA sistólica' },
  ta_diastolica: { min: 50, max: 100, unidad: 'mmHg', nombre: 'TA diastólica' },
  frecuencia_cardiaca: { min: 50, max: 120, unidad: 'lpm', nombre: 'FC' },
  frecuencia_respiratoria: { min: 10, max: 24, unidad: 'rpm', nombre: 'FR' },
  temperatura: { min: 35.5, max: 38.0, unidad: '°C', nombre: 'Temperatura' },
  spo2: { min: 92, unidad: '%', nombre: 'SpO₂' },
  dolor_eva: { max: 6, unidad: '/10', nombre: 'Dolor (EVA)' },
  glucosa_capilar: { min: 70, max: 250, unidad: 'mg/dL', nombre: 'Glucosa capilar' },
}

export function fueraDeRango(campo: keyof Signos, valor: number | null | undefined) {
  if (valor === null || valor === undefined) return false
  const r = RANGO_ALERTA[campo]
  return (r.min !== undefined && valor < r.min) || (r.max !== undefined && valor > r.max)
}

// Signos fuera de rango de un registro, en texto ("T 38.6 °C, SpO₂ 89 %")
export function alertasSignos(s: Partial<Signos>) {
  return (Object.keys(RANGO_ALERTA) as (keyof Signos)[])
    .filter((c) => fueraDeRango(c, s[c]))
    .map((c) => `${RANGO_ALERTA[c].nombre} ${s[c]} ${RANGO_ALERTA[c].unidad}`)
}

// Horas sin signos vitales a partir de las cuales el tablero avisa
export const HORAS_SIN_SIGNOS = 4

// ---------------------------------------------------------------------
// Escalas
// ---------------------------------------------------------------------
export type TipoEscala = 'caidas_morse' | 'braden' | 'dolor_eva' | 'glasgow'

export const ESCALAS: Record<TipoEscala, { nombre: string; min: number; max: number; paso: number }> = {
  caidas_morse: { nombre: 'Riesgo de caídas (Morse)', min: 0, max: 125, paso: 5 },
  braden: { nombre: 'Riesgo de úlceras por presión (Braden)', min: 6, max: 23, paso: 1 },
  dolor_eva: { nombre: 'Dolor (EVA)', min: 0, max: 10, paso: 1 },
  glasgow: { nombre: 'Coma de Glasgow', min: 3, max: 15, paso: 1 },
}

export type Nivel = 'bajo' | 'moderado' | 'alto'

export function interpretarEscala(tipo: string, puntaje: number): { texto: string; nivel: Nivel } {
  switch (tipo) {
    case 'caidas_morse':
      if (puntaje >= 45) return { texto: 'Riesgo alto de caída', nivel: 'alto' }
      if (puntaje >= 25) return { texto: 'Riesgo moderado de caída', nivel: 'moderado' }
      return { texto: 'Riesgo bajo de caída', nivel: 'bajo' }
    case 'braden':
      if (puntaje <= 12) return { texto: 'Riesgo alto de úlcera', nivel: 'alto' }
      if (puntaje <= 14) return { texto: 'Riesgo moderado de úlcera', nivel: 'moderado' }
      if (puntaje <= 18) return { texto: 'Riesgo bajo de úlcera', nivel: 'bajo' }
      return { texto: 'Sin riesgo de úlcera', nivel: 'bajo' }
    case 'dolor_eva':
      if (puntaje >= 7) return { texto: 'Dolor severo', nivel: 'alto' }
      if (puntaje >= 4) return { texto: 'Dolor moderado', nivel: 'moderado' }
      if (puntaje >= 1) return { texto: 'Dolor leve', nivel: 'bajo' }
      return { texto: 'Sin dolor', nivel: 'bajo' }
    case 'glasgow':
      if (puntaje <= 8) return { texto: 'Deterioro grave', nivel: 'alto' }
      if (puntaje <= 12) return { texto: 'Deterioro moderado', nivel: 'moderado' }
      return { texto: 'Deterioro leve o normal', nivel: 'bajo' }
    default:
      return { texto: '', nivel: 'bajo' }
  }
}

export const COLOR_NIVEL: Record<Nivel, string> = {
  bajo: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  moderado: 'bg-amber-50 text-amber-900 border-amber-300',
  alto: 'bg-red-50 text-red-800 border-red-300',
}

// ---------------------------------------------------------------------
// Turnos de enfermería (hora de Chihuahua)
// ---------------------------------------------------------------------
export const TURNOS = [
  { clave: 'matutino', nombre: 'Matutino (7:00–15:00)' },
  { clave: 'vespertino', nombre: 'Vespertino (15:00–21:00)' },
  { clave: 'nocturno', nombre: 'Nocturno (21:00–7:00)' },
] as const

export function turnoActual(): string {
  const hora = Number(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chihuahua', hour: 'numeric', hour12: false })
  )
  if (hora >= 7 && hora < 15) return 'matutino'
  if (hora >= 15 && hora < 21) return 'vespertino'
  return 'nocturno'
}

export const CONCEPTOS_INGRESO = ['Vía oral', 'Solución intravenosa', 'Medicamentos IV', 'Sonda / nutrición enteral', 'Hemoderivados']
export const CONCEPTOS_EGRESO = ['Diuresis', 'Evacuaciones', 'Vómito', 'Drenaje', 'Sonda nasogástrica', 'Sangrado']
export const OTRO = 'Otro'

// Producto por concepto de ingreso (la lista termina con "Otro", que abre un campo libre)
export const PRODUCTOS: Record<string, string[]> = {
  'Solución intravenosa': [
    'NaCl 0.9 %',
    'NaCl 0.45 %',
    'Hartmann',
    'Glucosa 5 %',
    'Glucosa 10 %',
    'Glucosa 50 %',
    'Mixta (glucosa 5 % + NaCl 0.9 %)',
  ],
  'Vía oral': ['Agua', 'Dieta líquida', 'Suero oral', 'Leche / fórmula'],
  'Sonda / nutrición enteral': ['Fórmula enteral', 'Agua libre'],
  Hemoderivados: ['Paquete globular', 'Plasma fresco congelado', 'Concentrado plaquetario', 'Crioprecipitado', 'Albúmina'],
}

// Aditivos frecuentes de soluciones IV con su unidad habitual
export const ADITIVOS: { nombre: string; unidad: string }[] = [
  { nombre: 'Cloruro de potasio (KCl)', unidad: 'mEq' },
  { nombre: 'Sulfato de magnesio', unidad: 'g' },
  { nombre: 'Gluconato de calcio', unidad: 'g' },
  { nombre: 'Bicarbonato de sodio', unidad: 'mEq' },
  { nombre: 'Cloruro de sodio 17.7 %', unidad: 'mEq' },
  { nombre: 'Fosfato de potasio', unidad: 'mmol' },
  { nombre: 'Insulina rápida', unidad: 'UI' },
  { nombre: 'Multivitamínico', unidad: 'ámpula' },
]
export const UNIDADES_ADITIVO = ['mEq', 'mmol', 'g', 'mg', 'UI', 'mL', 'ámpula']

export type Aditivo = { nombre: string; cantidad: number; unidad: string }

// "Solución intravenosa: Hartmann + KCl 20 mEq · 125 mL/h"
export function describirLiquido(l: {
  concepto: string
  producto?: string | null
  aditivos?: Aditivo[] | null
  velocidad_ml_h?: number | null
}): string {
  let texto = l.concepto
  if (l.producto) texto += `: ${l.producto}`
  for (const a of l.aditivos ?? []) texto += ` + ${a.nombre} ${Number(a.cantidad).toLocaleString('es-MX')} ${a.unidad}`
  if (l.velocidad_ml_h) texto += ` · ${Number(l.velocidad_ml_h).toLocaleString('es-MX')} mL/h`
  return texto
}
__FIN_DEL_ARCHIVO__
echo "   ✓ lib/clinica.ts"
cat > 'components/FormAccion.tsx' <<'__FIN_DEL_ARCHIVO__'
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
  alGuardar,
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  boton: string
  children?: React.ReactNode
  className?: string
  variante?: 'primario' | 'secundario'
  alGuardar?: () => void
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null)
  const formulario = useRef<HTMLFormElement>(null)
  const avisar = useRef(alGuardar)

  useEffect(() => {
    avisar.current = alGuardar
  }, [alGuardar])

  useEffect(() => {
    if (estado?.ok) {
      formulario.current?.reset()
      avisar.current?.()
    }
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
__FIN_DEL_ARCHIVO__
echo "   ✓ components/FormAccion.tsx"
cat > 'components/FormLiquidos.tsx' <<'__FIN_DEL_ARCHIVO__'
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
__FIN_DEL_ARCHIVO__
echo "   ✓ components/FormLiquidos.tsx"
cat > 'app/enfermeria/acciones.ts' <<'__FIN_DEL_ARCHIVO__'
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'
import { OTRO, describirLiquido, type Aditivo } from '@/lib/clinica'

// Todas las acciones corren con la sesión de la enfermera: la base valida su
// rol (seguridad.exigir_rol) y que el paciente sea de su servicio (seguridad por fila).

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return { supabase, usuarioId: data.user.id }
}

function texto(datos: FormData, campo: string) {
  const v = datos.get(campo)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function numero(datos: FormData, campo: string) {
  const v = texto(datos, campo)
  if (v === null) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function refrescar(encuentroId?: string) {
  revalidatePath('/enfermeria')
  revalidatePath('/')
  if (encuentroId) revalidatePath(`/enfermeria/encuentro/${encuentroId}`)
}

// ---------------------------------------------------------------------
// Camas
// ---------------------------------------------------------------------
export async function registrarLlegada(encuentroId: string, cama: string): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('camas').rpc('registrar_llegada', { p_encuentro: encuentroId })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  return { ok: `Llegada registrada en ${cama}.` }
}

export async function cambiarEstadoCama(
  cama: string,
  estado: 'limpieza' | 'disponible'
): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('camas').rpc('cambiar_estado', { p_cama_clave: cama, p_estado: estado })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: estado === 'limpieza' ? `${cama} en limpieza.` : `${cama} disponible.` }
}

// ---------------------------------------------------------------------
// Hoja de enfermería
// ---------------------------------------------------------------------
export async function registrarSignos(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase, usuarioId } = await sesion()

  const signos = {
    ta_sistolica: numero(datos, 'ta_sistolica'),
    ta_diastolica: numero(datos, 'ta_diastolica'),
    frecuencia_cardiaca: numero(datos, 'frecuencia_cardiaca'),
    frecuencia_respiratoria: numero(datos, 'frecuencia_respiratoria'),
    temperatura: numero(datos, 'temperatura'),
    spo2: numero(datos, 'spo2'),
    dolor_eva: numero(datos, 'dolor_eva'),
    glucosa_capilar: numero(datos, 'glucosa_capilar'),
    peso_kg: numero(datos, 'peso_kg'),
    talla_cm: numero(datos, 'talla_cm'),
  }
  if (Object.values(signos).every((v) => v === null)) return { error: 'Captura al menos un signo vital.' }
  if ((signos.ta_sistolica === null) !== (signos.ta_diastolica === null)) {
    return { error: 'Captura la presión arterial completa (sistólica y diastólica).' }
  }

  const { error } = await supabase
    .schema('clinico')
    .from('signos_vitales')
    .insert({ encuentro_id: encuentroId, registrado_por: usuarioId, ...signos })
  if (error) return { error: traducirError(error.message) }

  refrescar(encuentroId)
  return { ok: 'Signos vitales registrados.' }
}

export async function registrarEscala(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase, usuarioId } = await sesion()
  const tipo = texto(datos, 'tipo')
  const puntaje = numero(datos, 'puntaje')
  if (!tipo || puntaje === null) return { error: 'Elige la escala y captura el puntaje.' }

  const { error } = await supabase
    .schema('clinico')
    .from('escala')
    .insert({ encuentro_id: encuentroId, tipo, puntaje, registrado_por: usuarioId })
  if (error) return { error: traducirError(error.message) }

  refrescar(encuentroId)
  return { ok: 'Escala registrada.' }
}

export async function registrarLiquidos(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase, usuarioId } = await sesion()
  const sentido = texto(datos, 'sentido')
  const volumen = numero(datos, 'volumen_ml')
  let concepto = texto(datos, 'concepto')
  if (concepto === OTRO) concepto = texto(datos, 'concepto_otro')
  let producto = texto(datos, 'producto')
  if (producto === OTRO) producto = texto(datos, 'producto_otro')
  if (!sentido || !concepto || !volumen || volumen <= 0) return { error: 'Indica ingreso o egreso, concepto y volumen en mL.' }

  // Aditivos: listas paralelas de nombre, cantidad y unidad
  const nombres = datos.getAll('aditivo_nombre').map(String)
  const cantidades = datos.getAll('aditivo_cantidad').map((v) => Number(String(v).replace(',', '.')))
  const unidades = datos.getAll('aditivo_unidad').map(String)
  const aditivos: Aditivo[] = []
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i] === OTRO ? texto(datos, `aditivo_otro_${i}`) : nombres[i].trim()
    if (!nombre || !Number.isFinite(cantidades[i]) || cantidades[i] <= 0 || !unidades[i]) {
      return { error: `Completa el aditivo ${i + 1}: nombre, cantidad mayor a cero y unidad.` }
    }
    aditivos.push({ nombre, cantidad: cantidades[i], unidad: unidades[i] })
  }

  const { error } = await supabase
    .schema('clinico')
    .from('liquidos')
    .insert({
      encuentro_id: encuentroId,
      sentido,
      concepto,
      producto,
      aditivos,
      velocidad_ml_h: sentido === 'ingreso' ? numero(datos, 'velocidad_ml_h') : null,
      volumen_ml: volumen,
      registrado_por: usuarioId,
    })
  if (error) return { error: traducirError(error.message) }

  refrescar(encuentroId)
  const que = describirLiquido({ concepto, producto, aditivos })
  return { ok: `${sentido === 'ingreso' ? 'Ingreso' : 'Egreso'} de ${volumen} mL registrado (${que}).` }
}

// Nota de enfermería del turno: se guarda y se firma en un solo paso.
// La firma (SHA-256 + cédula + hora) la genera la base; si no se puede
// firmar, el borrador se elimina para no dejar notas a medias.
export async function firmarNotaEnfermeria(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase, usuarioId } = await sesion()
  const contenido = {
    turno: texto(datos, 'turno'),
    valoracion: texto(datos, 'valoracion'),
    plan_cuidados: texto(datos, 'plan_cuidados'),
    observaciones: texto(datos, 'observaciones'),
  }
  if (!contenido.turno || !contenido.valoracion) return { error: 'El turno y la valoración son obligatorios.' }

  const { data: nota, error } = await supabase
    .schema('clinico')
    .from('documento_clinico')
    .insert({ encuentro_id: encuentroId, tipo: 'registro_enfermeria', autor_id: usuarioId, contenido })
    .select('id')
    .single()
  if (error) return { error: traducirError(error.message) }

  const { error: errorFirma } = await supabase.schema('clinico').rpc('firmar_documento', { p_documento: nota.id })
  if (errorFirma) {
    await supabase.schema('clinico').from('documento_clinico').delete().eq('id', nota.id)
    return { error: traducirError(errorFirma.message) }
  }

  refrescar(encuentroId)
  return { ok: 'Nota de enfermería firmada.' }
}

// "Romper el vidrio": ver un paciente de otro servicio con motivo registrado
export async function solicitarAccesoEmergencia(
  pacienteId: string,
  encuentroId: string,
  _previo: Resultado,
  datos: FormData
): Promise<Resultado> {
  const { supabase } = await sesion()
  const motivo = texto(datos, 'motivo')
  if (!motivo || motivo.length < 10) return { error: 'Describe el motivo (al menos 10 caracteres).' }

  const { error } = await supabase
    .schema('seguridad')
    .rpc('solicitar_acceso_emergencia', { p_paciente: pacienteId, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }

  refrescar(encuentroId)
  return { ok: 'Acceso de emergencia registrado por 8 horas.' }
}
__FIN_DEL_ARCHIVO__
echo "   ✓ app/enfermeria/acciones.ts"
cat > 'app/enfermeria/encuentro/[id]/page.tsx' <<'__FIN_DEL_ARCHIVO__'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { FormLiquidos } from '@/components/FormLiquidos'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { ahora, edad, fechaHora, nombreCompleto } from '@/lib/formato'
import {
  COLOR_NIVEL,
  ESCALAS,
  RANGO_ALERTA,
  TURNOS,
  fueraDeRango,
  describirLiquido,
  interpretarEscala,
  turnoActual,
  type Aditivo,
  type Signos,
  type TipoEscala,
} from '@/lib/clinica'
import {
  firmarNotaEnfermeria,
  registrarEscala,
  registrarLiquidos,
  registrarSignos,
  solicitarAccesoEmergencia,
} from '../../acciones'

// ---------------------------------------------------------------------
// Hoja de enfermería: signos vitales, escalas, control de líquidos y
// nota del turno con firma electrónica.
// ---------------------------------------------------------------------

type SignosFila = Signos & { id: number; tomado_en: string; peso_kg: number | null; talla_cm: number | null; registrado_por: string }
type Escala = { id: number; tipo: string; puntaje: number; registrado_en: string; registrado_por: string }
type Liquido = {
  id: number
  sentido: 'ingreso' | 'egreso'
  concepto: string
  producto: string | null
  aditivos: Aditivo[]
  velocidad_ml_h: number | null
  volumen_ml: number
  registrado_en: string
}
type Nota = {
  id: string
  contenido: { turno?: string; valoracion?: string; plan_cuidados?: string; observaciones?: string }
  firmado_en: string
  firma: { nombre_firmante: string; cedula: string; hash_sha256: string }[]
}

const COLUMNAS_SIGNOS: { campo: keyof Signos; titulo: string }[] = [
  { campo: 'frecuencia_cardiaca', titulo: 'FC' },
  { campo: 'frecuencia_respiratoria', titulo: 'FR' },
  { campo: 'temperatura', titulo: 'T °C' },
  { campo: 'spo2', titulo: 'SpO₂' },
  { campo: 'dolor_eva', titulo: 'EVA' },
  { campo: 'glucosa_capilar', titulo: 'Glu' },
]

export default async function HojaEnfermeriaPage({ params }: PageProps<'/enfermeria/encuentro/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: encuentro } = await supabase
    .schema('clinico')
    .from('encuentro')
    .select('id, folio, paciente_id, tipo, estado, servicio_id, medico_tratante_id, diagnostico_presuntivo, aislamiento, inicio')
    .eq('id', id)
    .maybeSingle()
  if (!encuentro) notFound()

  const hace24h = new Date(ahora() - 24 * 3600 * 1000).toISOString()

  const [paciente, alergias, cama, medico, acceso, signos, escalas, liquidos, notas] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento, sexo, tipo_sangre').eq('id', encuentro.paciente_id).single(),
    supabase.schema('clinico').from('paciente_alergia').select('sustancia, severidad').eq('paciente_id', encuentro.paciente_id).eq('activa', true),
    supabase.schema('camas').from('v_censo').select('cama, servicio_nombre').eq('encuentro_id', id).maybeSingle(),
    supabase.schema('seguridad').from('usuario').select('nombre, primer_apellido').eq('id', encuentro.medico_tratante_id).maybeSingle(),
    supabase.schema('clinico').rpc('puede_ver_encuentro', { p_encuentro: id }),
    supabase.schema('clinico').from('signos_vitales').select('*').eq('encuentro_id', id).gte('tomado_en', hace24h).order('tomado_en', { ascending: false }),
    supabase.schema('clinico').from('escala').select('id, tipo, puntaje, registrado_en, registrado_por').eq('encuentro_id', id).order('registrado_en', { ascending: false }).limit(40),
    supabase.schema('clinico').from('liquidos').select('id, sentido, concepto, producto, aditivos, velocidad_ml_h, volumen_ml, registrado_en').eq('encuentro_id', id).gte('registrado_en', hace24h).order('registrado_en', { ascending: false }),
    supabase
      .schema('clinico')
      .from('documento_clinico')
      .select('id, contenido, firmado_en, firma(nombre_firmante, cedula, hash_sha256)')
      .eq('encuentro_id', id)
      .eq('tipo', 'registro_enfermeria')
      .eq('estado', 'firmado')
      .order('firmado_en', { ascending: false })
      .limit(20),
  ])

  const p = paciente.data
  if (!p) notFound()

  const puedeVer = acceso.data === true
  const esEnfermeria = perfil.rol === 'enfermeria'
  const esClinico = ['enfermeria', 'medico_tratante', 'medico_residente', 'anestesiologo'].includes(perfil.rol)
  const vigente = ['activo', 'alta_medica'].includes(encuentro.estado as string)
  const puedeRegistrar = esEnfermeria && puedeVer && vigente

  const listaSignos = (signos.data ?? []) as SignosFila[]
  const listaEscalas = (escalas.data ?? []) as Escala[]
  const listaLiquidos = (liquidos.data ?? []) as Liquido[]
  const listaNotas = (notas.data ?? []) as Nota[]

  // Nombres de quien registró
  const ids = Array.from(new Set([...listaSignos.map((s) => s.registrado_por), ...listaEscalas.map((e) => e.registrado_por)]))
  const { data: personal } = ids.length
    ? await supabase.schema('seguridad').from('usuario').select('id, nombre, primer_apellido').in('id', ids)
    : { data: [] }
  const quien = new Map((personal ?? []).map((u) => [u.id as string, `${u.nombre} ${u.primer_apellido}`]))

  // Última medición de cada escala
  const ultimaEscala = new Map<string, Escala>()
  for (const e of listaEscalas) if (!ultimaEscala.has(e.tipo)) ultimaEscala.set(e.tipo, e)

  // Balance de líquidos 24 h
  const ingresos = listaLiquidos.filter((l) => l.sentido === 'ingreso').reduce((t, l) => t + Number(l.volumen_ml), 0)
  const egresos = listaLiquidos.filter((l) => l.sentido === 'egreso').reduce((t, l) => t + Number(l.volumen_ml), 0)
  const balance = ingresos - egresos

  return (
    <>
      <Encabezado perfil={perfil} activo="enfermeria" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/enfermeria" className="text-sm text-sky-700 hover:underline">
            ← Tablero de enfermería
          </Link>

          {/* Identificación */}
          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{nombreCompleto(p)}</h1>
              <span className="text-sm text-slate-600">
                <strong>{cama.data?.cama ?? 'Sin cama'}</strong> · {cama.data?.servicio_nombre} · Folio {encuentro.folio as string}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Exp. {p.expediente} · {p.sexo} · {p.fecha_nacimiento ? `${edad(p.fecha_nacimiento)} años` : 'edad desconocida'}
              {p.tipo_sangre ? ` · ${p.tipo_sangre}` : ''} · Ingreso {fechaHora(encuentro.inicio as string | null)}
              {medico.data && ` · Dr(a). ${medico.data.nombre} ${medico.data.primer_apellido}`}
            </p>
            {encuentro.diagnostico_presuntivo && (
              <p className="text-sm text-slate-700">Dx: {encuentro.diagnostico_presuntivo as string}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(alergias.data ?? []).map((a) => (
                <span key={a.sustancia as string} className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">
                  Alergia: {a.sustancia as string}
                  {a.severidad ? ` (${a.severidad})` : ''}
                </span>
              ))}
              {(alergias.data ?? []).length === 0 && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">Sin alergias registradas</span>}
              {encuentro.aislamiento !== 'ninguno' && (
                <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">Aislamiento: {encuentro.aislamiento as string}</span>
              )}
            </div>
          </section>

          {/* Sin acceso: paciente de otro servicio */}
          {!puedeVer && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                Este paciente no es de tu servicio. Solo ves su identificación; los registros clínicos están protegidos.
              </p>
              {esClinico && (
                <FormAccion
                  accion={solicitarAccesoEmergencia.bind(null, encuentro.paciente_id as string, id)}
                  boton="Solicitar acceso de emergencia"
                  variante="secundario"
                  className="flex flex-wrap items-end gap-2"
                >
                  <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                    Motivo (queda registrado en la bitácora)
                    <input name="motivo" required minLength={10} className={claseCampo} placeholder="Deterioro súbito, paciente en mi pasillo…" />
                  </label>
                </FormAccion>
              )}
            </section>
          )}

          {puedeVer && !vigente && (
            <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
              Este ingreso ya no está activo; la hoja queda en modo consulta.
            </p>
          )}

          {puedeVer && (
            <>
              {/* Signos vitales */}
              <section className={claseTarjeta}>
                <h2 className="text-sm font-semibold text-slate-800">Signos vitales (últimas 24 h)</h2>
                {puedeRegistrar && (
                  <FormAccion accion={registrarSignos.bind(null, id)} boton="Registrar signos" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <Campo nombre="ta_sistolica" titulo="TA sistólica" unidad="mmHg" />
                      <Campo nombre="ta_diastolica" titulo="TA diastólica" unidad="mmHg" />
                      <Campo nombre="frecuencia_cardiaca" titulo="FC" unidad="lpm" />
                      <Campo nombre="frecuencia_respiratoria" titulo="FR" unidad="rpm" />
                      <Campo nombre="temperatura" titulo="Temperatura" unidad="°C" paso="0.1" />
                      <Campo nombre="spo2" titulo="SpO₂" unidad="%" />
                      <Campo nombre="dolor_eva" titulo="Dolor EVA" unidad="0–10" />
                      <Campo nombre="glucosa_capilar" titulo="Glucosa capilar" unidad="mg/dL" />
                      <Campo nombre="peso_kg" titulo="Peso" unidad="kg" paso="0.1" />
                      <Campo nombre="talla_cm" titulo="Talla" unidad="cm" paso="0.1" />
                    </div>
                  </FormAccion>
                )}
                {listaSignos.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin signos vitales en las últimas 24 horas.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-1.5 pr-3 font-medium">Hora</th>
                          <th className="py-1.5 pr-3 font-medium">TA</th>
                          {COLUMNAS_SIGNOS.map((c) => (
                            <th key={c.campo} className="py-1.5 pr-3 font-medium">{c.titulo}</th>
                          ))}
                          <th className="py-1.5 pr-3 font-medium">Registró</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaSignos.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="py-1.5 pr-3 whitespace-nowrap">{fechaHora(s.tomado_en)}</td>
                            <td className={`py-1.5 pr-3 ${fueraDeRango('ta_sistolica', s.ta_sistolica) || fueraDeRango('ta_diastolica', s.ta_diastolica) ? 'text-red-700 font-semibold' : ''}`}>
                              {s.ta_sistolica ?? '—'}/{s.ta_diastolica ?? '—'}
                            </td>
                            {COLUMNAS_SIGNOS.map((c) => (
                              <td key={c.campo} className={`py-1.5 pr-3 ${fueraDeRango(c.campo, s[c.campo]) ? 'text-red-700 font-semibold' : ''}`}>
                                {s[c.campo] ?? '—'}
                              </td>
                            ))}
                            <td className="py-1.5 pr-3 text-slate-500">{quien.get(s.registrado_por) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-xs text-slate-500">
                      En rojo, fuera de rango para adulto (p. ej. T &gt; {RANGO_ALERTA.temperatura.max} °C, SpO₂ &lt; {RANGO_ALERTA.spo2.min} %).
                    </p>
                  </div>
                )}
              </section>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Escalas */}
                <section className={claseTarjeta}>
                  <h2 className="text-sm font-semibold text-slate-800">Escalas</h2>
                  <ul className="mt-2 space-y-1">
                    {(Object.keys(ESCALAS) as TipoEscala[]).map((tipo) => {
                      const e = ultimaEscala.get(tipo)
                      const i = e ? interpretarEscala(tipo, Number(e.puntaje)) : null
                      return (
                        <li key={tipo} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-slate-700">{ESCALAS[tipo].nombre}</span>
                          {e && i ? (
                            <span className={`rounded border px-2 py-0.5 text-xs ${COLOR_NIVEL[i.nivel]}`}>
                              {Number(e.puntaje)} · {i.texto} · {fechaHora(e.registrado_en)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Sin registro</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {puedeRegistrar && (
                    <FormAccion accion={registrarEscala.bind(null, id)} boton="Registrar escala" variante="secundario" className="mt-3 flex flex-wrap items-end gap-2">
                      <label className={claseEtiqueta}>
                        Escala
                        <select name="tipo" required defaultValue="" className={claseCampo}>
                          <option value="" disabled>Elegir…</option>
                          {(Object.keys(ESCALAS) as TipoEscala[]).map((t) => (
                            <option key={t} value={t}>{ESCALAS[t].nombre} ({ESCALAS[t].min}–{ESCALAS[t].max})</option>
                          ))}
                        </select>
                      </label>
                      <label className={claseEtiqueta}>
                        Puntaje
                        <input name="puntaje" type="number" required min={0} max={125} className={`${claseCampo} w-24`} />
                      </label>
                    </FormAccion>
                  )}
                </section>

                {/* Líquidos */}
                <section className={claseTarjeta}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-800">Control de líquidos (24 h)</h2>
                    <span className={`text-sm font-semibold ${balance > 0 ? 'text-sky-800' : balance < 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                      Balance {balance > 0 ? '+' : ''}{balance.toLocaleString('es-MX')} mL
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Ingresos {ingresos.toLocaleString('es-MX')} mL · Egresos {egresos.toLocaleString('es-MX')} mL
                  </p>
                  {listaLiquidos.length > 0 && (
                    <ul className="mt-2 max-h-40 overflow-y-auto text-xs divide-y divide-slate-100">
                      {listaLiquidos.map((l) => (
                        <li key={l.id} className="py-1 flex justify-between gap-2">
                          <span>
                            {l.sentido === 'ingreso' ? '↓ Ingreso' : '↑ Egreso'} · {describirLiquido(l)}
                          </span>
                          <span className="text-slate-600">
                            {Number(l.volumen_ml).toLocaleString('es-MX')} mL · {fechaHora(l.registrado_en)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {puedeRegistrar && (
                    <FormLiquidos accion={registrarLiquidos.bind(null, id)} />
                  )}
                </section>
              </div>

              {/* Notas de enfermería */}
              <section className={claseTarjeta}>
                <h2 className="text-sm font-semibold text-slate-800">Notas de enfermería</h2>
                {puedeRegistrar && (
                  <FormAccion accion={firmarNotaEnfermeria.bind(null, id)} boton="Guardar y firmar nota" className="mt-3 space-y-3">
                    <label className={`${claseEtiqueta} sm:max-w-xs`}>
                      Turno
                      <select name="turno" required defaultValue={turnoActual()} className={claseCampo}>
                        {TURNOS.map((t) => (
                          <option key={t.clave} value={t.clave}>{t.nombre}</option>
                        ))}
                      </select>
                    </label>
                    <label className={claseEtiqueta}>
                      Valoración *
                      <textarea name="valoracion" required rows={3} className={claseCampo} placeholder="Estado general, neurológico, respiratorio, herida, accesos venosos…" />
                    </label>
                    <label className={claseEtiqueta}>
                      Plan de cuidados
                      <textarea name="plan_cuidados" rows={2} className={claseCampo} />
                    </label>
                    <label className={claseEtiqueta}>
                      Observaciones / entrega de turno
                      <textarea name="observaciones" rows={2} className={claseCampo} />
                    </label>
                    <p className="text-xs text-slate-500">
                      Al firmar, la nota queda sellada con tu nombre, cédula y hora, y ya no puede modificarse (NOM-004).
                    </p>
                  </FormAccion>
                )}
                {listaNotas.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Sin notas de enfermería.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {listaNotas.map((n) => {
                      const f = n.firma[0]
                      return (
                        <article key={n.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            Turno {n.contenido.turno} · {fechaHora(n.firmado_en)}
                          </p>
                          <p className="mt-1 whitespace-pre-line text-slate-900">{n.contenido.valoracion}</p>
                          {n.contenido.plan_cuidados && (
                            <p className="mt-1 whitespace-pre-line text-slate-700"><strong>Plan:</strong> {n.contenido.plan_cuidados}</p>
                          )}
                          {n.contenido.observaciones && (
                            <p className="mt-1 whitespace-pre-line text-slate-700"><strong>Observaciones:</strong> {n.contenido.observaciones}</p>
                          )}
                          {f && (
                            <p className="mt-2 text-xs text-emerald-800">
                              ✓ Firmada por {f.nombre_firmante} · Céd. {f.cedula} ·{' '}
                              <span className="font-mono" title={f.hash_sha256}>SHA-256 {f.hash_sha256.slice(0, 12)}…</span>
                            </p>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}

function Campo({ nombre, titulo, unidad, paso = '1' }: { nombre: string; titulo: string; unidad: string; paso?: string }) {
  return (
    <label className={claseEtiqueta}>
      {titulo} <span className="font-normal text-slate-400">({unidad})</span>
      <input name={nombre} type="number" step={paso} inputMode="decimal" className={claseCampo} />
    </label>
  )
}
__FIN_DEL_ARCHIVO__
echo "   ✓ app/enfermeria/encuentro/[id]/page.tsx"

echo "→ Revisando que todo compile…"
npx next typegen > /dev/null
npx tsc --noEmit
echo ""
echo "✓ Parche aplicado. Archivos nuevos o cambiados:"
git status --short
