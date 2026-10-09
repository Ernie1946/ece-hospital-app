import { crearClienteServidor } from '@/lib/supabase/server'

// Áreas y servicios para los formularios de Personal
export async function opcionesPersonal() {
  const supabase = await crearClienteServidor()
  const [areas, servicios] = await Promise.all([
    supabase.schema('catalogo').from('area').select('clave, nombre, padre_id').eq('activo', true).order('orden'),
    supabase.schema('catalogo').from('servicio').select('clave, nombre').order('nombre'),
  ])
  return {
    areas: (areas.data ?? []).map((a) => ({ clave: a.clave as string, nombre: `${a.padre_id ? '· ' : ''}${a.nombre}` })),
    servicios: (servicios.data ?? []).map((s) => ({ clave: s.clave as string, nombre: s.nombre as string })),
  }
}
