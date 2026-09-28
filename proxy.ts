import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Se ejecuta antes de cada página:
//  1. Refresca la sesión de Supabase (renueva el token si está por vencer).
//  2. Sin sesión → manda a /login.  Con sesión en /login → manda al censo.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() valida la firma del token; no confiar en getSession() aquí
  const { data } = await supabase.auth.getClaims()
  const conSesion = !!data?.claims

  const ruta = request.nextUrl.pathname
  const esLogin = ruta.startsWith('/login')

  if (!conSesion && !esLogin) {
    return redirigir(request, response, '/login')
  }
  if (conSesion && esLogin) {
    return redirigir(request, response, '/')
  }
  return response
}

// Redirige conservando las cookies de sesión recién refrescadas
function redirigir(request: NextRequest, response: NextResponse, destino: string) {
  const url = request.nextUrl.clone()
  url.pathname = destino
  url.search = ''
  const redireccion = NextResponse.redirect(url)
  response.cookies.getAll().forEach((c) => redireccion.cookies.set(c))
  return redireccion
}

export const config = {
  // Todas las rutas excepto archivos estáticos e imágenes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}