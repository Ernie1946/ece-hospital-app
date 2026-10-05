'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { traducirError } from '@/lib/errores'
import { EXPLORACION, ESCALAS_VIA_AEREA, INTERROGATORIO, LABORATORIOS } from '@/lib/anestesia'
import { ALDRETE, TECNICA_SECCIONES } from '@/lib/anestesia-trans'
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

// ---------------------------------------------------------------------
// Hoja transanestésica
// ---------------------------------------------------------------------

// "HH:MM" capturada en sala → instante en hora de Chihuahua (vacío = ahora).
// Si la hora queda en el futuro es de la noche anterior (cirugía que cruza medianoche).
function momento(datos: FormData, campo = 'hora') {
  const v = texto(datos, campo)
  if (!v || !/^\d{2}:\d{2}$/.test(v)) return null
  const hoy = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10)
  let t = Date.parse(`${hoy}T${v}:00-06:00`)
  if (t > Date.now() + 5 * 60 * 1000) t -= 24 * 3600 * 1000
  return new Date(t).toISOString()
}

const entero = (datos: FormData, campo: string) => {
  const n = numero(datos, campo)
  return n === null ? null : Math.round(n)
}

export async function iniciarAnestesia(cirugiaId: string): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('clinico').rpc('iniciar_anestesia', { p_cirugia: cirugiaId })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: 'Hoja transanestésica abierta. Paciente en quirófano.' }
}

export async function marcarTiempo(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const evento = texto(datos, 'evento')
  if (!evento) return { error: 'Falta el evento.' }
  const { error } = await supabase
    .schema('clinico')
    .rpc('anestesia_marcar_tiempo', { p_registro: registroId, p_evento: evento, p_momento: momento(datos) })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: 'Hora registrada.' }
}

export async function agregarSigno(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const valores = {
    p_spo2: entero(datos, 'spo2'),
    p_fc: entero(datos, 'fc'),
    p_tas: entero(datos, 'tas'),
    p_tad: entero(datos, 'tad'),
    p_etco2: entero(datos, 'etco2'),
    p_temp: numero(datos, 'temp'),
    p_bis: entero(datos, 'bis'),
    p_tof: entero(datos, 'tof'),
  }
  if (Object.values(valores).every((v) => v === null)) return { error: 'Captura al menos un signo vital.' }
  const { error } = await supabase
    .schema('clinico')
    .rpc('anestesia_agregar_signo', { p_registro: registroId, p_momento: momento(datos), ...valores })
  if (error) return { error: traducirSigno(error.message) }
  refrescar(cirugiaId)
  return { ok: 'Signos registrados.' }
}

function traducirSigno(m: string) {
  if (m.includes('anestesia_signo_check')) return 'La sistólica debe ser mayor que la diastólica.'
  if (m.includes('anestesia_signo_') && m.includes('_check')) return 'Algún signo está fuera del rango posible. Revisa los valores.'
  return traducirError(m)
}

