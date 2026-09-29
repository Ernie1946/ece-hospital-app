// Convierte errores de la base en mensajes claros para el personal.
// Los errores de las reglas del hospital ya vienen en español desde la base.
export function traducirError(mensaje: string): string {
  if (mensaje.includes('paciente_curp_check')) return 'La CURP no tiene un formato válido (18 caracteres, en mayúsculas).'
  if (mensaje.includes('paciente_curp_key')) return 'Ya existe un paciente registrado con esa CURP.'
  if (mensaje.includes('fecha_nacimiento')) return 'La fecha de nacimiento no puede ser futura.'
  if (mensaje.includes('poliza_aseguradora_id_numero_poliza_paciente_id_key')) return 'Esa póliza ya está registrada para este paciente.'
  if (mensaje.includes('row-level security')) return 'No tienes acceso a este paciente: no es de tu servicio.'
  if (mensaje.includes('signos_vitales_check')) return 'La presión sistólica debe ser mayor que la diastólica.'
  if (mensaje.includes('signos_vitales_') && mensaje.includes('_check')) return 'Algún signo vital está fuera del rango posible. Revisa los valores.'
  if (mensaje.includes('permission denied')) return 'Tu rol no tiene permiso para esta acción.'
  if (mensaje.includes('no puede realizar esta acción')) {
    const rol = mensaje.match(/El rol (\S+)/)?.[1]
    return `Tu rol${rol ? ` (${rol.replaceAll('_', ' ')})` : ''} no puede realizar esta acción.`
  }
  return mensaje
}
