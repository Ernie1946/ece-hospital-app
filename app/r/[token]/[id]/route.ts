import { cookies } from 'next/headers'
import { crearClienteServidor } from '@/lib/supabase/server'
import { deHex } from '@/lib/resultados'

// PDF para el paciente (requiere haber abierto el enlace con su fecha de nacimiento)
export async function GET(req: Request, ctx: RouteContext<'/r/[token]/[id]'>) {
  const { token, id } = await ctx.params
  const sesion = (await cookies()).get('resultados_sesion')?.value
  if (!sesion) return Response.redirect(new URL(`/r/${token}`, req.url), 303)
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('descargar_de_entrega', { p_token: token, p_sesion: sesion, p_resultado: id })
  const fila = (data as { nombre: string; ruta: string | null; tipo_mime: string; contenido: string | null }[] | null)?.[0]
  if (error || !fila) return new Response(error?.message ?? 'No encontrado', { status: 403 })
  if (fila.ruta) {
    const { data: firmado, error: e2 } = await supabase.storage.from('resultados').createSignedUrl(fila.ruta, 60)
    if (e2 || !firmado) return new Response('No se pudo abrir el archivo. Intente de nuevo.', { status: 403 })
    return Response.redirect(firmado.signedUrl, 302)
  }
  return new Response(new Uint8Array(deHex(fila.contenido ?? '')), {
    headers: {
      'Content-Type': fila.tipo_mime,
      'Content-Disposition': `inline; filename="${encodeURIComponent(fila.nombre)}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
