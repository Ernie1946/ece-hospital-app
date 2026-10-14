'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'
import type { FilaEspecialidad, FilaPrivilegio, RevisionFila } from '@/lib/privilegios'

// Privilegios y especialidades: solo Sistemas, con lo que ratificaron Dirección Médica / Comité de Credenciales

async function db() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase.schema('seguridad')
}
const t = (d: FormData, c: string) => {
  const v = d.get(c)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
const refrescar = (id: string) => {
  revalidatePath(`/personal/${id}`)
  revalidatePath('/personal/privilegios')
}

export async function otorgarPrivilegios(usuarioId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const claves = d.getAll('privilegio').filter((x): x is string => typeof x === 'string' && x !== '')
  if (claves.length === 0) return { error: 'Marca al menos un privilegio.' }
  const supabase = await db()
  const hechos: string[] = []
  for (const clave of claves) {
    const { error } = await supabase.rpc('otorgar_privilegio', {
      p_usuario: usuarioId,
      p_privilegio: clave,
      p_autorizado_por: t(d, 'autorizado_por'),
      p_acta: t(d, 'acta'),
      p_fecha: t(d, 'fecha'),
      p_vigencia: t(d, 'vigencia'),
      p_restricciones: t(d, 'restricciones'),
    })
    if (error) {
      refrescar(usuarioId)
      return { error: `${hechos.length ? `Se registraron ${hechos.length}; ` : ''}${clave}: ${traducirError(error.message)}` }
    }
    hechos.push(clave)
  }
  refrescar(usuarioId)
  return { ok: `${hechos.length} privilegio(s) registrado(s).` }
}

export async function revocarPrivilegio(id: string, usuarioId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const { error } = await (await db()).rpc('revocar_privilegio', { p_id: id, p_motivo: t(d, 'motivo') })
  if (error) return { error: traducirError(error.message) }
  refrescar(usuarioId)
  return { ok: 'Privilegio revocado.' }
}

export async function agregarEspecialidad(usuarioId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const { error } = await (await db()).rpc('agregar_especialidad', {
    p_usuario: usuarioId,
    p_tipo: t(d, 'tipo'),
    p_nombre: t(d, 'nombre'),
    p_cedula: t(d, 'cedula'),
    p_institucion: t(d, 'institucion'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(usuarioId)
  return { ok: 'Especialidad registrada.' }
}

export async function quitarEspecialidad(id: string, usuarioId: string): Promise<Resultado> {
  const { error } = await (await db()).rpc('quitar_especialidad', { p_id: id })
  if (error) return { error: traducirError(error.message) }
  refrescar(usuarioId)
  return { ok: 'Especialidad quitada.' }
}

// ---------------------------------------------------------------------
// Carga desde Excel: revisar (sin guardar) y aplicar
// ---------------------------------------------------------------------

export async function procesarPrivilegios(filas: FilaPrivilegio[], aplicar: boolean): Promise<{ error?: string; resultado?: RevisionFila[] }> {
  const { data, error } = await (await db()).rpc('procesar_privilegios', { p_filas: filas, p_aplicar: aplicar })
  if (error) return { error: traducirError(error.message) }
  if (aplicar) revalidatePath('/personal/privilegios')
  return { resultado: data as RevisionFila[] }
}

export async function procesarEspecialidades(filas: FilaEspecialidad[], aplicar: boolean): Promise<{ error?: string; resultado?: RevisionFila[] }> {
  const { data, error } = await (await db()).rpc('procesar_especialidades', { p_filas: filas, p_aplicar: aplicar })
  if (error) return { error: traducirError(error.message) }
  if (aplicar) revalidatePath('/personal/privilegios')
  return { resultado: data as RevisionFila[] }
}
