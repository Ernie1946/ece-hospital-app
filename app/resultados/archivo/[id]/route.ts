import { crearClienteServidor } from '@/lib/supabase/server'
import { deHex } from '@/lib/resultados'

// PDF de un resultado para el personal (la base revisa permisos y registra la lectura).
// Los guardados en el almacenamiento de archivos se abren con un enlace firmado de 60 s.
export async function GET(_req: Request, ctx: RouteContext<'/resultados/archivo/[id]'>) {
  const { id } = await ctx.params
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.schema('clinico').rpc('abrir_resultado', { p_resultado: id })
  const fila = (data as { nombre: string; ruta: string | null; tipo_mime: string; contenido: string | null }[] | null)?.[0]
  if (error || !fila) return new Response(error?.message ?? 'No encontrado', { status: error ? 403 : 404 })
  if (fila.ruta) {
    const { data: firmado, error: e2 } = await supabase.storage.from('resultados').createSignedUrl(fila.ruta, 60)
    if (e2 || !firmado) return new Response('No se pudo abrir el archivo', { status: 403 })
    return Response.redirect(firmado.signedUrl, 302)
  }
  return new Response(new Uint8Array(deHex(fila.contenido ?? '')), {
    headers: {
      'Content-Type': fila.tipo_mime,
      'Content-Disposition': `inline; filename="${encodeURIComponent(fila.nombre)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
