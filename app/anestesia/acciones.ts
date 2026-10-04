'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { EXPLORACION, ESCALAS_VIA_AEREA, INTERROGATORIO, LABORATORIOS } from '@/lib/anestesia'
import type { Resultado } from '@/components/FormAccion'

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return { supabase, usuarioId: data.user.id }
}

function texto(datos: FormData, campo: string) {
  const v = datos.get(campo)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function numero(datos: FormData, campo: string) {
  const v = texto(datos, campo)
  if (v === null) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Chihuahua está en UTC-6 todo el año; el campo datetime-local no trae zona
const fechaHoraChihuahua = (valor: string) => `${valor}:00-06:00`

function refrescar(cirugiaId?: string) {
  revalidatePath('/anestesia')
  if (cirugiaId) revalidatePath(`/anestesia/cirugia/${cirugiaId}`)
}

export async function buscarProcedimientos(consulta: string) {
  if (consulta.trim().length < 2) return []
  const { supabase } = await sesion()
  const { data } = await supabase.schema('catalogo').rpc('buscar_cie9mc', { p_texto: consulta, p_limite: 12 })
  return (data ?? []) as { codigo: string; descripcion: string; tipo: string | null }[]
}

// ---------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------
export async function programarCirugia(_previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const encuentro = texto(datos, 'encuentro')
  const inicio = texto(datos, 'inicio')
  const procedimiento = texto(datos, 'procedimiento')
  const cirujano = texto(datos, 'cirujano')
  const sala = numero(datos, 'sala')
  if (!encuentro || !inicio || !procedimiento || !cirujano || !sala) {
    return { error: 'Faltan datos: paciente, procedimiento, cirujano, sala y fecha.' }
  }
  const { data: id, error } = await supabase.schema('clinico').rpc('programar_cirugia', {
    p_encuentro: encuentro,
    p_procedimiento: procedimiento,
    p_cie9mc: texto(datos, 'cie9mc'),
    p_sala: sala,
    p_inicio: fechaHoraChihuahua(inicio),
    p_duracion_min: numero(datos, 'duracion') ?? 60,
    p_tipo: texto(datos, 'tipo') ?? 'programada',
    p_cirujano: cirujano,
    p_anestesiologo: texto(datos, 'anestesiologo'),
    p_tecnica: texto(datos, 'tecnica'),
    p_observaciones: texto(datos, 'observaciones'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  redirect(`/anestesia?fecha=${inicio.slice(0, 10)}&aviso=programada&cirugia=${id}`)
}

export async function cancelarCirugia(cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const motivo = texto(datos, 'motivo')
  if (!motivo) return { error: 'Indica el motivo de la cancelación.' }
  const { error } = await supabase.schema('clinico').rpc('cancelar_cirugia', { p_cirugia: cirugiaId, p_motivo: motivo })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: 'Cirugía cancelada.' }
}

export async function asignarmeCirugia(cirugiaId: string): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('clinico').rpc('asignarme_cirugia', { p_cirugia: cirugiaId })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: 'Caso asignado a ti.' }
}

// ---------------------------------------------------------------------
// Valoración preanestésica: se guarda y se firma en un paso
// ---------------------------------------------------------------------
export async function registrarValoracion(cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()

  const seccion = (claves: string[], prefijo: string) => {
    const s: Record<string, string> = {}
    for (const k of claves) {
      const v = texto(datos, `${prefijo}${k}`)
      if (v && v !== 'N/E') s[k] = v
    }
    return s
  }

  const contenido = {
    asa: texto(datos, 'asa'),
    asa_urgencia: datos.get('asa_urgencia') === 'on',
    tecnica_anestesica: texto(datos, 'tecnica_anestesica'),
    plan_anestesico: texto(datos, 'plan_anestesico'),
    riesgo: texto(datos, 'riesgo'),
    consentimiento: datos.get('consentimiento') === 'on',
    ficha: {
      ...seccion(['peso_kg', 'talla_cm', 'grupo_sanguineo', 'ultimo_alimento', 'padecimientos', 'medicamentos_actuales', 'antecedentes_anestesicos'], 'ficha_'),
    },
    via_aerea: {
      ...seccion(ESCALAS_VIA_AEREA.map((e) => e.clave), 'va_'),
      ...seccion(['circunferencia_cuello', 'movilidad_cervical'], 'va_'),
    },
    interrogatorio: seccion(INTERROGATORIO.map(([k]) => k), 'io_'),
    exploracion: seccion(['ta', 'fc', 'fr', 'temp', 'spo2', ...EXPLORACION.map(([k]) => k)], 'ex_'),
    laboratorios: seccion(['fecha', ...LABORATORIOS.map(([k]) => k), 'notas', 'imagenologia'], 'lab_'),
  }

  const faltan = [
    !contenido.asa && 'clase ASA',
    !contenido.tecnica_anestesica && 'técnica anestésica',
    !contenido.plan_anestesico && 'plan anestésico',
  ].filter(Boolean)
  if (faltan.length) return { error: `Falta: ${faltan.join(', ')} (pestaña Plan).` }

  const { error } = await supabase
    .schema('clinico')
    .rpc('registrar_valoracion_preanestesica', { p_cirugia: cirugiaId, p_contenido: contenido })
  if (error) return { error: traducirError(error.message) }

  refrescar(cirugiaId)
  return { ok: 'Valoración preanestésica firmada.' }
}
