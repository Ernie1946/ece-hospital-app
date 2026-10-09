// Turnos de enfermería y asignación de camas

export type Turno = { id: number; clave: string; nombre: string; inicio: string; fin: string }
export type TurnoActual = { fecha: string; turno_id: number; clave: string; nombre: string; desde: string; hasta: string }
export type AsignacionFila = { cama: string; area: string; area_nombre: string; enfermera_id: string; enfermera: string }

// Suma días a una fecha "YYYY-MM-DD" sin corrimientos de zona
export function sumarDias(fecha: string, dias: number) {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export function fechaLarga(fecha: string) {
  const [a, m, d] = fecha.split('-').map(Number)
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}
