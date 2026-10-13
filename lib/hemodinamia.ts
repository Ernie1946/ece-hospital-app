// Hemodinamia (sala de cateterismo): catálogos, textos y tipos

export const ESTADO_CASO: Record<string, { texto: string; color: string }> = {
  programado: { texto: 'Programado', color: 'bg-sky-100 text-sky-900' },
  en_sala: { texto: 'En sala', color: 'bg-red-100 text-red-900' },
  recuperacion: { texto: 'En recuperación', color: 'bg-amber-100 text-amber-900' },
  terminado: { texto: 'Terminado', color: 'bg-emerald-100 text-emerald-900' },
  cancelado: { texto: 'Cancelado', color: 'bg-slate-100 text-slate-500 line-through' },
}

export const CATEGORIA: Record<string, string> = {
  coronario: 'Coronarios',
  periferico: 'Periféricos',
  neuro: 'Neurointervención',
  electrofisiologia: 'Marcapasos y electrofisiología',
  otro: 'Otros intervencionistas',
}

export const VERIFICACION: { clave: string; texto: string; obligatorio: boolean }[] = [
  { clave: 'identificacion', texto: 'Identificación del paciente (nombre y fecha de nacimiento, pulsera)', obligatorio: true },
  { clave: 'consentimiento', texto: 'Consentimiento informado firmado', obligatorio: true },
  { clave: 'alergias', texto: 'Alergias revisadas (yodo / contraste, látex, medicamentos)', obligatorio: true },
  { clave: 'ayuno', texto: 'Ayuno (no obligatorio en urgencias)', obligatorio: true },
  { clave: 'funcion_renal', texto: 'Función renal revisada (creatinina)', obligatorio: true },
  { clave: 'acceso_venoso', texto: 'Acceso venoso permeable', obligatorio: true },
  { clave: 'anticoagulacion', texto: 'Anticoagulantes / antiagregantes revisados', obligatorio: false },
  { clave: 'pulsos', texto: 'Pulsos distales basales registrados', obligatorio: false },
]

export const ACCESOS: Record<string, string> = {
  radial_derecha: 'Radial derecha',
  radial_izquierda: 'Radial izquierda',
  femoral_derecha: 'Femoral derecha',
  femoral_izquierda: 'Femoral izquierda',
  braquial: 'Braquial',
  venosa_femoral: 'Venosa femoral',
  yugular: 'Yugular interna',
  subclavia: 'Subclavia / cefálica',
  otro: 'Otro',
}

export const SEDACION: Record<string, string> = {
  local: 'Anestesia local',
  sedacion: 'Sedación',
  general: 'Anestesia general',
}

export const CIERRE: Record<string, string> = {
  banda_radial: 'Banda de compresión radial',
  compresion_manual: 'Compresión manual',
  dispositivo: 'Dispositivo de cierre vascular',
  sutura: 'Sutura (bolsa de generador)',
  introductor_in_situ: 'Introductor en su lugar (se retira en recuperación)',
}

export const COMPLICACIONES = [
  'Ninguna',
  'Hematoma en sitio de punción',
  'Sangrado',
  'Disección',
  'Perforación / taponamiento',
  'Arritmia',
  'Hipotensión',
  'Reacción al contraste',
  'Trombosis / embolia',
  'Evento vascular cerebral',
  'Paro cardiorrespiratorio',
]

export const TIPO_MATERIAL: Record<string, string> = {
  stent: 'Stent',
  balon: 'Balón',
  guia: 'Guía',
  cateter: 'Catéter',
  introductor: 'Introductor',
  marcapasos: 'Generador de marcapasos',
  electrodo: 'Electrodo',
  desfibrilador: 'Desfibrilador (DAI)',
  dispositivo_cierre: 'Dispositivo de cierre',
  coil: 'Coil',
  filtro: 'Filtro',
  otro: 'Otro',
}
export const IMPLANTES = ['stent', 'marcapasos', 'electrodo', 'desfibrilador', 'coil', 'filtro']

