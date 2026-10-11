'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { ZONA_GAB } from '@/lib/gabinetes'
import type { Resultado } from '@/components/FormAccion'
import type { ResultadoEntrega } from '@/app/resultados/acciones'

// Gabinetes: las reglas (quién programa, equipo correcto, traslapes, PDF) las aplica la base

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase
}
const t = (d: FormData, c: string) => {
  const v = d.get(c)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
const refrescar = () => revalidatePath('/gabinetes', 'layout')

export async function registrarExternoGab(gabinete: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('clinico').rpc('registrar_paciente_externo', {
    p_nombre: t(d, 'nombre'),
    p_primer_apellido: t(d, 'primer_apellido'),
    p_segundo_apellido: t(d, 'segundo_apellido'),
    p_sexo: t(d, 'sexo'),
    p_fecha_nacimiento: t(d, 'fecha_nacimiento'),
    p_telefono: t(d, 'telefono'),
    p_correo: t(d, 'correo'),
  })
  if (error) return { error: traducirError(error.message) }
  redirect(`/gabinetes/agendar?paciente=${data}&g=${encodeURIComponent(gabinete)}`)
}

export async function programarCita(pacienteId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const fecha = t(d, 'fecha')
  const hora = t(d, 'hora')
  if (!fecha || !hora) return { error: 'Elige la fecha y la hora.' }
  const supabase = await sesion()
  const { data, error } = await supabase.schema('clinico').rpc('gab_programar', {
    p_paciente: pacienteId,
    p_estudio: t(d, 'estudio'),
    p_equipo: t(d, 'equipo'),
    p_inicio: `${fecha}T${hora}:00${ZONA_GAB}`,
    p_orden: t(d, 'orden'),
    p_solicitante: t(d, 'solicitante'),
    p_notas: t(d, 'notas'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  redirect(`/gabinetes/cita/${data}`)
}

export async function marcarRealizada(citaId: string): Promise<Resultado> {
  const supabase = await sesion()
  const { error } = await supabase.schema('clinico').rpc('gab_realizar', { p_cita: citaId })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Estudio marcado como realizado. Sube el informe cuando lo tengas.' }
}

export async function cancelarCita(citaId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const { error } = await supabase
    .schema('clinico')
    .rpc('gab_cancelar', { p_cita: citaId, p_motivo: t(d, 'motivo'), p_no_asistio: d.get('no_asistio') === 'si' })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: d.get('no_asistio') === 'si' ? 'Registrado: el paciente no asistió.' : 'Cita cancelada.' }
}

export async function subirInforme(citaId: string, pacienteId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const archivo = d.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) return { error: 'Elige el PDF del informe.' }
  if (archivo.size > 5 * 1024 * 1024) return { error: 'El PDF no debe pasar de 5 MB.' }
  const bytes = await archivo.arrayBuffer()
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== '%PDF') return { error: 'El archivo debe ser PDF.' }
  const supabase = await sesion()
  // 1) El PDF al almacenamiento privado "resultados", en la carpeta del paciente
  const ruta = `${pacienteId}/${crypto.randomUUID()}.pdf`
  const { error: eArchivo } = await supabase.storage.from('resultados').upload(ruta, bytes, { contentType: 'application/pdf', upsert: false })
  if (eArchivo) {
    const m = eArchivo.message ?? ''
    return {
      error: /size|large|exceed/i.test(m)
        ? 'El PDF no debe pasar de 5 MB.'
        : /security|policy|unauthorized/i.test(m)
          ? 'Tu usuario no puede subir informes.'
          : `No se pudo guardar el archivo: ${m}`,
    }
  }
  // 2) La base crea el resultado (tipo gabinete), cierra la cita y la orden
  const critico = d.get('critico') === 'on'
  const { error } = await supabase.schema('clinico').rpc('gab_registrar_informe', {
    p_cita: citaId,
    p_archivo_nombre: archivo.name,
    p_ruta: ruta,
    p_critico: critico,
    p_nota_critica: t(d, 'nota_critica'),
  })
  if (error) {
    await supabase.storage.from('resultados').remove([ruta])
    return { error: traducirError(error.message) }
  }
  refrescar()
  return { ok: `Informe guardado${critico ? ' y marcado como CRÍTICO: avise al médico' : ''}.` }
}

export async function anularInforme(resultadoId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const supabase = await sesion()
  const { error } = await supabase.schema('clinico').rpc('anular_resultado', { p_resultado: resultadoId, p_motivo: t(d, 'motivo') })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Informe anulado. Ya puedes subir el correcto.' }
}

export async function enviarInforme(
  pacienteId: string,
  resultados: string[],
  canal: string,
  destino: string,
  consentimiento: boolean,
  dias: number
): Promise<ResultadoEntrega> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('clinico').rpc('crear_entrega', {
    p_paciente: pacienteId,
    p_resultados: resultados,
    p_canal: canal,
    p_destino: destino,
    p_consentimiento: consentimiento,
    p_dias: dias,
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  const vence = new Date(Date.now() + dias * 86400000).toLocaleDateString('es-MX', { timeZone: 'America/Chihuahua' })
  return { token: data as string, vence }
}
