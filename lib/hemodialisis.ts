// Unidad de hemodiálisis: catálogos y textos

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['', 'L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']

export const ESTADO_SESION: Record<string, { texto: string; color: string }> = {
  programada: { texto: 'Programada', color: 'bg-sky-100 text-sky-900' },
  en_curso: { texto: 'En curso', color: 'bg-emerald-100 text-emerald-900' },
  terminada: { texto: 'Terminada', color: 'bg-slate-200 text-slate-700' },
  cancelada: { texto: 'Cancelada', color: 'bg-slate-100 text-slate-500 line-through' },
  no_asistio: { texto: 'No asistió', color: 'bg-amber-100 text-amber-900' },
}

export const ACCESOS: Record<string, string> = {
  fav: 'Fístula arteriovenosa',
  injerto: 'Injerto arteriovenoso',
  cateter_tunelizado: 'Catéter tunelizado',
  cateter_temporal: 'Catéter temporal',
}

export const SEROLOGIA: Record<string, string> = { negativo: 'Negativo', positivo: 'Positivo', pendiente: 'Pendiente' }

export const COMPLICACIONES = [
  'Hipotensión',
  'Calambres',
  'Náusea o vómito',
  'Cefalea',
  'Dolor torácico',
  'Prurito',
  'Fiebre o escalofríos',
  'Coagulación del circuito',
  'Problema del acceso vascular',
  'Arritmia',
]

export type HdPaciente = {
  paciente_id: string
  tipo: 'cronico' | 'agudo'
  activo: boolean
  peso_seco: number | null
  acceso_tipo: string | null
  acceso_sitio: string | null
  acceso_fecha: string | null
  hbsag: string
  vhc: string
  vih: string
  otra_infeccion: string | null
  serologia_fecha: string | null
  prescripcion: Record<string, string | number>
  prescrita_en: string | null
  motivo_baja: string | null
  notas: string | null
}

export const requiereAislado = (h: Pick<HdPaciente, 'hbsag' | 'vhc' | 'vih' | 'otra_infeccion'>) =>
  [h.hbsag, h.vhc, h.vih].some((x) => x !== 'negativo') || !!h.otra_infeccion?.trim()

// Serología de más de 6 meses: hay que repetirla
export function serologiaVencida(fecha: string | null) {
  if (!fecha) return true
  const [a, m, d] = fecha.split('-').map(Number)
  return Date.now() - Date.UTC(a, m - 1, d) > 182 * 86400000
}

export function lunesDe(fecha: string) {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  const dia = f.getUTCDay() || 7
  f.setUTCDate(f.getUTCDate() - (dia - 1))
  return f.toISOString().slice(0, 10)
}

export const hoyChihuahua = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })
