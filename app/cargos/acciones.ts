'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { obtenerPerfil } from '@/lib/perfil'
import type { Resultado } from '@/components/FormAccion'

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase
}

export type PacienteCargo = { encuentro_id: string; paciente: string; expediente: string; cama: string | null; area: string | null; lista: string }
export type ArticuloCargo = { id: number; clave: string; descripcion: string; unidad: string; area: string; requiere_lote: boolean; precio: number | null }
export type CargoHecho = {
  id: number
  descripcion: string
  clave: string
  cantidad: number
  precio_unitario: number
  importe: number
  precio_pendiente: boolean
  lote: string | null
  serie: string | null
  area_nombre: string | null
  creado_en: string
  creado_por: string | null
  creado_por_nombre: string
  cancelado: boolean
  origen: string
}

async function datosPaciente(supabase: Awaited<ReturnType<typeof sesion>>, encuentro: string): Promise<PacienteCargo | null> {
  const [{ data: e }, { data: c }, { data: lista }] = await Promise.all([
    supabase.schema('clinico').from('encuentro').select('id, paciente_id, estado').eq('id', encuentro).maybeSingle(),
    supabase.schema('camas').from('v_censo').select('cama, area_nombre').eq('encuentro_id', encuentro).maybeSingle(),
    supabase.schema('cuenta').rpc('lista_de', { p_encuentro: encuentro }),
  ])
  if (!e) return null
  const [{ data: p }, { data: l }] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('nombre, primer_apellido, segundo_apellido, expediente').eq('id', e.paciente_id).single(),
    supabase.schema('catalogo').from('lista_precios').select('nombre').eq('id', lista as number).maybeSingle(),
  ])
  return {
    encuentro_id: encuentro,
    paciente: [p?.nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' '),
    expediente: (p?.expediente as string) ?? '',
    cama: (c?.cama as string | null) ?? null,
    area: (c?.area_nombre as string | null) ?? null,
    lista: (l?.nombre as string) ?? 'Particular',
  }
}

export async function buscarPorPulsera(codigo: string): Promise<{ error?: string; paciente?: PacienteCargo }> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('clinico').rpc('encuentro_por_pulsera', { p_codigo: codigo.trim() })
  if (error) return { error: traducirError(error.message) }
  if (!data) return { error: 'No encontré un paciente internado con esa pulsera.' }
  const p = await datosPaciente(supabase, data as string)
  return p ? { paciente: p } : { error: 'No tienes acceso a ese paciente.' }
}

export async function buscarPacientes(texto: string): Promise<PacienteCargo[]> {
  const t = texto.trim().replace(/[%,()]/g, '')
  if (t.length < 3) return []
  const supabase = await sesion()
  const { data } = await supabase
    .schema('camas')
    .from('v_censo')
    .select('encuentro_id, paciente, expediente, cama, area_nombre')
    .not('encuentro_id', 'is', null)
    .in('estado_encuentro', ['activo', 'alta_medica'])
    .or(`paciente.ilike.%${t}%,expediente.ilike.%${t}%,cama.ilike.%${t}%`)
    .limit(10)
  return ((data ?? []) as { encuentro_id: string; paciente: string; expediente: string; cama: string; area_nombre: string }[]).map((r) => ({
    encuentro_id: r.encuentro_id,
    paciente: r.paciente,
    expediente: r.expediente,
    cama: r.cama,
    area: r.area_nombre,
    lista: '',
  }))
}

export async function elegirPaciente(encuentro: string): Promise<{ error?: string; paciente?: PacienteCargo }> {
  const supabase = await sesion()
  const p = await datosPaciente(supabase, encuentro)
  return p ? { paciente: p } : { error: 'Paciente no encontrado.' }
}

async function precioPara(supabase: Awaited<ReturnType<typeof sesion>>, concepto: number, encuentro: string) {
  const { data: lista } = await supabase.schema('cuenta').rpc('lista_de', { p_encuentro: encuentro })
  const { data } = await supabase.schema('catalogo').rpc('precio_vigente', { p_concepto: concepto, p_lista: lista })
  return data === null || data === undefined ? null : Number(data)
}

