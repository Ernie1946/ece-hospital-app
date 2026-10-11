'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'

export type EstadoApertura = { error?: string } | null

// El paciente abre su enlace con su fecha de nacimiento (sin cuenta)
export async function abrirResultados(token: string, _previo: EstadoApertura, datos: FormData): Promise<EstadoApertura> {
  const fecha = String(datos.get('fecha_nacimiento') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Escriba su fecha de nacimiento.' }
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('abrir_resultados', { p_token: token, p_fecha_nacimiento: fecha })
  if (error) return { error: error.message }
  if (!data) return { error: 'La fecha de nacimiento no coincide. Por seguridad, después de 5 intentos el enlace se bloquea.' }
  const c = await cookies()
  c.set('resultados_sesion', String(data), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: `/r/${token}`, maxAge: 30 * 60 })
  redirect(`/r/${token}`)
}

export async function cerrarResultados(token: string) {
  const c = await cookies()
  c.set('resultados_sesion', '', { path: `/r/${token}`, maxAge: 0 })
  redirect(`/r/${token}`)
}
