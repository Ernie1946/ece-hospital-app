// Áreas físicas del hospital (catalogo.area) y tipos de lugar

export type Area = {
  id: number
  clave: string
  nombre: string
  tipo: 'hospitalizacion' | 'neonatal' | 'critico' | 'urgencias' | 'procedimientos'
  censable: boolean
  padre_id: number | null
  orden: number
}

export const TIPO_LUGAR: Record<string, { nombre: string; icono: string }> = {
  cama: { nombre: 'Cama', icono: '🛏' },
  cuna: { nombre: 'Cuna', icono: '👶' },
  incubadora: { nombre: 'Incubadora', icono: '🍼' },
  cubiculo: { nombre: 'Cubículo', icono: '▭' },
  camilla: { nombre: 'Camilla', icono: '⎯' },
  sillon: { nombre: 'Sillón', icono: '💺' },
}

export const TIPO_AREA: Record<string, string> = {
  hospitalizacion: 'Hospitalización',
  neonatal: 'Neonatal',
  critico: 'Cuidados críticos',
  urgencias: 'Urgencias',
  procedimientos: 'Procedimientos',
}

// Claves del área y de todas sus subáreas
export function conSubareas(areas: Area[], id: number): string[] {
  const salida: string[] = []
  const visitar = (x: number) => {
    const a = areas.find((y) => y.id === x)
    if (!a) return
    salida.push(a.clave)
    areas.filter((y) => y.padre_id === x).forEach((h) => visitar(h.id))
  }
  visitar(id)
  return salida
}

// Áreas en orden de menú: cada principal seguida de sus subáreas
export function ordenarAreas(areas: Area[]) {
  const raiz = areas.filter((a) => !a.padre_id || !areas.some((p) => p.id === a.padre_id)).sort((a, b) => a.orden - b.orden)
  return raiz.flatMap((r) => [r, ...areas.filter((h) => h.padre_id === r.id).sort((a, b) => a.orden - b.orden)])
}
