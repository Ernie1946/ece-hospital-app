'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { TIPOS_NOTA, type Cie10, type Medicamento } from '@/lib/medica'
import type { Resultado } from '@/components/FormAccion'
import { NOMBRE_COMPONENTE } from '@/lib/escalas'
import { ESCALAS_GRAVEDAD, NOMBRE_COMPONENTE_PED, type ClaveEscala } from '@/lib/escalas-ped'

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
  const pendiente = texto(datos, 'orden_pendiente')
  if (pendiente) {
    return { error: `Hay una orden capturada sin agregar (${pendiente}). Presiona "+ Agregar orden a la nota" o bórrala antes de firmar.` }
  }

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
  if (!['nota_interconsulta', 'nota_traslado'].includes(tipo) && !contenido.pronostico) return { error: 'Falta el pronóstico.' }

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

// ---------------------------------------------------------------------
// Escalas de gravedad (APACHE II, SOFA): la base calcula y guarda el puntaje
// ---------------------------------------------------------------------
const CAMPOS_ESCALA = [
  'temperatura', 'tas', 'tad', 'pam', 'fc', 'fr', 'fio2', 'pao2', 'paco2', 'patm', 'ph', 'hco3', 'sodio', 'potasio',
  'creatinina', 'hematocrito', 'leucocitos', 'glasgow', 'plaquetas', 'bilirrubina', 'uresis_ml_dia',
]

export async function registrarEscalaGravedad(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const escala = texto(datos, 'escala')
  if (escala !== 'APACHE_II' && escala !== 'SOFA') return { error: 'Elige la escala.' }
  const p: Record<string, number | string | boolean> = {}
  for (const c of CAMPOS_ESCALA) {
    const v = texto(datos, c)
    if (v === null) continue
    const n = Number(v.replace(',', '.'))
    if (!Number.isFinite(n)) return { error: `El valor de ${c.replaceAll('_', ' ')} no es un número.` }
    p[c] = n
  }
  if (escala === 'APACHE_II') {
    p.tipo_ingreso = texto(datos, 'tipo_ingreso') ?? 'no_quirurgico'
    p.cronico = datos.get('cronico') === 'on'
    p.ira = datos.get('ira') === 'on'
  } else {
    p.vasopresor = texto(datos, 'vasopresor') ?? 'ninguno'
    p.soporte_ventilatorio = datos.get('soporte_ventilatorio') === 'on'
  }
  const fecha = texto(datos, 'evaluado_en')
  const { data, error } = await supabase.schema('clinico').rpc('registrar_escala_gravedad', {
    p_encuentro: encuentroId,
    p_escala: escala,
    p_datos: p,
    p_evaluado_en: fecha ? new Date(`${fecha}:00-06:00`).toISOString() : null,
  })
  if (error) {
    const msg = error.message.replace(/\(([a-z_, ]+)\)/, (_, l: string) => `(${l.split(', ').map((k) => NOMBRE_COMPONENTE[k] ?? k).join(', ')})`)
    return { error: traducirError(msg) }
  }
  refrescar(encuentroId)
  revalidatePath(`/medicos/encuentro/${encuentroId}/escalas`)
  const r = data as { puntaje: number; mortalidad?: number | null } | null
  const nombre = escala === 'APACHE_II' ? 'APACHE II' : 'SOFA'
  return { ok: `${nombre} registrado: ${r?.puntaje ?? ''} puntos${r?.mortalidad != null ? ` (mortalidad estimada ${r.mortalidad} %)` : ''}.` }
}

