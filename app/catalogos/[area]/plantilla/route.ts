import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { crearXlsx } from '@/lib/xlsx'
import { COLUMNAS, TIPOS_ARTICULO, type Articulo } from '@/lib/catalogos'

// Excel con el catálogo actual del área (sirve de plantilla: se corrige y se vuelve a subir)
export async function GET(_req: Request, ctx: RouteContext<'/catalogos/[area]/plantilla'>) {
  const { perfil } = await obtenerPerfil()
  if (!perfil) return new Response('Sin sesión', { status: 401 })
  const { area } = await ctx.params
  const supabase = await crearClienteServidor()
  const { data: a } = await supabase.schema('catalogo').from('area_cargo').select('id, clave, nombre').eq('clave', area.toUpperCase()).maybeSingle()
  if (!a) return new Response('Área inexistente', { status: 404 })
  const filas: Articulo[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase
      .schema('catalogo')
      .from('v_articulo')
      .select('clave, descripcion, codigo_barras, unidad, tipo, precio, precio_propuesto, iva, clave_sat, unidad_sat, requiere_lote, activo')
      .eq('area_cargo_id', a.id)
      .order('descripcion')
      .range(desde, desde + 999)
    filas.push(...((data ?? []) as Articulo[]))
    if (!data || data.length < 1000) break
  }
  const archivo = crearXlsx([
    {
      nombre: 'Artículos',
      columnas: COLUMNAS.map((c) => ({ titulo: c.titulo, ancho: c.ancho })),
      filas: filas.map((f) => [
        f.clave, f.descripcion, f.codigo_barras ?? '', f.unidad, f.tipo, f.precio_propuesto ?? f.precio ?? null,
        f.iva, f.clave_sat ?? '', f.unidad_sat ?? '', f.requiere_lote ? 'Sí' : 'No', f.activo ? 'Sí' : 'No',
      ]),
    },
    {
      nombre: 'Instrucciones',
      columnas: [{ titulo: 'Columna', ancho: 18 }, { titulo: 'Qué poner', ancho: 90 }],
      filas: [
        ...COLUMNAS.map((c) => [c.titulo, c.nota]),
        ['', ''],
        ['Tipos', TIPOS_ARTICULO.map(([v, t]) => `${v} (${t})`).join(', ')],
        ['Importante', 'No cambies los títulos de la primera fila. Los artículos que no estén en el archivo no se modifican.'],
        ['Precios', 'Un precio nuevo o distinto queda como propuesta hasta que Costos lo autoriza; mientras, se cobra el precio vigente.'],
      ],
    },
  ])
  return new Response(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="catalogo-${a.clave.toLowerCase()}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
