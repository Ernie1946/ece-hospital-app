'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado as R } from '@/components/FormAccion'

// Las reglas (rol, PDF, tamaño, consentimiento, fecha de nacimiento) las aplica la base

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase
}
const texto = (d: FormData, c: string) => {
  const v = d.get(c)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export async function registrarExterno(_previo: R, datos: FormData): Promise<R> {
  const supabase = await sesion()
  const { data, error } = await supabase.schema('clinico').rpc('registrar_paciente_externo', {
    p_nombre: texto(datos, 'nombre'),
    p_primer_apellido: texto(datos, 'primer_apellido'),
    p_segundo_apellido: texto(datos, 'segundo_apellido'),
    p_sexo: texto(datos, 'sexo'),
    p_fecha_nacimiento: texto(datos, 'fecha_nacimiento'),
    p_telefono: texto(datos, 'telefono'),
    p_correo: texto(datos, 'correo'),
  })
  if (error) return { error: traducirError(error.message) }
  redirect(`/resultados/paciente/${data}`)
}

export async function subirResultado(pacienteId: string, _previo: R, datos: FormData): Promise<R> {
  const archivo = datos.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) return { error: 'Elige el archivo PDF del resultado.' }
  if (archivo.size > 5 * 1024 * 1024) return { error: 'El PDF no debe pasar de 5 MB.' }
  const bytes = await archivo.arrayBuffer()
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== '%PDF') return { error: 'El archivo debe ser PDF.' }
  const supabase = await sesion()
  // 1) El PDF va al almacenamiento de archivos (bucket privado "resultados"), en la carpeta del paciente
  const ruta = `${pacienteId}/${crypto.randomUUID()}.pdf`
  const { error: eArchivo } = await supabase.storage
    .from('resultados')
    .upload(ruta, bytes, { contentType: 'application/pdf', upsert: false })
  if (eArchivo) {
    const m = eArchivo.message ?? ''
    return {
      error: /mime|pdf/i.test(m)
        ? 'El archivo debe ser PDF.'
        : /size|large|exceed/i.test(m)
          ? 'El PDF no debe pasar de 5 MB.'
          : /security|policy|unauthorized/i.test(m)
            ? 'Tu rol no puede subir resultados.'
            : `No se pudo guardar el archivo: ${m}`,
    }
  }
  // 2) La base registra el resultado y lo liga al paciente (y a la orden)
  const { error } = await supabase.schema('clinico').rpc('registrar_resultado', {
    p_paciente: pacienteId,
    p_tipo: texto(datos, 'tipo'),
    p_estudio: texto(datos, 'estudio'),
    p_folio: texto(datos, 'folio'),
    p_realizado_en: texto(datos, 'realizado_en'),
    p_critico: datos.get('critico') === 'on',
    p_nota_critica: texto(datos, 'nota_critica'),
    p_orden: texto(datos, 'orden'),
    p_archivo_nombre: archivo.name,
    p_ruta: ruta,
  })
  if (error) {
    await supabase.storage.from('resultados').remove([ruta])
    return { error: traducirError(error.message) }
  }
  revalidatePath(`/resultados/paciente/${pacienteId}`)
  revalidatePath('/resultados')
  return { ok: `Resultado "${texto(datos, 'estudio')}" guardado${datos.get('critico') === 'on' ? ' y marcado como CRÍTICO: avise al médico' : ''}.` }
}

export async function anularResultado(id: string, pacienteId: string, _previo: R, datos: FormData): Promise<R> {
  const supabase = await sesion()
  const { error } = await supabase.schema('clinico').rpc('anular_resultado', { p_resultado: id, p_motivo: texto(datos, 'motivo') })
  if (error) return { error: traducirError(error.message) }
  revalidatePath(`/resultados/paciente/${pacienteId}`)
  return { ok: 'Resultado anulado.' }
}

export type ResultadoEntrega = { error?: string; token?: string; vence?: string }

export async function crearEntrega(
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
  revalidatePath(`/resultados/paciente/${pacienteId}`)
  const vence = new Date(Date.now() + dias * 86400000).toLocaleDateString('es-MX', { timeZone: 'America/Chihuahua' })
  return { token: data as string, vence }
}

export async function revocarEntrega(id: string, pacienteId: string): Promise<R> {
  const supabase = await sesion()
  const { error } = await supabase.schema('clinico').rpc('revocar_entrega', { p_entrega: id })
  if (error) return { error: traducirError(error.message) }
  revalidatePath(`/resultados/paciente/${pacienteId}`)
  return { ok: 'Enlace cancelado: ya no abre.' }
}
