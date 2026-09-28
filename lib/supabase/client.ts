import { createBrowserClient } from '@supabase/ssr'

// Cliente para componentes que corren en el navegador
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}