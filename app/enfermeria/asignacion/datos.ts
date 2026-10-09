import { crearClienteServidor } from '@/lib/supabase/server'
import { conSubareas, ordenarAreas, type Area } from '@/lib/areas'
import type { AsignacionFila, Turno, TurnoActual } from '@/lib/turnos'

// Datos comunes de la pantalla de asignación y del rol impreso
export async function datosAsignacion(sp: Record<string, string | string[] | undefined>, areaBase: number | null) {
  const supabase = await crearClienteServidor()
  const [{ data: turnosData }, { data: actualData }, { data: areasData }] = await Promise.all([
    supabase.schema('catalogo').from('turno').select('id, clave, nombre, inicio, fin').eq('activo', true).order('orden'),
    supabase.schema('catalogo').rpc('turno_actual'),
    supabase.schema('catalogo').from('area').select('id, clave, nombre, tipo, censable, padre_id, orden').eq('activo', true),
  ])
  const turnos = (turnosData ?? []) as Turno[]
  const actual = ((actualData ?? []) as TurnoActual[])[0] ?? null
  const fecha = typeof sp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : (actual?.fecha ?? new Date().toISOString().slice(0, 10))
  const turno = turnos.find((t) => t.clave === sp.turno) ?? turnos.find((t) => t.clave === actual?.clave) ?? turnos[0]

  const todas = ordenarAreas((areasData ?? []) as Area[])
  const principales = todas.filter((a) => !a.padre_id)
  const pedida = typeof sp.area === 'string' ? sp.area : null
  const base = todas.find((a) => a.id === areaBase)
  const area =
    pedida === 'todas'
      ? null
      : (principales.find((a) => a.clave === pedida) ?? principales.find((a) => a.id === (base?.padre_id ?? base?.id)) ?? principales[0] ?? null)
  const claves = area ? conSubareas(todas, area.id) : todas.map((a) => a.clave)

  const [{ data: censo }, { data: asig }] = await Promise.all([
    supabase
      .schema('camas')
      .from('v_censo')
      .select('cama, area, area_nombre, area_padre_nombre, area_orden, tipo_lugar, estado, paciente')
      .in('area', claves),
    supabase
      .schema('clinico')
      .from('v_asignacion_enfermeria')
      .select('cama, area, area_nombre, enfermera_id, enfermera')
      .eq('fecha', fecha)
      .eq('turno', turno?.clave ?? '')
      .in('area', claves),
  ])
  type Censo = { cama: string; area: string; area_nombre: string; area_padre_nombre: string | null; area_orden: number; tipo_lugar: string; estado: string; paciente: string | null }
  const camas = ((censo ?? []) as Censo[])
    .sort((a, b) => a.area_orden - b.area_orden || a.cama.localeCompare(b.cama, 'es', { numeric: true }))
    .map((c) => ({
      cama: c.cama,
      grupo: c.area_padre_nombre ? `${c.area_padre_nombre} · ${c.area_nombre}` : c.area_nombre,
      estado: c.estado,
      paciente: c.paciente,
      tipo: c.tipo_lugar,
    }))
  const asignaciones: Record<string, { enfermera_id: string; enfermera: string }> = {}
  for (const a of (asig ?? []) as AsignacionFila[]) asignaciones[a.cama] = { enfermera_id: a.enfermera_id, enfermera: a.enfermera }

  return { turnos, actual, fecha, turno, principales, area, camas, asignaciones, todas }
}
