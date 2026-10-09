// =====================================================================
// Función de servidor "personal" (Supabase Edge Function)
//   Crea las cuentas de acceso del personal y restablece contraseñas.
//   Usa la llave maestra de Supabase, que existe solo aquí dentro
//   (Supabase la pone sola; nunca va en la app ni en Netlify).
//   Solo la puede usar una persona con rol de Sistemas (admin_sistema).
//
//   Se publica en Supabase: Edge Functions → Deploy a new function →
//   Via Editor → nombre "personal" → pegar este archivo → Deploy.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Dominio interno de las cuentas sin correo (no recibe correos).
// Debe ser el mismo que DOMINIO_USUARIOS en lib/personal.ts de la app.
const DOMINIO = 'usuarios.ece'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Contraseña temporal fácil de dictar: 4 letras, guion, 4 números (sin l, o, 0, 1)
function contrasenaTemporal() {
  const letras = 'abcdefghjkmnpqrstuvwxyz'
  const numeros = '23456789'
  const azar = crypto.getRandomValues(new Uint32Array(8))
  const parte = (fuente: string, desde: number) =>
    Array.from(azar.slice(desde, desde + 4), (n) => fuente[n % fuente.length]).join('')
  return `${parte(letras, 0)}-${parte(numeros, 4)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const llave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!llave) return responder(500, { error: 'La función no tiene acceso a la llave de servicio de Supabase.' })
    const admin = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } })

    // ¿Quién llama? Debe ser personal de Sistemas activo
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: quien } = await admin.auth.getUser(token)
    if (!quien?.user) return responder(401, { error: 'Sesión no válida. Vuelve a entrar.' })
    const { data: yo } = await admin
      .schema('seguridad')
      .from('usuario')
      .select('rol, activo, vigencia_hasta')
      .eq('id', quien.user.id)
      .maybeSingle()
    const vigente = !yo?.vigencia_hasta || new Date(yo.vigencia_hasta + 'T23:59:59') >= new Date()
    if (!yo || !yo.activo || !vigente || yo.rol !== 'admin_sistema') {
      return responder(403, { error: 'Solo Sistemas puede crear cuentas o restablecer contraseñas.' })
    }

    const cuerpo = await req.json()

    // Crear cuentas: { accion: 'crear', usuarios: ['12345', 'med-0456', …] }
    if (cuerpo.accion === 'crear') {
      const usuarios: string[] = Array.isArray(cuerpo.usuarios) ? cuerpo.usuarios.slice(0, 50) : []
      const cuentas = []
      for (const u of usuarios) {
        const usuario = String(u).trim().toLowerCase()
        if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(usuario)) {
          cuentas.push({ usuario, error: 'Usuario inválido' })
          continue
        }
        const correo = `${usuario}@${DOMINIO}`
        const contrasena = contrasenaTemporal()
        const { data, error } = await admin.auth.admin.createUser({
          email: correo,
          password: contrasena,
          email_confirm: true,
          app_metadata: { usuario },
        })
        if (data?.user) {
          cuentas.push({ usuario, id: data.user.id, correo_acceso: correo, contrasena })
          continue
        }
        // La cuenta ya existía (un intento anterior que no terminó): se reutiliza con contraseña nueva
        const { data: id } = await admin.schema('seguridad').rpc('id_cuenta_acceso', { p_correo: correo })
        if (id) {
          const { error: e2 } = await admin.auth.admin.updateUserById(id as string, { password: contrasena })
          cuentas.push(e2 ? { usuario, error: e2.message } : { usuario, id, correo_acceso: correo, contrasena })
        } else {
          cuentas.push({ usuario, error: error?.message ?? 'No se pudo crear la cuenta' })
        }
      }
      return responder(200, { cuentas })
    }

    // Restablecer contraseña: { accion: 'restablecer', id: '<uuid>' }
    if (cuerpo.accion === 'restablecer') {
      const contrasena = contrasenaTemporal()
      const { error } = await admin.auth.admin.updateUserById(String(cuerpo.id), { password: contrasena })
      if (error) return responder(400, { error: error.message })
      return responder(200, { contrasena })
    }

    return responder(400, { error: 'Acción desconocida' })
  } catch (e) {
    return responder(500, { error: e instanceof Error ? e.message : String(e) })
  }
})
