import { crearClienteServidor } from '@/lib/supabase/server'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { plantillaPrivilegios, type FilaCatalogo } from '@/lib/plantillaPrivilegios'

// Descarga de la plantilla de privilegios con el catálogo vigente (solo Sistemas)
export async function GET() {
  const { perfil } = await obtenerPerfil()
  if (!perfil || !esSistemas(perfil)) return new Response('Solo Sistemas', { status: 403 })
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('catalogo')
    .from('privilegio')
    .select('clave, nombre, grupo, cie9_rangos, descripcion')
    .eq('activo', true)
    .order('grupo')
    .order('orden')
  const orden = ['unidad', 'hemodinamia', 'quirurgico', 'anestesia']
  const catalogo = ((data ?? []) as FilaCatalogo[]).sort((a, b) => orden.indexOf(a.grupo) - orden.indexOf(b.grupo))
  const archivo = plantillaPrivilegios(catalogo)
  return new Response(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-privilegios.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  })
}
