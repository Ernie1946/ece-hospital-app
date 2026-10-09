'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'

// Asignación de camas por turno (solo Jefatura de Enfermería; la base lo exige)

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase
}

export type ResultadoAsignacion = { error?: string; ok?: string }

export async function asignarCamas(fecha: string, turno: string, enfermera: string | null, camas: string[]): Promise<ResultadoAsignacion> {
  const supabase = await sesion()
  const { data, error } = await supabase
    .schema('clinico')
    .rpc('asignar_camas', { p_fecha: fecha, p_turno: turno, p_enfermera: enfermera, p_camas: camas })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/enfermeria/asignacion')
  revalidatePath('/enfermeria')
  const n = Number(data ?? 0)
  return { ok: enfermera ? `${n} cama(s) asignada(s).` : `${n} cama(s) quedaron sin enfermera.` }
}

export async function copiarAsignacion(fecha: string, turno: string, deFecha: string, deTurno: string): Promise<ResultadoAsignacion> {
  const supabase = await sesion()
  const { data, error } = await supabase
    .schema('clinico')
    .rpc('copiar_asignacion', { p_fecha: fecha, p_turno: turno, p_de_fecha: deFecha, p_de_turno: deTurno })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/enfermeria/asignacion')
  return { ok: Number(data) ? `Se copiaron ${data} cama(s) del turno anterior.` : 'No había nada que copiar (o esas camas ya están asignadas).' }
}
