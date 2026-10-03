'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { TIPOS_NOTA, type Cie10, type Medicamento } from '@/lib/medica'
import type { Resultado } from '@/components/FormAccion'

// Las reglas (rol, servicio, CIE-10, alergias, firma) las aplica la base;
// aquí solo se arma lo capturado y se traduce el resultado.

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

function lista(datos: FormData, campo: string): unknown[] {
  try {
    const v = JSON.parse(String(datos.get(campo) ?? '[]'))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function refrescar(encuentroId: string) {
  revalidatePath('/medicos')
  revalidatePath(`/medicos/encuentro/${encuentroId}`)
  revalidatePath(`/enfermeria/encuentro/${encuentroId}`)
}

// ---------------------------------------------------------------------
// Búsquedas (las llama el formulario mientras se escribe)
// ---------------------------------------------------------------------
export async function buscarCie10(consulta: string): Promise<Cie10[]> {
  if (consulta.trim().length < 2) return []
  const { supabase } = await sesion()
  const { data } = await supabase.schema('catalogo').rpc('buscar_cie10', { p_texto: consulta, p_limite: 12 })
  return (data ?? []) as Cie10[]
}

export async function buscarMedicamentos(consulta: string): Promise<Medicamento[]> {
  const q = consulta.trim()
  if (q.length < 2) return []
  const { supabase } = await sesion()
  const { data } = await supabase
    .schema('catalogo')
    .from('medicamento')
    .select('id, denominacion_generica, concentracion, forma_farmaceutica, via_default, unidad_dosis, alto_riesgo, grupo_controlado')
    .eq('activo', true)
    .or(`denominacion_generica.ilike.%${q.replace(/[%,()]/g, '')}%,nombre_comercial.ilike.%${q.replace(/[%,()]/g, '')}%`)
    .order('denominacion_generica')
    .limit(12)
  return (data ?? []) as Medicamento[]
}

// ---------------------------------------------------------------------
// Nota médica con diagnósticos y órdenes: se guarda y se firma en un paso
// ---------------------------------------------------------------------
export async function registrarNotaMedica(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const tipo = texto(datos, 'tipo') ?? ''
  const definicion = TIPOS_NOTA[tipo]
  if (!definicion) return { error: 'Elige el tipo de nota.' }

  const contenido: Record<string, string> = {}
  for (const c of [...definicion.campos.map((x) => x.clave), 'diagnostico', 'pronostico']) {
    const v = texto(datos, c)
    if (v) contenido[c] = v
  }
  const faltan = definicion.campos.filter((c) => c.obligatorio && !contenido[c.clave]).map((c) => c.titulo)
  if (faltan.length) return { error: `Falta: ${faltan.join(', ')}.` }

  const diagnosticos = lista(datos, 'diagnosticos')
  const ordenes = lista(datos, 'ordenes')
  if (!contenido.diagnostico && diagnosticos.length === 0) {
    return { error: 'Agrega al menos un diagnóstico CIE-10 o escribe el diagnóstico.' }
  }
  if (tipo !== 'nota_interconsulta' && !contenido.pronostico) return { error: 'Falta el pronóstico.' }

  const { error } = await supabase.schema('clinico').rpc('registrar_nota_medica', {
    p_encuentro: encuentroId,
    p_tipo: tipo,
    p_contenido: contenido,
    p_diagnosticos: diagnosticos,
    p_ordenes: ordenes,
  })
  if (error) return { error: traducirError(error.message) }

  const { data: nota } = await supabase
    .schema('clinico')
    .from('documento_clinico')
    .select('estado')
    .eq('encuentro_id', encuentroId)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  refrescar(encuentroId)
  const n = ordenes.length
  const conOrdenes = n ? ` ${n} ${n > 1 ? 'órdenes activas' : 'orden activa'}.` : ''
  return nota?.estado === 'pendiente_cofirma'
    ? { ok: `${definicion.nombre} firmada; queda pendiente de cofirma del médico tratante.${conOrdenes}` }
    : { ok: `${definicion.nombre} firmada.${conOrdenes}` }
}

// Cofirma del médico tratante a la nota de un residente
export async function cofirmarNota(documentoId: string, encuentroId: string): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('clinico').rpc('firmar_documento', { p_documento: documentoId })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  return { ok: 'Nota cofirmada.' }
}

export async function suspenderOrden(ordenId: string, encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const motivo = texto(datos, 'motivo')
  if (!motivo) return { error: 'Indica el motivo de la suspensión.' }
  const { error } = await supabase.schema('clinico').rpc('suspender_orden', { p_orden: ordenId, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  return { ok: 'Orden suspendida.' }
}
