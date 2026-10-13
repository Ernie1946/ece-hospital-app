'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { ZONA_GAB } from '@/lib/gabinetes'
import type { Resultado } from '@/components/FormAccion'

// Hemodinamia: las reglas (verificación, una sala, implantes con lote, firma) las aplica la base

async function db() {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return supabase.schema('clinico')
}
const t = (d: FormData, c: string) => {
  const v = d.get(c)
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
const n = (d: FormData, c: string) => {
  const v = t(d, c)
  return v === null ? null : Number(v.replace(',', '.'))
}
const refrescar = () => revalidatePath('/hemodinamia', 'layout')
async function llamar(fn: string, args: Record<string, unknown>, ok: string): Promise<Resultado> {
  const { error } = await (await db()).rpc(fn, args)
  if (error) return { error: traducirError(error.message) }
  refrescar()
  return { ok }
}

export async function registrarPacienteHemo(_p: Resultado, d: FormData): Promise<Resultado> {
  const { data, error } = await (await db()).rpc('hemo_registrar_paciente', {
    p_nombre: t(d, 'nombre'),
    p_primer_apellido: t(d, 'primer_apellido'),
    p_segundo_apellido: t(d, 'segundo_apellido'),
    p_sexo: t(d, 'sexo'),
    p_fecha_nacimiento: t(d, 'fecha_nacimiento'),
    p_telefono: t(d, 'telefono'),
    p_correo: t(d, 'correo'),
  })
  if (error) return { error: traducirError(error.message) }
  redirect(`/hemodinamia/programar?paciente=${data}`)
}

export async function programarCaso(pacienteId: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const fecha = t(d, 'fecha')
  const hora = t(d, 'hora')
  if (!fecha || !hora) return { error: 'Elige la fecha y la hora.' }
  const { data, error } = await (await db()).rpc('hemo_programar', {
    p_paciente: pacienteId,
    p_procedimiento: t(d, 'procedimiento'),
    p_detalle: t(d, 'detalle'),
    p_inicio: `${fecha}T${hora}:00${ZONA_GAB}`,
    p_prioridad: t(d, 'prioridad'),
    p_hemodinamista: t(d, 'hemodinamista'),
    p_indicacion: t(d, 'indicacion'),
    p_anestesia: d.get('anestesia') === 'on',
    p_orden: t(d, 'orden'),
    p_notas: t(d, 'notas'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar()
  redirect(`/hemodinamia/caso/${data}`)
}

export async function cancelarCaso(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  return llamar('hemo_cancelar', { p_caso: id, p_motivo: t(d, 'motivo') }, 'Procedimiento cancelado.')
}

export async function guardarVerificacion(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const datos: Record<string, unknown> = {}
  for (const k of ['identificacion', 'consentimiento', 'alergias', 'ayuno', 'funcion_renal', 'acceso_venoso', 'anticoagulacion', 'pulsos'])
    datos[k] = d.get(k) === 'on'
  datos.peso_kg = t(d, 'peso_kg')
  datos.creatinina = t(d, 'creatinina')?.replace(',', '.') ?? null
  datos.anticoagulantes = t(d, 'anticoagulantes')
  return llamar('hemo_verificar', { p_caso: id, p_datos: datos }, 'Verificación guardada.')
}

export async function entrarSala(id: string): Promise<Resultado> {
  return llamar('hemo_entrar_sala', { p_caso: id }, 'Paciente en sala.')
}

export async function marcarTiempo(id: string, cual: 'inicio' | 'fin'): Promise<Resultado> {
  return llamar('hemo_marcar_tiempo', { p_caso: id, p_cual: cual }, cual === 'inicio' ? 'Inicio registrado.' : 'Fin registrado.')
}

export async function agregarParticipante(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const [usuario, papel] = (t(d, 'persona') ?? '|').split('|')
  if (!usuario || !papel) return { error: 'Elige la persona y su papel.' }
  return llamar('hemo_agregar_participante', { p_caso: id, p_usuario: usuario, p_papel: papel }, 'Agregado al equipo.')
}

export async function quitarParticipante(id: string, usuario: string, papel: string): Promise<Resultado> {
  return llamar('hemo_quitar_participante', { p_caso: id, p_usuario: usuario, p_papel: papel }, 'Quitado del equipo.')
}

export async function guardarDatos(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const datos: Record<string, unknown> = {}
  for (const k of ['acceso', 'introductor_fr', 'sedacion', 'heparina_ui', 'hallazgos', 'procedimiento_realizado', 'resultado', 'complicaciones_nota', 'cierre', 'plan'])
    datos[k] = t(d, k)
  datos.complicaciones = d.getAll('complicaciones').filter((x) => typeof x === 'string')
  datos.introductor_retirado_en_sala = d.get('introductor_retirado_en_sala') === 'on'
  return llamar('hemo_guardar_datos', { p_caso: id, p_datos: datos }, 'Hoja del procedimiento guardada.')
}

export async function guardarRadiacion(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  return llamar(
    'hemo_guardar_radiacion',
    {
      p_caso: id,
      p_contraste_tipo: t(d, 'contraste_tipo'),
      p_contraste_ml: n(d, 'contraste_ml'),
      p_fluoro_min: n(d, 'fluoro_min'),
      p_kerma_mgy: n(d, 'kerma_mgy'),
      p_dap: n(d, 'dap'),
    },
    'Radiación y contraste guardados.'
  )
}

export async function agregarMaterial(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const datos: Record<string, unknown> = {}
  for (const k of ['tipo', 'descripcion', 'marca', 'medida', 'lote', 'serie', 'cantidad', 'sitio']) datos[k] = t(d, k)
  datos.implante = d.get('implante') === 'on'
  return llamar('hemo_agregar_material', { p_caso: id, p_datos: datos }, 'Material registrado.')
}

export async function anularMaterial(material: string, _p: Resultado, d: FormData): Promise<Resultado> {
  return llamar('hemo_anular_material', { p_material: material, p_motivo: t(d, 'motivo') }, 'Material anulado.')
}

export async function salirSala(id: string): Promise<Resultado> {
  return llamar('hemo_salir_sala', { p_caso: id }, 'El paciente pasó a recuperación.')
}

export async function firmarInforme(id: string): Promise<Resultado> {
  return llamar('hemo_firmar', { p_caso: id }, 'Informe firmado.')
}

export async function registrarVigilancia(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  const datos: Record<string, unknown> = {}
  for (const k of ['evento', 'ta_sis', 'ta_dia', 'fc', 'spo2', 'eva', 'sitio', 'pulso', 'nota']) datos[k] = t(d, k)
  return llamar('hemo_registrar_vigilancia', { p_caso: id, p_datos: datos }, 'Control registrado.')
}

export async function altaRecuperacion(id: string, _p: Resultado, d: FormData): Promise<Resultado> {
  return llamar('hemo_alta_recuperacion', { p_caso: id, p_destino: t(d, 'destino') }, 'Alta de recuperación registrada.')
}
