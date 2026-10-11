'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'

// Unidad de hemodiálisis: las reglas (roles, aislamiento, máquina libre) las aplica la base

async function sesion() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase.schema('clinico')
}
const t = (d: FormData, c: string) => {
  const v = d.get(c)
  return typeof v === 'string' ? v.trim() : ''
}
const refrescar = () => revalidatePath('/hemodialisis', 'layout')

export async function agregarAlPrograma(pacienteId: string, tipo: string): Promise<Resultado> {
  const db = await sesion()
  const { error } = await db.rpc('hd_guardar_paciente', { p_paciente: pacienteId, p_datos: { tipo } })
  if (error) return { error: traducirError(error.message) }
  redirect(`/hemodialisis/paciente/${pacienteId}`)
}

export async function guardarPrograma(pacienteId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const datos: Record<string, string | boolean> = {}
  for (const c of ['tipo', 'peso_seco', 'acceso_tipo', 'acceso_sitio', 'acceso_fecha', 'hbsag', 'vhc', 'vih', 'otra_infeccion', 'serologia_fecha', 'notas'])
    datos[c] = t(d, c)
  const { error } = await db.rpc('hd_guardar_paciente', { p_paciente: pacienteId, p_datos: datos })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Datos del programa guardados.' }
}

export async function darDeBaja(pacienteId: string, activo: boolean, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const { error } = await db.rpc('hd_guardar_paciente', { p_paciente: pacienteId, p_datos: { activo, motivo_baja: t(d, 'motivo_baja') } })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: activo ? 'Paciente reactivado en el programa.' : 'Paciente dado de baja del programa.' }
}

export async function guardarPrescripcion(pacienteId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const num = (c: string) => (t(d, c) ? Number(t(d, c)) : null)
  const { error } = await db.rpc('hd_prescribir', {
    p_paciente: pacienteId,
    p_prescripcion: {
      duracion_min: num('duracion_min'),
      qb: num('qb'),
      qd: num('qd'),
      uf_max_ml: num('uf_max_ml'),
      filtro: t(d, 'filtro') || null,
      heparina: t(d, 'heparina') || null,
      bano_k: t(d, 'bano_k') || null,
      bano_ca: t(d, 'bano_ca') || null,
      indicaciones: t(d, 'indicaciones') || null,
    },
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Prescripción guardada.' }
}

export async function fijarHorario(pacienteId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const dias = d.getAll('dias').map(Number)
  const { error } = await db.rpc('hd_fijar_horario', { p_paciente: pacienteId, p_dias: dias, p_horario: t(d, 'horario'), p_maquina: t(d, 'maquina') })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: dias.length ? 'Horario fijo guardado. Se aplica al generar la semana.' : 'Se quitó el horario fijo.' }
}

export async function programarSesion(fecha: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const { error } = await db.rpc('hd_programar_sesion', {
    p_paciente: t(d, 'paciente'),
    p_fecha: t(d, 'fecha') || fecha,
    p_horario: t(d, 'horario'),
    p_maquina: t(d, 'maquina'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Sesión programada.' }
}

export async function generarSemana(lunes: string): Promise<Resultado> {
  const db = await sesion()
  const { data, error } = await db.rpc('hd_generar_semana', { p_lunes: lunes })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  const filas = (data ?? []) as { paciente: string; fecha: string; horario: string; resultado: string }[]
  const sinLugar = filas.filter((f) => f.resultado.startsWith('Sin'))
  const n = filas.length - sinLugar.length
  if (sinLugar.length)
    return { error: `Se programaron ${n} sesiones. Sin máquina libre: ${sinLugar.map((f) => `${f.paciente} (${f.fecha} ${f.horario} h)`).join('; ')}` }
  return { ok: n ? `Se programaron ${n} sesiones de la semana.` : 'La semana ya estaba programada.' }
}

export async function cancelarSesion(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const { error } = await db.rpc('hd_cancelar_sesion', { p_sesion: id, p_motivo: t(d, 'motivo'), p_no_asistio: d.get('no_asistio') === 'on' })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Sesión cancelada.' }
}

export async function iniciarSesion(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const n = (c: string) => (t(d, c) ? Number(t(d, c).replace(',', '.')) : null)
  const { data, error } = await db.rpc('hd_iniciar_sesion', {
    p_sesion: id,
    p_peso: n('peso'),
    p_ta_s: n('ta_s'),
    p_ta_d: n('ta_d'),
    p_fc: n('fc'),
    p_temp: n('temp'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: data !== null ? `Sesión iniciada. Meta de ultrafiltración: ${Number(data).toLocaleString('es-MX')} mL.` : 'Sesión iniciada (sin peso seco no se calcula la meta de UF).' }
}

export async function registrarControl(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const datos: Record<string, string> = {}
  for (const c of ['ta_s', 'ta_d', 'fc', 'qb', 'presion_venosa', 'presion_arterial', 'ptm', 'uf_acumulada_ml', 'notas']) datos[c] = t(d, c)
  const { error } = await db.rpc('hd_registrar_control', { p_sesion: id, p_datos: datos })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Control registrado.' }
}

export async function terminarSesion(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const datos: Record<string, string | string[]> = { complicaciones: d.getAll('complicaciones').map(String) }
  for (const c of ['peso_post', 'ta_post_s', 'ta_post_d', 'fc_post', 'uf_real_ml', 'notas']) datos[c] = t(d, c).replace(',', '.')
  const { error } = await db.rpc('hd_terminar_sesion', { p_sesion: id, p_datos: datos })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok: 'Sesión terminada.' }
}

// Paciente nuevo (sin expediente): se registra y entra al programa
export async function registrarPacienteHd(_p: Resultado, d: FormData): Promise<Resultado> {
  const db = await sesion()
  const { data, error } = await db.rpc('hd_registrar_paciente', {
    p_nombre: t(d, 'nombre'),
    p_primer_apellido: t(d, 'primer_apellido'),
    p_segundo_apellido: t(d, 'segundo_apellido'),
    p_sexo: t(d, 'sexo'),
    p_fecha_nacimiento: t(d, 'fecha_nacimiento') || null,
    p_telefono: t(d, 'telefono'),
    p_correo: t(d, 'correo'),
    p_tipo: t(d, 'tipo'),
  })
  if (error) return { error: traducirError(error.message) }
  redirect(`/hemodialisis/paciente/${data}`)
}
