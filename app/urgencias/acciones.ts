'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return { supabase, usuarioId: data.user.id }
}

export type PacienteBusqueda = { id: string; nombre: string; expediente: string; fecha_nacimiento: string | null; sexo: string }
export type Duplicado = { paciente_id: string; expediente: string; nombre_completo: string; fecha_nacimiento: string | null; motivo: string }
export type ResultadoIngreso = { error?: string; duplicados?: Duplicado[]; encuentro?: string; pulsera?: string }

// Búsqueda de pacientes ya registrados (nombre, apellido, expediente o CURP)
export async function buscarPacientes(texto: string): Promise<PacienteBusqueda[]> {
  const palabras = texto.trim().replace(/[%,()]/g, '').split(/\s+/).filter((p) => p.length >= 2)
  if (!palabras.length) return []
  const { supabase } = await sesion()
  let q = supabase.schema('clinico').from('paciente').select('id, nombre, primer_apellido, segundo_apellido, expediente, fecha_nacimiento, sexo, curp')
  for (const p of palabras.slice(0, 3)) {
    q = q.or(`nombre.ilike.%${p}%,primer_apellido.ilike.%${p}%,segundo_apellido.ilike.%${p}%,expediente.ilike.%${p}%,curp.ilike.%${p}%`)
  }
  const { data } = await q.order('primer_apellido').limit(10)
  return ((data ?? []) as { id: string; nombre: string; primer_apellido: string; segundo_apellido: string | null; expediente: string; fecha_nacimiento: string | null; sexo: string }[]).map((r) => ({
    id: r.id,
    nombre: [r.nombre, r.primer_apellido, r.segundo_apellido].filter(Boolean).join(' '),
    expediente: r.expediente,
    fecha_nacimiento: r.fecha_nacimiento,
    sexo: r.sexo,
  }))
}

const texto = (d: FormData, k: string) => {
  const v = d.get(k)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

// Ingreso a urgencias: paciente existente o registro rápido, triage, cubículo y pulsera en un paso
export async function ingresarUrgencias(_previo: ResultadoIngreso | null, datos: FormData): Promise<ResultadoIngreso> {
  const { supabase, usuarioId } = await sesion()
  let paciente = texto(datos, 'paciente_id')
  const nivel = Number(texto(datos, 'nivel'))
  const motivo = texto(datos, 'motivo')
  const medico = texto(datos, 'medico')
  if (!nivel) return { error: 'Elige el nivel de triage.' }
  if (!motivo) return { error: 'Escribe el motivo de consulta.' }
  if (!medico) return { error: 'Elige al médico que atiende.' }

  if (!paciente) {
    const nombre = texto(datos, 'nombre')
    const primerApellido = texto(datos, 'primer_apellido')
    const sexo = texto(datos, 'sexo')
    const fecha = texto(datos, 'fecha_nacimiento')
    if (!nombre || !primerApellido || !sexo) return { error: 'Para un paciente nuevo: nombre, primer apellido y sexo son obligatorios.' }
    if (datos.get('confirmar_nuevo') !== '1') {
      const { data: dup, error } = await supabase.schema('clinico').rpc('buscar_duplicados', {
        p_nombre: nombre,
        p_primer_apellido: primerApellido,
        p_segundo_apellido: texto(datos, 'segundo_apellido'),
        p_fecha_nacimiento: fecha,
        p_curp: null,
      })
      if (error) return { error: traducirError(error.message) }
      if (dup && (dup as Duplicado[]).length > 0) return { duplicados: dup as Duplicado[] }
    }
    const { data, error } = await supabase
      .schema('clinico')
      .from('paciente')
      .insert({
        nombre,
        primer_apellido: primerApellido,
        segundo_apellido: texto(datos, 'segundo_apellido'),
        sexo,
        fecha_nacimiento: fecha,
        telefono: texto(datos, 'telefono'),
        creado_por: usuarioId,
      })
      .select('id')
      .single()
    if (error) return { error: traducirError(error.message) }
    paciente = data.id as string
  }

  const { data, error } = await supabase.schema('clinico').rpc('ingresar_urgencias', {
    p_paciente: paciente,
    p_medico: medico,
    p_nivel: nivel,
    p_motivo: motivo,
    p_cubiculo: texto(datos, 'cubiculo'),
  })
  if (error) return { error: traducirError(error.message) }
  revalidatePath('/urgencias')
  revalidatePath('/')
  const r = data as { encuentro: string; pulsera: string }
  return { encuentro: r.encuentro, pulsera: r.pulsera }
}
