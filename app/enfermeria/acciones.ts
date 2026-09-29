'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'

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
  const concepto = texto(datos, 'concepto')
  const volumen = numero(datos, 'volumen_ml')
  if (!sentido || !concepto || !volumen || volumen <= 0) return { error: 'Indica ingreso o egreso, concepto y volumen en mL.' }

  const { error } = await supabase
    .schema('clinico')
    .from('liquidos')
    .insert({ encuentro_id: encuentroId, sentido, concepto, volumen_ml: volumen, registrado_por: usuarioId })
  if (error) return { error: traducirError(error.message) }

  refrescar(encuentroId)
  return { ok: `${sentido === 'ingreso' ? 'Ingreso' : 'Egreso'} de ${volumen} mL registrado.` }
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
