// Nombre legible de cada rol del hospital (en la base se guardan sin acentos)
export const ETIQUETA_ROL: Record<string, string> = {
  medico_tratante: 'Médico tratante',
  medico_residente: 'Médico residente',
  anestesiologo: 'Anestesiólogo',
  enfermeria: 'Enfermería',
  farmacia: 'Farmacia',
  laboratorio: 'Laboratorio',
  banco_sangre: 'Banco de sangre',
  nutricion: 'Nutrición',
  trabajo_social: 'Trabajo social',
  admision: 'Admisión',
  caja: 'Caja',
  almacen: 'Almacén',
  mantenimiento: 'Mantenimiento',
  comedor: 'Comedor',
  archivo: 'Archivo clínico',
  auditor: 'Auditoría',
  admin_sistema: 'Administración del sistema',
}

export function etiquetaRol(rol: string) {
  return ETIQUETA_ROL[rol] ?? rol
}
