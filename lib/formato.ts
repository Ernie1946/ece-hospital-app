// Formatos de fecha, edad y nombres, siempre en hora de Chihuahua

const ZONA = 'America/Chihuahua'

export function fecha(valor: string | null | undefined) {
  if (!valor) return '—'
  // Las fechas "YYYY-MM-DD" se muestran tal cual (sin corrimiento de zona)
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-')
    return `${d}/${m}/${a}`
  }
  return new Date(valor).toLocaleDateString('es-MX', { timeZone: ZONA })
}

export function fechaHora(valor: string | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('es-MX', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function edad(fechaNacimiento: string | null | undefined) {
  if (!fechaNacimiento) return null
  const [a, m, d] = fechaNacimiento.split('-').map(Number)
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: ZONA }))
  let anios = hoy.getFullYear() - a
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) anios--
  return anios
}

export function nombreCompleto(p: { nombre: string; primer_apellido: string; segundo_apellido?: string | null }) {
  return [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')
}

export const TIPO_ENCUENTRO: Record<string, string> = {
  urgencias: 'Urgencias',
  hospitalizacion: 'Hospitalización',
  corta_estancia: 'Corta estancia',
  cirugia: 'Cirugía',
  uci: 'UCI',
}

export const ESTADO_ENCUENTRO: Record<string, string> = {
  programado: 'Programado',
  activo: 'Activo',
  alta_medica: 'Alta médica',
  transferido: 'Transferido',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
}

export const SEXO: Record<string, string> = { H: 'Hombre', M: 'Mujer', NE: 'No especificado' }

// Momento actual en milisegundos. Las páginas se generan en cada visita,
// así que "ahora" es la hora de la consulta.
export function ahora() {
  return Date.now()
}
