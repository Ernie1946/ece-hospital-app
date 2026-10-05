'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'
import type { FilaCatalogo } from '@/lib/farmacia'

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

const refrescar = () => revalidatePath('/farmacia')

export async function programarPendientes(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const horas = Number(texto(datos, 'horas') ?? 24)
  const { data, error } = await supabase.schema('farmacia').rpc('programar_pendientes', { p_horas: horas })
  if (error) return { error: traducirError(error.message) }
  const filas = (data ?? []) as { medicamento: string; paciente: string; dosis: number; error: string | null }[]
  refrescar()
  const total = filas.reduce((s, f) => s + f.dosis, 0)
  const bloqueadas = filas.filter((f) => f.error)
  if (bloqueadas.length) {
    return {
      error: `Se programaron ${total} dosis. No se programó: ${bloqueadas.map((f) => `${f.medicamento} de ${f.paciente} (${f.error})`).join('; ')}`,
    }
  }
  return { ok: filas.length === 0 ? 'No hay órdenes validadas por programar.' : `Se programaron ${total} dosis de ${filas.length} órdenes (próximas ${horas} h).` }
}

export async function prepararDosis(dispensacionId: string): Promise<Resultado> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('farmacia').rpc('preparar_fefo', { p_dispensacion: dispensacionId })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: `Preparada · etiqueta ${data}` }
}

export async function enviarPorTubo(ids: string[]): Promise<Resultado> {
  const supabase = await sesion()
  if (ids.length === 0) return { error: 'No hay dosis por enviar.' }
  const { error } = await supabase.schema('farmacia').rpc('enviar_por_tubo', { p_dispensaciones: ids })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: `${ids.length} dosis enviada(s) por tubo.` }
}

export async function devolverDosis(dispensacionId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const motivo = texto(datos, 'motivo')
  if (!motivo) return { error: 'Indica el motivo de la devolución.' }
  const { error } = await supabase.schema('farmacia').rpc('devolver', { p_dispensacion: dispensacionId, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Dosis devuelta; la unidad regresa al inventario.' }
}

export async function registrarEntrada(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const medicamento = Number(texto(datos, 'medicamento'))
  const lote = texto(datos, 'lote')
  const caducidad = texto(datos, 'caducidad')
  const cantidad = Number(texto(datos, 'cantidad'))
  if (!medicamento || !lote || !caducidad || !cantidad) return { error: 'Faltan datos: medicamento, lote, caducidad y cantidad.' }
  const { error } = await supabase.schema('farmacia').rpc('registrar_entrada', {
    p_medicamento: medicamento,
    p_lote: lote,
    p_caducidad: caducidad,
    p_cantidad: Math.round(cantidad),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: `Entrada registrada: lote ${lote}, ${cantidad} unidades.` }
}

export type ResultadoImportacion = {
  error?: string
  nuevos?: number
  actualizados?: number
  lotes?: number
  errores?: { fila: number; clave: string | null; error: string }[]
}

export async function importarCatalogo(filas: FilaCatalogo[]): Promise<ResultadoImportacion> {
  const supabase = await sesion()
  if (filas.length === 0) return { error: 'No hay filas válidas para importar.' }
  const { data, error } = await supabase.schema('catalogo').rpc('importar_medicamentos', { p_filas: filas })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return data as ResultadoImportacion
}