export const PAPEL: Record<string, string> = {
  hemodinamista: 'Hemodinamista',
  ayudante: 'Ayudante / residente',
  enfermeria: 'Enfermera instrumentista',
  circulante: 'Enfermera circulante',
  tecnico: 'Técnico radiólogo',
  anestesiologo: 'Anestesiólogo',
}
// Papeles posibles según el tipo de personal
export const PAPELES_DE: Record<string, string[]> = {
  medico: ['hemodinamista', 'ayudante'],
  enfermeria: ['enfermeria', 'circulante'],
  tecnico: ['tecnico'],
  anestesiologo: ['anestesiologo'],
}

export const SITIO: Record<string, string> = { sin_sangrado: 'Sin sangrado', hematoma: 'Hematoma', sangrado: 'Sangrado' }
export const PULSO: Record<string, string> = { presente: 'Presente', disminuido: 'Disminuido', ausente: 'Ausente' }
export const EVENTO: Record<string, string> = { control: 'Control', retiro_introductor: 'Retiro del introductor', compresion: 'Compresión' }
export const DESTINOS = ['Habitación / piso', 'Corta estancia', 'Terapia intensiva', 'Unidad coronaria', 'Domicilio']

// Umbrales de seguridad
export const KERMA_SEGUIMIENTO = 5000 // mGy en el punto de referencia: seguimiento de piel
export const FLUORO_ALERTA = 60 // minutos

export type Caso = {
  id: string
  paciente_id: string
  encuentro_id: string | null
  orden_id: string | null
  procedimiento_detalle: string | null
  prioridad: string
  inicio: string
  fin: string
  estado: string
  indicacion: string | null
  hemodinamista_id: string | null
  requiere_anestesia: boolean
  notas: string | null
  verificacion: Record<string, boolean | string | null>
  verificado_en: string | null
  peso_kg: number | null
  creatinina: number | null
  en_sala_en: string | null
  inicio_proc_en: string | null
  fin_proc_en: string | null
  salida_sala_en: string | null
  datos: {
    acceso?: string | null
    introductor_fr?: string | null
    sedacion?: string | null
    heparina_ui?: string | null
    hallazgos?: string | null
    procedimiento_realizado?: string | null
    resultado?: string | null
    complicaciones?: string[]
    complicaciones_nota?: string | null
    cierre?: string | null
    plan?: string | null
    introductor_retirado_en_sala?: boolean
  }
  contraste_tipo: string | null
  contraste_ml: number | null
  fluoro_min: number | null
  kerma_mgy: number | null
  dap: number | null
  firmado_por: string | null
  firmado_en: string | null
  destino: string | null
  terminado_en: string | null
  motivo_cancelacion: string | null
  procedimiento_clave: string
  procedimiento: string
  categoria: string
  paciente: string
  expediente: string
  sexo: string
  fecha_nacimiento: string | null
  hemodinamista_nombre: string | null
  firmado_por_nombre: string | null
  alergias: string | null
  alergia_contraste: boolean
  contraste_max_ml: number | null
}

export type Participante = { caso_id: string; usuario_id: string; papel: string; nombre: string; cedula_profesional: string | null }
export type Material = {
  id: string
  tipo: string
  descripcion: string
  marca: string | null
  medida: string | null
  lote: string | null
  serie: string | null
  cantidad: number
  implante: boolean
  sitio: string | null
  anulado: boolean
  motivo_anulacion: string | null
  registrado_en: string
}
export type Vigilancia = {
  id: string
  hora: string
  evento: string
  ta_sis: number | null
  ta_dia: number | null
  fc: number | null
  spo2: number | null
  eva: number | null
  sitio: string | null
  pulso: string | null
  nota: string | null
  registrado_por_nombre: string
}

export const nombreProc = (c: Pick<Caso, 'procedimiento' | 'procedimiento_detalle' | 'procedimiento_clave'>) =>
  c.procedimiento_clave === 'OTRO' && c.procedimiento_detalle ? c.procedimiento_detalle : c.procedimiento + (c.procedimiento_detalle ? ` · ${c.procedimiento_detalle}` : '')

// Vigilancia sugerida tras el cateterismo según el tiempo desde la salida de sala
export function siguienteControl(salida: string | null, ultimo: string | null) {
  if (!salida) return null
  const min = (Date.now() - new Date(salida).getTime()) / 60000
  const cada = min < 60 ? 15 : min < 180 ? 30 : 60
  const base = ultimo ? new Date(ultimo).getTime() : new Date(salida).getTime()
  return { cada, vence: new Date(base + cada * 60000) }
}
