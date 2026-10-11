// Resultados de laboratorio, imagenología y gabinete (PDF) y su entrega a pacientes externos

export const TIPO_RESULTADO: Record<string, string> = {
  laboratorio: 'Laboratorio',
  imagenologia: 'Imagenología',
  gabinete: 'Gabinete',
}

export const ROLES_RESULTADOS = ['laboratorio', 'imagenologia', 'admision', 'archivo']
export const puedeSubir = (rol: string) => rol === 'laboratorio' || rol === 'imagenologia'
export const tiposDeRol = (rol: string) => (rol === 'laboratorio' ? ['laboratorio'] : rol === 'imagenologia' ? ['imagenologia', 'gabinete'] : [])

export type Resultado = {
  id: string
  paciente_id: string
  encuentro_id: string | null
  tipo: string
  estudio: string
  folio_externo: string | null
  realizado_en: string
  critico: boolean
  nota_critica: string | null
  archivo_nombre: string
  archivo_tamano: number
  subido_en: string
  visto_en: string | null
  visto_por_nombre: string | null
  anulado: boolean
  motivo_anulacion: string | null
  paciente: string
  expediente: string
  subido_por_nombre: string
  entregado_en: string | null
}

export const COLUMNAS_RESULTADO =
  'id, paciente_id, encuentro_id, tipo, estudio, folio_externo, realizado_en, critico, nota_critica, archivo_nombre, archivo_tamano, subido_en, visto_en, visto_por_nombre, anulado, motivo_anulacion, paciente, expediente, subido_por_nombre, entregado_en'

// bytea de PostgREST ("\x2550…") ⇄ Buffer
export const deHex = (s: string) => Buffer.from(s.startsWith('\\x') ? s.slice(2) : s, 'hex')
export const aHex = (b: ArrayBuffer) => '\\x' + Buffer.from(b).toString('hex')

export const tamano = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

// Celular a formato internacional para WhatsApp (México: 52 + 10 dígitos)
export function celularWhatsApp(t: string) {
  const d = t.replace(/\D/g, '')
  if (d.length === 10) return '52' + d
  if (d.length === 12 && d.startsWith('52')) return d
  if (d.length === 13 && d.startsWith('521')) return '52' + d.slice(3)
  return d
}

export function mensajeEntrega(nombre: string, estudios: string, enlace: string, vence: string) {
  return (
    `Hola ${nombre}. Sus resultados (${estudios}) están listos.\n` +
    `Consúltelos aquí: ${enlace}\n` +
    `Para abrirlos se le pedirá su fecha de nacimiento. El enlace vence el ${vence}.\n` +
    `Si usted no solicitó este mensaje, ignórelo.`
  )
}
