'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { COLUMNAS_PERSONAL, type Credencial, type FilaPersonal, type Validacion } from '@/lib/personal'

// Alta, cambios y bajas del personal. Las reglas las aplica la base
// (seguridad.validar_personal / aplicar_personal); las cuentas de acceso
// las crea la función de servidor "personal" de Supabase.

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase
}

type Cliente = Awaited<ReturnType<typeof sesion>>

// Llama a la función de servidor "personal" con la sesión de quien está usando la app
async function funcionPersonal(supabase: Cliente, cuerpo: object): Promise<{ error?: string; [k: string]: unknown }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Tu sesión venció. Vuelve a entrar.' }
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/personal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
      cache: 'no-store',
    })
    if (r.status === 404) return { error: 'La función "personal" no está publicada en Supabase (Edge Functions). Sin ella no se pueden crear cuentas.' }
    const json = await r.json().catch(() => ({}))
    if (!r.ok) return { error: json.error ?? json.message ?? `La función "personal" respondió con error ${r.status}.` }
    return json
  } catch {
    return { error: 'No se pudo comunicar con la función "personal" de Supabase.' }
  }
}

export async function validarFilas(filas: FilaPersonal[]): Promise<{ error?: string; resultado?: Validacion[] }> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('seguridad').rpc('validar_personal', { p_filas: filas })
  if (error) return { error: traducirError(error.message) }
  return { resultado: (data ?? []) as Validacion[] }
}

export type ResultadoLote = { error?: string; aplicadas: number; credenciales: Credencial[]; fallas: { usuario: string; error: string }[] }

// Aplica un lote (máximo 20 filas, para no exceder el tiempo de una solicitud)
export async function aplicarLote(filas: FilaPersonal[]): Promise<ResultadoLote> {
  const supabase = await sesion()
  const lote = filas.slice(0, 20)
  const vacio: ResultadoLote = { aplicadas: 0, credenciales: [], fallas: [] }

  const { data: val, error: eVal } = await supabase.schema('seguridad').rpc('validar_personal', { p_filas: lote })
  if (eVal) return { ...vacio, error: traducirError(eVal.message) }
  const validacion = (val ?? []) as Validacion[]
  const fallas: ResultadoLote['fallas'] = validacion.filter((v) => v.errores).map((v) => ({ usuario: v.usuario ?? `fila ${v.fila}`, error: v.errores! }))
  const conErrores = new Set(validacion.filter((v) => v.errores).map((v) => v.usuario))
  const altas = validacion.filter((v) => v.accion === 'alta' && !v.errores)
  const nombreDe = new Map(validacion.map((v) => [v.usuario, v.nombre]))

  let porAplicar = lote.filter((f) => !conErrores.has(String(f.usuario ?? '').toLowerCase()))
  porAplicar = porAplicar.filter((f) => validacion.find((v) => v.usuario === String(f.usuario).toLowerCase())?.accion !== 'sin_cambios')

  // Cuentas de acceso para las altas
  const credenciales: Credencial[] = []
  if (altas.length) {
    const r = await funcionPersonal(supabase, { accion: 'crear', usuarios: altas.map((a) => a.usuario) })
    if (r.error) return { ...vacio, error: r.error, fallas }
    const cuentas = (r.cuentas ?? []) as { usuario: string; id?: string; correo_acceso?: string; contrasena?: string; error?: string }[]
    const porUsuario = new Map(cuentas.map((c) => [c.usuario, c]))
    porAplicar = porAplicar.flatMap((f) => {
      const u = String(f.usuario).toLowerCase()
      if (!altas.some((a) => a.usuario === u)) return [f]
      const c = porUsuario.get(u)
      if (!c?.id) {
        fallas.push({ usuario: u, error: c?.error ?? 'No se creó la cuenta de acceso' })
        return []
      }
      credenciales.push({ usuario: u, nombre: nombreDe.get(u) ?? '', contrasena: c.contrasena! })
      return [{ ...f, id: c.id, correo_acceso: c.correo_acceso! }]
    })
  }

  if (porAplicar.length) {
    const { error } = await supabase.schema('seguridad').rpc('aplicar_personal', { p_filas: porAplicar })
    if (error) return { ...vacio, error: traducirError(error.message), fallas }
  }
  revalidatePath('/personal')
  return { aplicadas: porAplicar.length, credenciales, fallas }
}

