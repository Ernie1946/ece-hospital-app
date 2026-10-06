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

  // Resumen de los planes de cuidados activos con su evaluación más reciente (últimas 12 h)
  const { data: planes } = await supabase
    .schema('clinico')
    .from('plan_cuidado')
    .select('id, etiqueta, meta, puntuacion_inicial')
    .eq('encuentro_id', encuentroId)
    .eq('estado', 'activo')
  let resumenPlanes: string | null = null
  if (planes && planes.length) {
    const hace12h = new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    const { data: evals } = await supabase
      .schema('clinico')
      .from('plan_evaluacion')
      .select('plan_id, puntuacion, intervenciones_hechas, registrado_en')
      .in('plan_id', planes.map((x) => x.id))
      .gte('registrado_en', hace12h)
      .order('registrado_en')
    resumenPlanes = planes
      .map((pl) => {
        const ult = (evals ?? []).filter((e) => e.plan_id === pl.id).pop()
        return ult
          ? `${pl.etiqueta}: resultado ${ult.puntuacion}/5 (meta ${pl.meta}); ${(ult.intervenciones_hechas as string[]).join(', ') || 'sin intervenciones marcadas'}`
          : `${pl.etiqueta}: sin evaluación en este turno (meta ${pl.meta})`
      })
      .join('\n')
  }

  const { data: nota, error } = await supabase
    .schema('clinico')
    .from('documento_clinico')
    .insert({ encuentro_id: encuentroId, tipo: 'registro_enfermeria', autor_id: usuarioId, contenido: { ...contenido, planes: resumenPlanes } })
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

// Validación de órdenes de medicamento antes de que farmacia las prepare
export async function validarOrden(
  ordenId: string,
  encuentroId: string,
  aprobar: boolean,
  _previo: Resultado,
  datos: FormData
): Promise<Resultado> {
  const { supabase } = await sesion()
  const motivo = texto(datos, 'motivo')
  if (!aprobar && !motivo) return { error: 'Indica al médico por qué se devuelve la orden.' }
  const { error } = await supabase
    .schema('clinico')
    .rpc('validar_orden', { p_orden: ordenId, p_aprobar: aprobar, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  revalidatePath('/medicos')
  revalidatePath(`/medicos/encuentro/${encuentroId}`)
  return { ok: aprobar ? 'Orden validada; pasa a farmacia.' : 'Orden devuelta al médico.' }
}

// ---------------------------------------------------------------------
// Medicación: recibir del tubo, pedir PRN, administrar y omitir
// ---------------------------------------------------------------------
export async function recibirEnvio(envioId: string, encuentroId: string): Promise<Resultado> {
  const { supabase } = await sesion()
  const { data, error } = await supabase.schema('farmacia').rpc('recibir_envio', { p_envio: envioId })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  revalidatePath('/farmacia')
  return { ok: `Envío recibido: ${data} dosis en piso.` }
}

export async function solicitarPrn(ordenId: string, encuentroId: string): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('farmacia').rpc('solicitar_prn', { p_orden: ordenId })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  revalidatePath('/farmacia')
  return { ok: 'Dosis PRN solicitada a farmacia.' }
}

export async function administrarDosis(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const pulsera = texto(datos, 'pulsera')
  const etiqueta = texto(datos, 'etiqueta')
  if (!pulsera || !etiqueta) return { error: 'Escanea la pulsera del paciente y la etiqueta de la dosis.' }
  const { data, error } = await supabase.schema('farmacia').rpc('administrar', {
    p_pulsera: pulsera,
    p_etiqueta: etiqueta,
    p_doble_verificador: texto(datos, 'verificador'),
    p_observaciones: texto(datos, 'observaciones'),
  })
  if (error) return { error: traducirError(error.message) }
  const r = (data as { ok: boolean; mensaje: string }[] | null)?.[0]
  refrescar(encuentroId)
  revalidatePath('/farmacia')
  if (!r?.ok) return { error: `✗ ${r?.mensaje ?? 'No se pudo administrar'}` }
  return { ok: `✓ ${r.mensaje}` }
}

export async function omitirDosis(dispensacionId: string, encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const motivo = texto(datos, 'motivo')
  if (!motivo) return { error: 'Indica por qué no se administró.' }
  const { error } = await supabase.schema('farmacia').rpc('omitir', { p_dispensacion: dispensacionId, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  revalidatePath('/farmacia')
  return { ok: 'Dosis registrada como no administrada.' }
}

// ---------------------------------------------------------------------
// Planes de cuidados
// ---------------------------------------------------------------------
const lineas = (v: string | null) =>
  (v ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-•·\s]+/, '').trim())
    .filter(Boolean)

export async function crearPlanCuidado(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const diagnostico = numero(datos, 'diagnostico')
  if (!diagnostico) return { error: 'Elige el diagnóstico de enfermería.' }
  const intervenciones = lineas(texto(datos, 'intervenciones'))
  const { error } = await supabase.schema('clinico').rpc('crear_plan_cuidado', {
    p_encuentro: encuentroId,
    p_diagnostico: diagnostico,
    p_relacionado_con: texto(datos, 'relacionado_con'),
    p_manifestado_por: texto(datos, 'manifestado_por'),
    p_resultado_esperado: texto(datos, 'resultado_esperado'),
    p_puntuacion_inicial: numero(datos, 'puntuacion_inicial') ?? 2,
    p_meta: numero(datos, 'meta') ?? 4,
    p_intervenciones: intervenciones,
    p_origen: texto(datos, 'origen'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  return { ok: 'Plan de cuidados iniciado.' }
}

export async function evaluarPlanCuidado(planId: string, encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const puntuacion = numero(datos, 'puntuacion')
  if (!puntuacion) return { error: 'Elige la puntuación del resultado (1 a 5).' }
  const { error } = await supabase.schema('clinico').rpc('evaluar_plan_cuidado', {
    p_plan: planId,
    p_turno: texto(datos, 'turno'),
    p_puntuacion: puntuacion,
    p_intervenciones_hechas: datos.getAll('hechas').map(String),
    p_nota: texto(datos, 'nota'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  return { ok: 'Evaluación registrada.' }
}

export async function cerrarPlanCuidado(planId: string, encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const estado = texto(datos, 'estado') ?? 'resuelto'
  const motivo = texto(datos, 'motivo')
  if (!motivo) return { error: 'Indica el motivo del cierre.' }
  const { error } = await supabase.schema('clinico').rpc('cerrar_plan_cuidado', { p_plan: planId, p_estado: estado, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar(encuentroId)
  return { ok: estado === 'resuelto' ? 'Plan cerrado como resuelto.' : 'Plan suspendido.' }
}
