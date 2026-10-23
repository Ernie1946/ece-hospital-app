'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase
}

function texto(datos: FormData, campo: string) {
  const v = datos.get(campo)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

// Restricciones marcadas + las escritas a mano (separadas por coma)
function restricciones(datos: FormData) {
  const marcadas = datos.getAll('restriccion').filter((x): x is string => typeof x === 'string')
  const otras = (texto(datos, 'otras') ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return Array.from(new Set([...marcadas, ...otras]))
}

const refrescar = () => revalidatePath('/nutricion')

export async function ajustarDieta(ordenId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const kcal = texto(datos, 'kcal')
  if (kcal && (!/^\d+$/.test(kcal) || Number(kcal) < 300 || Number(kcal) > 5000)) return { error: 'Las kilocalorías van de 300 a 5000.' }
  const { error } = await supabase.schema('nutricion').rpc('ajustar', {
    p_orden: ordenId,
    p_consistencia: texto(datos, 'consistencia') ?? 'normal',
    p_restricciones: restricciones(datos),
    p_observaciones: texto(datos, 'observaciones'),
    p_kcal: kcal ? Number(kcal) : null,
    p_colaciones: datos.get('colaciones') === '1',
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Ajuste guardado.' }
}

export async function clasificarDieta(ordenId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const tipo = Number(texto(datos, 'tipo_dieta'))
  if (!tipo) return { error: 'Elige el tipo de dieta.' }
  const { error } = await supabase.schema('nutricion').rpc('clasificar', {
    p_orden: ordenId,
    p_tipo_dieta: tipo,
    p_consistencia: texto(datos, 'consistencia') ?? 'normal',
    p_restricciones: restricciones(datos),
    p_observaciones: texto(datos, 'observaciones'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Dieta clasificada.' }
}

export async function generarCharolas(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const fecha = texto(datos, 'fecha')
  const tiempo = texto(datos, 'tiempo')
  if (!fecha || !tiempo) return { error: 'Elige la fecha y el tiempo de comida.' }
  const { data, error } = await supabase.schema('nutricion').rpc('generar_charolas', { p_fecha: fecha, p_tiempo: tiempo, p_area: texto(datos, 'area') })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: data ? `Lista actualizada: ${data} charola(s) para este tiempo.` : 'No hay pacientes con dieta para este tiempo (ayuno, sin colaciones o sin indicación).' }
}

export async function entregarCharola(id: string): Promise<Resultado> {
  const supabase = await sesion()
  const { error } = await supabase.schema('nutricion').rpc('entregar', { p_charola: id, p_entregada: true })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Entregada.' }
}

export async function noEntregada(id: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const motivo = texto(datos, 'motivo')
  if (!motivo) return { error: 'Escribe por qué no se entregó.' }
  const { error } = await supabase.schema('nutricion').rpc('entregar', { p_charola: id, p_entregada: false, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Registrada como no entregada.' }
}

export async function entregarArea(fecha: string, tiempo: string, area: string): Promise<Resultado> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('nutricion').rpc('entregar_area', { p_fecha: fecha, p_tiempo: tiempo, p_area: area })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: `${data} charola(s) entregadas.` }
}

export async function guardarTipoDieta(id: number | null, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const precio = texto(datos, 'precio')
  if (precio && !/^\d+(\.\d{1,2})?$/.test(precio)) return { error: 'Escribe el precio con números (por ejemplo 230 o 230.50).' }
  const { error } = await supabase.schema('nutricion').rpc('guardar_tipo_dieta', {
    p_id: id,
    p_clave: texto(datos, 'clave'),
    p_nombre: texto(datos, 'nombre'),
    p_es_ayuno: datos.get('es_ayuno') === '1',
    p_cobro_aparte: datos.get('cobro_aparte') === '1',
    p_activo: id === null ? true : datos.get('activo') === '1',
    p_precio: precio ? Number(precio) : null,
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return {
    ok:
      id === null
        ? datos.get('cobro_aparte') === '1' && datos.get('es_ayuno') !== '1'
          ? 'Dieta agregada. Se cobra aparte: su precio queda por autorizar en Costos.'
          : 'Dieta agregada (incluida en el día-cama).'
        : 'Cambios guardados.',
  }
}
