// Gabinetes (ECG, prueba de esfuerzo, EEG, potenciales evocados, EMG): agenda por equipo e informe en PDF

export const ESTADO_CITA: Record<string, { texto: string; color: string }> = {
  programada: { texto: 'Programada', color: 'bg-sky-100 text-sky-900' },
  realizada: { texto: 'Realizada', color: 'bg-emerald-100 text-emerald-900' },
  cancelada: { texto: 'Cancelada', color: 'bg-slate-100 text-slate-500 line-through' },
  no_asistio: { texto: 'No asistió', color: 'bg-amber-100 text-amber-900' },
}

export type Cita = {
  id: string
  paciente_id: string
  encuentro_id: string | null
  orden_id: string | null
  inicio: string
  fin: string
  estado: string
  solicitante: string | null
  notas: string | null
  motivo_cancelacion: string | null
  resultado_id: string | null
  realizado_en: string | null
  estudio_clave: string
  estudio: string
  indicaciones: string | null
  equipo: string
  equipo_nombre: string
  area_id: number
  gabinete: string
  gabinete_nombre: string
  paciente: string
  expediente: string
  telefono: string | null
  correo: string | null
  realizado_por_nombre: string | null
}

export type Equipo = { id: number; clave: string; nombre: string; area_id: number; tipo: string }
export type Estudio = { clave: string; nombre: string; tipo_equipo: string; duracion_min: number; indicaciones: string | null }
export type Gabinete = { id: number; clave: string; nombre: string }

// Chihuahua no tiene horario de verano: UTC−6 todo el año
export const ZONA_GAB = '-06:00'
export const inicioDia = (fecha: string) => `${fecha}T00:00:00${ZONA_GAB}`

export const hora = (valor: string) =>
  new Date(valor).toLocaleTimeString('es-MX', { timeZone: 'America/Chihuahua', hour: '2-digit', minute: '2-digit', hour12: false })
