import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente para páginas y acciones que corren en el servidor
export async function crearClienteServidor() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // En páginas del servidor no se pueden escribir cookies;
            // la sesión se refresca en el archivo proxy.ts (siguiente paso).
          }
        },
      },
    }
  )
}