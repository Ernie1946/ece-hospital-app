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
  gabinetes: number[] // gabinetes donde trabaja (técnico por su área; médico por sus privilegios)
  privilegios: string[] // privilegios clínicos vigentes (credencialización)
  hemo: string | null // papel en hemodinamia: medico | enfermeria | tecnico | anestesia | consulta
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
  const [{ data: hd }, { data: gab }, { data: hemo }, { data: priv }] = await Promise.all([
    supabase.schema('clinico').rpc('hd_rol'),
    supabase.schema('clinico').rpc('gab_areas_usuario'),
    supabase.schema('clinico').rpc('hemo_rol'),
    supabase.schema('seguridad').rpc('mis_privilegios'),
  ])
  return {
    perfil: { id: auth.user.id, email: auth.user.email, ...data, hd: (hd as string | null) ?? null, gabinetes: ((gab as number[] | null) ?? []).map(Number),
      privilegios: (priv as string[] | null) ?? [], hemo: (hemo as string | null) ?? null },
    email: auth.user.email,
  }
})

export const esSistemas = (perfil: Perfil) => perfil.rol === 'admin_sistema'
export const esJefatura = (perfil: Perfil) => perfil.rol === 'enfermeria' && perfil.jefatura_enfermeria