export async function agregarFarmaco(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const farmaco = texto(datos, 'farmaco')
  if (!farmaco) return { error: 'Indica el fármaco.' }
  const { error } = await supabase.schema('clinico').rpc('anestesia_agregar_farmaco', {
    p_registro: registroId,
    p_momento: momento(datos),
    p_farmaco: farmaco,
    p_dosis: numero(datos, 'dosis'),
    p_unidad: texto(datos, 'unidad'),
    p_via: texto(datos, 'via'),
    p_notas: texto(datos, 'notas'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: `${farmaco} registrado.` }
}

export async function agregarLiquido(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const tipo = texto(datos, 'tipo')
  const concepto = texto(datos, 'concepto') === 'Otro' ? texto(datos, 'concepto_otro') : texto(datos, 'concepto')
  const volumen = numero(datos, 'volumen')
  if (!tipo || !concepto || !volumen) return { error: 'Indica tipo, concepto y volumen.' }
  const { error } = await supabase.schema('clinico').rpc('anestesia_agregar_liquido', {
    p_registro: registroId,
    p_momento: momento(datos),
    p_tipo: tipo,
    p_concepto: concepto,
    p_volumen_ml: volumen,
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: `${concepto} ${volumen} mL registrado.` }
}

export async function quitarRenglon(registroId: string, cirugiaId: string, tabla: 'signo' | 'farmaco' | 'liquido', id: number): Promise<Resultado> {
  const { supabase } = await sesion()
  const { error } = await supabase.schema('clinico').rpc('anestesia_quitar', { p_registro: registroId, p_tabla: tabla, p_id: id })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: 'Renglón quitado.' }
}

export async function guardarTecnica(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const tecnica: Record<string, Record<string, string>> = {}
  for (const s of TECNICA_SECCIONES) {
    const sec: Record<string, string> = {}
    for (const c of s.campos) {
      const nombre = `t_${s.clave}_${c.clave}`
      const v = c.tipo === 'casillas' ? datos.getAll(nombre).map(String).filter(Boolean).join(', ') : texto(datos, nombre)
      if (v) sec[c.clave] = v
    }
    if (Object.keys(sec).length) tecnica[s.clave] = sec
  }
  const tipo = texto(datos, 'tipo_anestesia')
  if (!tipo) return { error: 'Indica el tipo de anestesia.' }
  const { error } = await supabase
    .schema('clinico')
    .rpc('anestesia_guardar_tecnica', { p_registro: registroId, p_tipo_anestesia: tipo, p_datos: tecnica })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: 'Técnica guardada.' }
}

export async function cerrarHoja(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const salida: Record<string, string> = {}
  for (const k of ['destino', 'condicion', 'consciencia', 'eva', 'ta', 'fc', 'spo2', 'fr', 'temp', 'indicaciones', 'observaciones', 'recibe']) {
    const v = texto(datos, k)
    if (v) salida[k] = v
  }
  if (!salida.destino || !salida.condicion) return { error: 'Indica destino y condición del paciente a la salida.' }
  if (salida.ta && !/^\d{2,3}\/\d{2,3}$/.test(salida.ta)) return { error: 'La TA se escribe como 120/80.' }
  const { error } = await supabase.schema('clinico').rpc('anestesia_cerrar', { p_registro: registroId, p_salida: salida })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return {
    ok: salida.destino === 'UCPA' ? 'Hoja firmada. Paciente en recuperación.' : `Hoja firmada. Paciente egresa a ${salida.destino}.`,
  }
}

// ---------------------------------------------------------------------
// Recuperación
// ---------------------------------------------------------------------
export async function registrarAldrete(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const puntos: Record<string, number> = {}
  for (const a of ALDRETE) {
    const v = entero(datos, a.clave)
    if (v === null) return { error: `Falta calificar: ${a.titulo}.` }
    puntos[`p_${a.clave}`] = v
  }
  const { data: total, error } = await supabase.schema('clinico').rpc('recuperacion_registrar_aldrete', {
    p_registro: registroId,
    ...puntos,
    p_eva: entero(datos, 'eva'),
    p_spo2: entero(datos, 'spo2'),
    p_fc: entero(datos, 'fc'),
    p_ta: texto(datos, 'ta'),
    p_notas: texto(datos, 'notas'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: `Aldrete ${total}/10 registrado.` }
}

export async function altaRecuperacion(registroId: string, cirugiaId: string, _previo: Resultado, datos: FormData): Promise<Resultado> {
  const { supabase } = await sesion()
  const destino = texto(datos, 'destino')
  if (!destino) return { error: 'Indica el destino del paciente.' }
  const { error } = await supabase.schema('clinico').rpc('recuperacion_alta', {
    p_registro: registroId,
    p_destino: destino,
    p_notas: texto(datos, 'notas'),
    p_justificacion: texto(datos, 'justificacion'),
  })
  if (error) return { error: traducirError(error.message) }
  refrescar(cirugiaId)
  return { ok: `Alta de recuperación firmada. Destino: ${destino}.` }
}
