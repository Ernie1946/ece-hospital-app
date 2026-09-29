import { cache } from 'react'
import { crearClienteServidor } from '@/lib/supabase/server'

export type Perfil = {
  id: string
  email: string | undefined
  nombre: string
  primer_apellido: string
  rol: string
  servicio_id: number | null
}

// Usuario de la sesión + su perfil clínico (seguridad.usuario).
// Devuelve { email } sin perfil si la cuenta existe en Auth pero no está dada de alta.
export const obtenerPerfil = cache(async (): Promise<{ perfil: Perfil | null; email?: string }> => {
  const supabase = await crearClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { perfil: null }

  const { data } = await supabase
    .schema('seguridad')
    .from('usuario')
    .select('nombre, primer_apellido, rol, servicio_id')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (!data) return { perfil: null, email: auth.user.email }
  return { perfil: { id: auth.user.id, email: auth.user.email, ...data }, email: auth.user.email }
})
