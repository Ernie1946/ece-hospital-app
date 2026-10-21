'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'
import type { FilaArticulo, Revision } from '@/lib/catalogos'

// Las reglas (quién captura, quién autoriza, validaciones) las aplica la base.

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase
}
const texto = (d: FormData, k: string) => {
  const v = d.get(k)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

// Excel: revisar (vista previa) o aplicar un lote de filas
export async function procesarArticulos(area: string, filas: FilaArticulo[], aplicar: boolean): Promise<{ error?: string; resultado?: Revision[] }> {
  const supabase = await sesion()
  if (!Array.isArray(filas) || filas.length > 1000) return { error: 'Lote no válido.' }
  const { data, error } = await supabase.schema('catalogo').rpc('importar_conceptos', { p_area: area, p_filas: filas, p_aplicar: aplicar })
  if (error) return { error: traducirError(error.message) }
  if (aplicar) revalidatePath(`/catalogos/${area}`)
  return { resultado: data as Revision[] }
}

// Alta o cambio de un artículo desde la pantalla (mismo camino que el Excel)
export async function guardarArticulo(area: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const fila = {
    fila: 1,
    clave: texto(datos, 'clave') ?? '',
    descripcion: texto(datos, 'descripcion') ?? '',
    codigo_barras: texto(datos, 'codigo_barras') ?? '',
    unidad: texto(datos, 'unidad') ?? '',
    tipo: texto(datos, 'tipo') ?? '',
    precio: texto(datos, 'precio') ?? '',
    iva: texto(datos, 'iva') ?? '16',
    clave_sat: texto(datos, 'clave_sat') ?? '',
    unidad_sat: texto(datos, 'unidad_sat') ?? '',
    requiere_lote: datos.get('requiere_lote') === 'on' ? 'si' : 'no',
    activo: datos.get('activo') === 'off' ? 'no' : 'si',
  }
  const { data, error } = await supabase.schema('catalogo').rpc('importar_conceptos', { p_area: area, p_filas: [fila], p_aplicar: true })
  if (error) return { error: traducirError(error.message) }
  const r = (data as Revision[])[0]
  if (r.accion === 'error') return { error: r.mensaje ?? 'No se pudo guardar.' }
  revalidatePath(`/catalogos/${area}`)
  revalidatePath('/catalogos')
  const txt: Record<string, string> = {
    nuevo: 'Artículo dado de alta. Su precio queda en espera de autorización de Costos.',
    cambio: 'Artículo actualizado.',
    precio: 'Cambio de precio enviado a Costos para su autorización.',
    cambio_precio: 'Artículo actualizado; el precio nuevo queda en espera de autorización.',
    sin_cambios: 'No había cambios que guardar.',
  }
  return { ok: txt[r.accion] }
}

// Propuesta de precio con fecha de vigencia; Costos también fija precios de convenio
export async function proponerPrecio(area: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const precio = Number(String(datos.get('precio') ?? '').replace(/[$,\s]/g, ''))
  if (!Number.isFinite(precio) || precio < 0) return { error: 'Escribe un precio válido.' }
  const { data, error } = await supabase.schema('catalogo').rpc('proponer_precio', {
    p_concepto: Number(datos.get('concepto')),
    p_precio: precio,
    p_lista: texto(datos, 'lista'),
    p_vigente_desde: texto(datos, 'vigente_desde'),
    p_motivo: texto(datos, 'motivo'),
  })
  if (error) return { error: traducirError(error.message) }
  revalidatePath(`/catalogos/${area}`)
  revalidatePath('/catalogos/precios')
  revalidatePath('/catalogos/listas')
  return { ok: (data as { autorizada: boolean }).autorizada ? 'Precio autorizado.' : 'Precio enviado a Costos para su autorización.' }
}

// Costos: autorizar o rechazar propuestas seleccionadas
export async function resolverPropuestas(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const ids = datos.getAll('propuesta').map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
  const autorizar = datos.get('decision') === 'autorizar'
  if (ids.length === 0) return { error: 'Selecciona al menos un precio.' }
  const { data, error } = await supabase
    .schema('catalogo')
    .rpc('resolver_propuestas', { p_ids: ids, p_autorizar: autorizar, p_motivo: texto(datos, 'motivo') })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/catalogos', 'layout')
  redirect(`/catalogos/precios?hecho=${Number(data)}&decision=${autorizar ? 'autorizar' : 'rechazar'}`)
}

// Costos: listas de precios por aseguradora
export async function guardarLista(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const aseg = texto(datos, 'aseguradora')
  const { error } = await supabase.schema('catalogo').rpc('guardar_lista_precios', {
    p_clave: texto(datos, 'clave') ?? '',
    p_nombre: texto(datos, 'nombre') ?? '',
    p_aseguradora: aseg ? Number(aseg) : null,
    p_descuento: Number(texto(datos, 'descuento') ?? '0'),
    p_activa: datos.get('activa') !== 'off',
  })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/catalogos/listas')
  return { ok: 'Lista de precios guardada.' }
}

// Costos / Sistemas: responsables de cada área
export async function asignarResponsable(area: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const usuario = texto(datos, 'usuario')
  if (!usuario) return { error: 'Elige a la persona.' }
  const quitar = datos.get('quitar') === '1'
  const { error } = await supabase.schema('catalogo').rpc('asignar_responsable', { p_area: area, p_usuario: usuario, p_asignar: !quitar })
  if (error) return { error: traducirError(error.message) }
  revalidatePath(`/catalogos/${area}`)
  return { ok: quitar ? 'Responsable retirado.' : 'Responsable asignado.' }
}

// Costos / Sistemas: activar, renombrar o crear áreas de cargo
export async function guardarArea(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const { error } = await supabase.schema('catalogo').rpc('guardar_area_cargo', {
    p_clave: texto(datos, 'clave') ?? '',
    p_nombre: texto(datos, 'nombre') ?? '',
    p_carga_enfermeria: datos.get('carga_enfermeria') === 'on',
    p_activa: datos.get('activa') === 'on',
  })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/catalogos')
  return { ok: 'Área guardada.' }
}
