'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import type { Resultado } from '@/components/FormAccion'

// Todas las acciones corren con la sesión del usuario: la base valida su rol
// (seguridad.exigir_rol) y la seguridad por fila. Aquí solo se valida la forma.

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

// Chihuahua está en UTC-6 todo el año; el campo datetime-local no trae zona
function fechaHoraChihuahua(valor: string | null) {
  return valor ? `${valor}:00-06:00` : null
}

// ---------------------------------------------------------------------
// Alta de paciente (con detección de duplicados)
// ---------------------------------------------------------------------
export type Duplicado = {
  paciente_id: string
  expediente: string
  nombre_completo: string
  fecha_nacimiento: string | null
  similitud: number
  motivo: string
}

export type ResultadoPaciente = { error?: string; duplicados?: Duplicado[] } | null

export async function crearPaciente(_previo: ResultadoPaciente, datos: FormData): Promise<ResultadoPaciente> {
  const { supabase, usuarioId } = await sesion()

  const nombre = texto(datos, 'nombre')
  const primerApellido = texto(datos, 'primer_apellido')
  const segundoApellido = texto(datos, 'segundo_apellido')
  const fechaNacimiento = texto(datos, 'fecha_nacimiento')
  const curp = texto(datos, 'curp')?.toUpperCase() ?? null
  const sexo = texto(datos, 'sexo')

  if (!nombre || !primerApellido || !sexo) {
    return { error: 'Nombre, primer apellido y sexo son obligatorios.' }
  }

  // 1. Buscar posibles duplicados, salvo que el usuario ya confirmó que es otra persona
  if (datos.get('confirmar_nuevo') !== '1') {
    const { data: duplicados, error } = await supabase.schema('clinico').rpc('buscar_duplicados', {
      p_nombre: nombre,
      p_primer_apellido: primerApellido,
      p_segundo_apellido: segundoApellido,
      p_fecha_nacimiento: fechaNacimiento,
      p_curp: curp,
    })
    if (error) return { error: traducirError(error.message) }
    if (duplicados && duplicados.length > 0) return { duplicados: duplicados as Duplicado[] }
  }

  // 2. Registrar
  const { data, error } = await supabase
    .schema('clinico')
    .from('paciente')
    .insert({
      nombre,
      primer_apellido: primerApellido,
      segundo_apellido: segundoApellido,
      sexo,
      fecha_nacimiento: fechaNacimiento,
      curp,
      tipo_sangre: texto(datos, 'tipo_sangre'),
      telefono: texto(datos, 'telefono'),
      correo: texto(datos, 'correo'),
      creado_por: usuarioId,
    })
    .select('id')
    .single()

  if (error) return { error: traducirError(error.message) }

  revalidatePath('/admision')
  redirect(`/admision/paciente/${data.id}`)
}

// ---------------------------------------------------------------------
// Alergias y pólizas
// ---------------------------------------------------------------------
export async function agregarAlergia(pacienteId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase, usuarioId } = await sesion()
  const sustancia = texto(datos, 'sustancia')
  if (!sustancia) return { error: 'Escribe la sustancia o medicamento.' }

  const medicamentoId = texto(datos, 'medicamento_id')
  const { error } = await supabase.schema('clinico').from('paciente_alergia').insert({
    paciente_id: pacienteId,
    sustancia,
    medicamento_id: medicamentoId ? Number(medicamentoId) : null,
    reaccion: texto(datos, 'reaccion'),
    severidad: texto(datos, 'severidad'),
    registrada_por: usuarioId,
  })
  if (error) return { error: traducirError(error.message) }

  revalidatePath(`/admision/paciente/${pacienteId}`)
  return { ok: `Alergia a ${sustancia} registrada.` }
}

export async function agregarPoliza(pacienteId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const aseguradora = texto(datos, 'aseguradora_id')
  const numero = texto(datos, 'numero_poliza')
  const titular = texto(datos, 'titular')
  if (!aseguradora || !numero || !titular) return { error: 'Aseguradora, número de póliza y titular son obligatorios.' }

  const { error } = await supabase.schema('clinico').from('poliza').insert({
    paciente_id: pacienteId,
    aseguradora_id: Number(aseguradora),
    numero_poliza: numero,
    titular,
    deducible: Number(texto(datos, 'deducible') ?? 0),
    coaseguro_pct: Number(texto(datos, 'coaseguro_pct') ?? 0),
    vigencia_fin: texto(datos, 'vigencia_fin'),
  })
  if (error) return { error: traducirError(error.message) }

  revalidatePath(`/admision/paciente/${pacienteId}`)
  return { ok: 'Póliza registrada.' }
}

// ---------------------------------------------------------------------
// Ingreso programado, cama y pulsera
// ---------------------------------------------------------------------
export async function programarIngreso(pacienteId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const tipo = texto(datos, 'tipo')
  const servicio = texto(datos, 'servicio')
  const medico = texto(datos, 'medico')
  const fecha = fechaHoraChihuahua(texto(datos, 'fecha_programada'))
  const diagnostico = texto(datos, 'diagnostico')
  if (!tipo || !servicio || !medico || !fecha || !diagnostico) {
    return { error: 'Completa tipo, servicio, médico tratante, fecha y diagnóstico presuntivo.' }
  }

  const { error } = await supabase.schema('clinico').rpc('programar_ingreso', {
    p_paciente: pacienteId,
    p_tipo: tipo,
    p_servicio_clave: servicio,
    p_medico: medico,
    p_fecha_programada: fecha,
    p_diagnostico_presuntivo: diagnostico,
    p_poliza: texto(datos, 'poliza'),
  })
  if (error) return { error: traducirError(error.message) }

  revalidatePath('/admision')
  // El formulario desaparece al haber un ingreso en curso; el aviso va en la ficha
  redirect(`/admision/paciente/${pacienteId}?aviso=ingreso`)
}

export async function asignarCama(
  pacienteId: string,
  encuentroId: string,
  _previo: Resultado,
  datos: FormData
): Promise<Resultado> {
  const { supabase } = await sesion()
  const cama = texto(datos, 'cama')
  if (!cama) return { error: 'Elige una cama.' }

  const { error } = await supabase.schema('camas').rpc('reservar', {
    p_encuentro: encuentroId,
    p_cama_clave: cama,
  })
  if (error) return { error: traducirError(error.message) }

  revalidatePath(`/admision/paciente/${pacienteId}`)
  revalidatePath('/')
  return { ok: `Cama ${cama} reservada. Enfermería registrará la llegada a piso.` }
}

export async function imprimirPulsera(encuentroId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('clinico').rpc('imprimir_pulsera', {
    p_encuentro: encuentroId,
    p_motivo_reimpresion: texto(datos, 'motivo'),
  })
  if (error) return { error: traducirError(error.message) }

  redirect(`/admision/pulsera/${encuentroId}`)
}
