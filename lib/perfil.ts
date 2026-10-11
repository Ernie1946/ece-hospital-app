import { cache } from 'react'
import { crearClienteServidor } from '@/lib/supabase/server'

export type Perfil = {
  id: string
  email: string | undefined
  nombre: string
  primer_apellido: string
  rol: string
  servicio_id: number | null
  area_id: number | null
  usuario: string
  debe_cambiar_contrasena: boolean
  jefatura_enfermeria: boolean
  hd: string | null // papel en la unidad de hemodiálisis: medico | enfermeria | consulta
  gabinete: number | null // área del gabinete donde trabaja (ECG, neurología…)
}

// Usuario de la sesión + su perfil clínico (seguridad.usuario).
// Devuelve { email } sin perfil si la cuenta existe en Auth pero no está dada
// de alta, fue dada de baja o venció su vigencia.
export const obtenerPerfil = cache(async (): Promise<{ perfil: Perfil | null; email?: string }> => {
  const supabase = await crearClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { perfil: null }

  const { data } = await supabase
    .schema('seguridad')
    .from('usuario')
    .select('nombre, primer_apellido, rol, servicio_id, area_id, usuario, debe_cambiar_contrasena, jefatura_enfermeria')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (!data) return { perfil: null, email: auth.user.email }
  const [{ data: hd }, { data: gab }] = await Promise.all([
    supabase.schema('clinico').rpc('hd_rol'),
    supabase.schema('clinico').rpc('gab_area_usuario'),
  ])
  return {
    perfil: { id: auth.user.id, email: auth.user.email, ...data, hd: (hd as string | null) ?? null, gabinete: (gab as number | null) ?? null },
    email: auth.user.email,
  }
})

export const esSistemas = (perfil: Perfil) => perfil.rol === 'admin_sistema'
export const esJefatura = (perfil: Perfil) => perfil.rol === 'enfermeria' && perfil.jefatura_enfermeria