export async function buscarArticulo(codigo: string, encuentro: string): Promise<{ error?: string; articulo?: ArticuloCargo }> {
  const supabase = await sesion()
  const { perfil } = await obtenerPerfil()
  const { data, error } = await supabase.schema('catalogo').rpc('buscar_articulo', { p_codigo: codigo.trim() })
  if (error) return { error: traducirError(error.message) }
  const a = (data as { id: number; clave: string; descripcion: string; unidad: string; area_cargo_id: number; area: string; requiere_lote: boolean }[] | null)?.[0]
  if (!a) return { error: `No hay ningún artículo activo con el código ${codigo.trim()}.` }
  if (!perfil?.cargos.includes(Number(a.area_cargo_id))) return { error: `${a.descripcion} es de ${a.area}: no puedes cargarlo desde tu área.` }
  return { articulo: { ...a, precio: await precioPara(supabase, a.id, encuentro) } }
}

export async function buscarArticulos(texto: string): Promise<ArticuloCargo[]> {
  const t = texto.trim().replace(/[%,()]/g, '')
  if (t.length < 3) return []
  const supabase = await sesion()
  const { perfil } = await obtenerPerfil()
  if (!perfil?.cargos.length) return []
  const { data } = await supabase
    .schema('catalogo')
    .from('v_articulo')
    .select('id, clave, descripcion, unidad, area_nombre, requiere_lote, precio')
    .eq('activo', true)
    .in('area_cargo_id', perfil.cargos)
    .not('tipo', 'in', '(medicamento,dia_cama)')
    .or(`descripcion.ilike.%${t}%,clave.ilike.%${t}%`)
    .order('descripcion')
    .limit(12)
  return ((data ?? []) as { id: number; clave: string; descripcion: string; unidad: string; area_nombre: string; requiere_lote: boolean; precio: number | null }[]).map((r) => ({
    id: r.id,
    clave: r.clave,
    descripcion: r.descripcion,
    unidad: r.unidad,
    area: r.area_nombre,
    requiere_lote: r.requiere_lote,
    precio: r.precio,
  }))
}

export async function cargar(encuentro: string, concepto: number, cantidad: number, lote: string, serie: string): Promise<{ error?: string; ok?: string }> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('cuenta').rpc('cargar_articulo', {
    p_encuentro: encuentro,
    p_concepto: concepto,
    p_cantidad: cantidad,
    p_lote: lote || null,
    p_serie: serie || null,
  })
  if (error) return { error: traducirError(error.message) }
  const r = data as { importe: number; pendiente: boolean }
  revalidatePath(`/cargos/cuenta/${encuentro}`)
  return { ok: r.pendiente ? 'Cargado; el precio se completa cuando Costos lo autorice.' : 'Cargado a la cuenta.' }
}

export async function cargosDelPaciente(encuentro: string): Promise<CargoHecho[]> {
  const supabase = await sesion()
  const { data } = await supabase
    .schema('cuenta')
    .from('v_cargo')
    .select('id, descripcion, clave, cantidad, precio_unitario, importe, precio_pendiente, lote, serie, area_nombre, creado_en, creado_por, creado_por_nombre, cancelado, origen')
    .eq('encuentro_id', encuentro)
    .order('creado_en', { ascending: false })
    .limit(30)
  return (data ?? []) as CargoHecho[]
}

export async function cancelarCargo(id: number, motivo: string): Promise<{ error?: string }> {
  const supabase = await sesion()
  const { error } = await supabase.schema('cuenta').rpc('cancelar_cargo', { p_cargo: id, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/cargos', 'layout')
  return {}
}

// Caja / Admisión / Costos: lista de precios de la cuenta
export async function asignarLista(encuentro: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const v = datos.get('lista')
  const { error } = await supabase.schema('cuenta').rpc('asignar_lista', { p_encuentro: encuentro, p_lista: typeof v === 'string' && v ? v : null })
  if (error) return { error: traducirError(error.message) }
  revalidatePath(`/cargos/cuenta/${encuentro}`)
  return { ok: 'Lista de precios actualizada para los cargos que siguen.' }
}

export async function cancelarDesdeCuenta(encuentro: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const r = await cancelarCargo(Number(datos.get('id')), String(datos.get('motivo') ?? ''))
  if (r.error) return { error: r.error }
  revalidatePath(`/cargos/cuenta/${encuentro}`)
  return { ok: 'Cargo cancelado.' }
}