// Alta o cambio desde el formulario (un solo usuario)
export type ResultadoUsuario = { error?: string; ok?: string; credencial?: Credencial }

function filaDeFormulario(datos: FormData, existente: boolean): FilaPersonal {
  const f: FilaPersonal = {}
  for (const c of COLUMNAS_PERSONAL) {
    if (c.clave === 'activo' || c.clave === 'motivo_baja') continue
    const v = datos.get(c.clave)
    if (v === null) continue
    const t = String(v).trim()
    // En un usuario existente, un campo vacío del formulario borra el dato
    if (t === '') {
      if (existente && !['usuario', 'solicitado_por', 'folio_solicitud'].includes(c.clave)) f[c.clave] = null
      continue
    }
    f[c.clave] = c.clave === 'usuario' || c.clave === 'correo' ? t.toLowerCase() : c.clave === 'area' || c.clave === 'servicio' ? t.toUpperCase() : t
  }
  return f
}

export async function guardarUsuario(existente: boolean, _previo: ResultadoUsuario, datos: FormData): Promise<ResultadoUsuario> {
  const fila = filaDeFormulario(datos, existente)
  const supabase = await sesion()
  const { data: val, error } = await supabase.schema('seguridad').rpc('validar_personal', { p_filas: [fila] })
  if (error) return { error: traducirError(error.message) }
  const v = ((val ?? []) as Validacion[])[0]
  if (v?.errores) return { error: v.errores }
  if (!existente && v?.accion !== 'alta') return { error: `Ya existe una cuenta con el usuario ${v?.usuario}. Búscala en la lista para modificarla.` }
  if (v?.accion === 'sin_cambios') return { ok: 'No hubo cambios.' }
  const r = await aplicarLote([fila])
  if (r.error) return { error: r.error }
  if (r.fallas.length) return { error: r.fallas.map((x) => x.error).join('; ') }
  if (r.credenciales[0]) return { ok: `Cuenta creada para ${r.credenciales[0].nombre}.`, credencial: r.credenciales[0] }
  return { ok: `Cambios guardados${v?.cambios ? `: ${v.cambios}` : ''}.` }
}

export async function cambiarEstado(usuario: string, activo: boolean, _previo: ResultadoUsuario, datos: FormData): Promise<ResultadoUsuario> {
  const motivo = String(datos.get('motivo') ?? '').trim()
  if (!activo && motivo.length < 3) return { error: 'Escribe el motivo de la baja.' }
  const fila: FilaPersonal = { usuario, activo, ...(activo ? {} : { motivo_baja: motivo }) }
  const r = await aplicarLote([fila])
  if (r.error) return { error: r.error }
  if (r.fallas.length) return { error: r.fallas.map((x) => x.error).join('; ') }
  return { ok: activo ? 'Cuenta reactivada.' : 'Cuenta dada de baja: ya no puede entrar al expediente.' }
}

export async function restablecerContrasena(id: string, usuario: string, nombre: string): Promise<ResultadoUsuario> {
  const supabase = await sesion()
  const r = await funcionPersonal(supabase, { accion: 'restablecer', id })
  if (r.error) return { error: r.error }
  const { error } = await supabase.schema('seguridad').rpc('marcar_contrasena_temporal', { p_usuario: id })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/personal')
  return { ok: 'Contraseña restablecida. Entrégala a la persona; al entrar se le pedirá cambiarla.', credencial: { usuario, nombre, contrasena: String(r.contrasena) } }
}

// Jefatura de Enfermería: asigna camas por turno y ve todo el hospital
export async function marcarJefatura(id: string, valor: boolean): Promise<{ error?: string; ok?: string }> {
  const supabase = await sesion()
  const { error } = await supabase.schema('seguridad').rpc('marcar_jefatura', { p_usuario: id, p_valor: valor })
  if (error) return { error: traducirError(error.message) }
  revalidatePath(`/personal/${id}`)
  return { ok: valor ? 'Ahora tiene Jefatura de Enfermería.' : 'Se quitó la Jefatura de Enfermería.' }
}
