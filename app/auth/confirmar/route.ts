import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/server'

// Enlace del correo de recuperación: valida el código de un solo uso, abre sesión
// y lleva a crear la contraseña nueva. Sirve aunque se abra en otro equipo (celular).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const tipo = searchParams.get('type')
  // Mismo sitio que abrió el enlace (para que la cookie de sesión aplique)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, `${proto}://${host}`))
  if (tokenHash && tipo === 'recovery') {
    const supabase = await crearClienteServidor()
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (!error) return ir('/cuenta/contrasena?recuperacion=1')
  }
  return ir('/recuperar?error=enlace')
}