export async function anularEscalaGravedad(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const id = Number(datos.get('id'))
  const motivo = texto(datos, 'motivo')
  if (!motivo) return { error: 'Escribe el motivo de la anulación.' }
  const { error } = await supabase.schema('clinico').rpc('anular_escala_gravedad', { p_id: id, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  revalidatePath(`/medicos/encuentro/${encuentroId}/escalas`)
  return { ok: 'Evaluación anulada.' }
}

// Escalas pediátricas y neonatales: la pantalla manda los datos de la escala en JSON
const ESCALAS_PED = ['PIM3', 'PELOD2', 'PSOFA', 'COMFORT_B', 'PEWS', 'SNAPPE_II', 'CRIB_II', 'NSOFA', 'SILVERMAN', 'NPASS']

export async function registrarEscalaPed(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const escala = texto(datos, 'escala')
  if (!escala || !ESCALAS_PED.includes(escala)) return { error: 'Elige la escala.' }
  let p: Record<string, unknown>
  try {
    p = JSON.parse(String(datos.get('datos') ?? '{}'))
  } catch {
    return { error: 'Datos no válidos.' }
  }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { error: 'Datos no válidos.' }
  const limpio: Record<string, number | string | boolean> = {}
  for (const [k, v] of Object.entries(p)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) continue
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) limpio[k] = v
    else if (typeof v === 'string' && v.length <= 40) limpio[k] = v
  }
  const fecha = texto(datos, 'evaluado_en')
  const { data, error } = await supabase.schema('clinico').rpc('registrar_escala_gravedad', {
    p_encuentro: encuentroId,
    p_escala: escala,
    p_datos: limpio,
    p_evaluado_en: fecha ? new Date(`${fecha}:00-06:00`).toISOString() : null,
  })
  if (error) {
    const msg = error.message.replace(/\(([a-z0-9_, ]+)\)/, (_, l: string) => `(${l.split(', ').map((k) => NOMBRE_COMPONENTE_PED[k] ?? NOMBRE_COMPONENTE[k] ?? k).join(', ')})`)
    return { error: traducirError(msg) }
  }
  refrescar(encuentroId)
  revalidatePath(`/medicos/encuentro/${encuentroId}/escalas`)
  const r = data as { puntaje: number; mortalidad?: number | null; sedacion?: number } | null
  const nombre = ESCALAS_GRAVEDAD[escala as ClaveEscala].nombre
  if (escala === 'PIM3') return { ok: `PIM3 registrado: mortalidad estimada ${r?.mortalidad} %.` }
  return {
    ok: `${nombre} registrado: ${r?.puntaje} puntos${r?.mortalidad != null ? ` (mortalidad estimada ${r.mortalidad} %)` : ''}${escala === 'NPASS' ? ` · sedación ${r?.sedacion}` : ''}.`,
  }
}

// ---------------------------------------------------------------------
// Destino del paciente: hospitalizar desde urgencias o dar el alta médica
// ---------------------------------------------------------------------
export async function hospitalizar(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const servicio = texto(datos, 'servicio')
  const tipo = texto(datos, 'tipo') ?? 'hospitalizacion'
  const motivo = texto(datos, 'motivo')
  // La transferencia se respalda en la nota de urgencias (o de traslado) firmada más reciente
  const { data: nota } = await supabase
    .schema('clinico')
    .from('documento_clinico')
    .select('id')
    .eq('encuentro_id', encuentroId)
    .in('tipo', ['nota_urgencias', 'nota_traslado'])
    .in('estado', ['firmado', 'pendiente_cofirma'])
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!nota) return { error: 'Primero firma la nota de urgencias (o de traslado) con el plan de hospitalización.' }
  if (!servicio) return { error: 'Elige el servicio que recibe al paciente.' }
  if (!motivo) return { error: 'Escribe el motivo del ingreso.' }
  const { error } = await supabase.schema('clinico').rpc('transferir', {
    p_origen: encuentroId,
    p_tipo: tipo,
    p_servicio_clave: servicio,
    p_nota: nota.id,
    p_motivo: motivo,
    p_medico_destino: texto(datos, 'medico'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  revalidatePath('/urgencias')
  return { ok: 'Ingreso solicitado. Enfermería asigna la cama y registra el traslado al piso.' }
}

export async function darAlta(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const tipo = texto(datos, 'tipo_egreso')
  if (!tipo) return { error: 'Elige el tipo de egreso.' }
  const { error } = await supabase.schema('clinico').rpc('alta_medica', { p_encuentro: encuentroId, p_tipo_egreso: tipo })
  if (error) {
    if (error.message.includes('exige')) return { error: 'Primero firma la nota de egreso (en urgencias, la nota de urgencias).' }
    return { error: traducirError(error.message) }
  }
  refrescar(encuentroId)
  revalidatePath('/urgencias')
  return { ok: 'Alta médica registrada. Enfermería registra la salida del paciente.' }
}
