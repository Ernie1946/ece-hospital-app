// Módulo de Personal: columnas de la plantilla, etiquetas y lectura del Excel
import { ETIQUETA_ROL } from '@/lib/roles'

// Dominio interno de las cuentas sin correo (debe coincidir con la función "personal" de Supabase)
export const DOMINIO_USUARIOS = 'usuarios.ece'

export const VINCULOS: Record<string, string> = {
  empleado: 'Empleado',
  medico_staff: 'Médico de staff',
  medico_credencializado: 'Médico credencializado',
  residente: 'Residente / interno / pasante',
  temporal: 'Temporal',
}
export const CON_VIGENCIA = ['medico_credencializado', 'residente', 'temporal']

export const SOLICITANTES: Record<string, string> = {
  personal: 'Personal',
  direccion_medica: 'Dirección médica',
}

export const ESTADO_CUENTA: Record<string, { texto: string; color: string }> = {
  activa: { texto: 'Activa', color: 'bg-emerald-100 text-emerald-900' },
  por_vencer: { texto: 'Vence pronto', color: 'bg-amber-100 text-amber-900' },
  vencida: { texto: 'Vencida', color: 'bg-red-100 text-red-800' },
  baja: { texto: 'Baja', color: 'bg-slate-200 text-slate-600' },
}

export const ACCION_FILA: Record<string, { texto: string; color: string }> = {
  alta: { texto: 'Alta', color: 'bg-sky-100 text-sky-900' },
  cambio: { texto: 'Cambio', color: 'bg-violet-100 text-violet-900' },
  baja: { texto: 'Baja', color: 'bg-slate-200 text-slate-700' },
  reactivar: { texto: 'Reactivar', color: 'bg-emerald-100 text-emerald-900' },
  sin_cambios: { texto: 'Sin cambios', color: 'bg-slate-100 text-slate-500' },
}

export type FilaPersonal = Record<string, string | boolean | number | null>
export type Validacion = { fila: number; usuario: string | null; nombre: string; accion: string; cambios: string | null; errores: string | null }
export type Credencial = { usuario: string; nombre: string; contrasena: string }

// Columnas de la plantilla (el título puede venir con o sin acentos/mayúsculas)
export const COLUMNAS_PERSONAL: { clave: string; titulo: string; obligatoria?: boolean; nota: string }[] = [
  { clave: 'usuario', titulo: 'Usuario', obligatoria: true, nota: 'Número de empleado o de credencial; con él entra al sistema. Letras sin acento, números, punto o guion.' },
  { clave: 'nombre', titulo: 'Nombre', obligatoria: true, nota: 'Nombre(s).' },
  { clave: 'primer_apellido', titulo: 'Primer apellido', obligatoria: true, nota: '' },
  { clave: 'segundo_apellido', titulo: 'Segundo apellido', nota: '' },
  { clave: 'rol', titulo: 'Rol', obligatoria: true, nota: 'Ver la lista de roles.' },
  { clave: 'vinculo', titulo: 'Vínculo', nota: 'Empleado (si se deja vacío), Médico de staff, Médico credencializado, Residente, Temporal.' },
  { clave: 'vigencia_hasta', titulo: 'Vigencia hasta', nota: 'Fecha en que vence el acceso. Obligatoria para credencializados, residentes y temporales.' },
  { clave: 'area', titulo: 'Área', nota: 'Clave del área base (enfermería), por ejemplo HG o MATINF.' },
  { clave: 'servicio', titulo: 'Servicio', nota: 'Clave del servicio (médicos), por ejemplo MI, CIR, GO.' },
  { clave: 'cedula_profesional', titulo: 'Cédula profesional', nota: 'Obligatoria para médicos y enfermería.' },
  { clave: 'especialidad', titulo: 'Especialidad', nota: '' },
  { clave: 'cedula_especialidad', titulo: 'Cédula de especialidad', nota: '' },
  { clave: 'correo', titulo: 'Correo', nota: 'Opcional. Con él también puede entrar (por ejemplo, médicos de staff con correo del hospital).' },
  { clave: 'solicitado_por', titulo: 'Solicitado por', nota: 'Personal o Dirección médica. Obligatorio en las altas.' },
  { clave: 'folio_solicitud', titulo: 'Folio de solicitud', nota: 'Número de oficio o solicitud.' },
  { clave: 'activo', titulo: 'Activo', nota: 'Sí o No. "No" da de baja la cuenta.' },
  { clave: 'motivo_baja', titulo: 'Motivo de baja', nota: 'Si Activo = No.' },
]

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const ROL_POR_TEXTO = new Map<string, string>()
for (const [clave, etiqueta] of Object.entries(ETIQUETA_ROL)) {
  ROL_POR_TEXTO.set(sinAcentos(clave), clave)
  ROL_POR_TEXTO.set(sinAcentos(etiqueta), clave)
}
for (const [alias, clave] of Object.entries({
  enfermera: 'enfermeria', enfermero: 'enfermeria', medico: 'medico_tratante', residente: 'medico_residente',
  anestesiologia: 'anestesiologo', sistemas: 'admin_sistema', 'administrador del sistema': 'admin_sistema',
  farmaceutico: 'farmacia', quimico: 'laboratorio', 'auditoria': 'auditor', 'cocina': 'comedor', 'nutriologo': 'nutricion',
})) ROL_POR_TEXTO.set(alias, clave)

const VINCULO_POR_TEXTO = new Map<string, string>()
for (const [clave, etiqueta] of Object.entries(VINCULOS)) {
  VINCULO_POR_TEXTO.set(sinAcentos(clave), clave)
  VINCULO_POR_TEXTO.set(sinAcentos(etiqueta), clave)
}
for (const [alias, clave] of Object.entries({
  staff: 'medico_staff', credencializado: 'medico_credencializado', externo: 'medico_credencializado', 'medico externo': 'medico_credencializado',
  interno: 'residente', pasante: 'residente', 'residente interno': 'residente', 'residente interno pasante': 'residente',
})) VINCULO_POR_TEXTO.set(alias, clave)

export const normalizarRol = (t: string) => ROL_POR_TEXTO.get(sinAcentos(t)) ?? t.trim()
export const normalizarVinculo = (t: string) => VINCULO_POR_TEXTO.get(sinAcentos(t)) ?? t.trim()
export function normalizarSolicitante(t: string) {
  const s = sinAcentos(t)
  if (s.startsWith('personal') || s === 'rh' || s.includes('recursos humanos')) return 'personal'
  if (s.includes('direccion') || s.includes('medica')) return 'direccion_medica'
  return t.trim()
}

function fechaISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const t = String(v ?? '').trim()
  if (!t) return null
  const dmy = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return t // la base dirá si no es una fecha válida
}

function siNo(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  const s = sinAcentos(String(v ?? ''))
  if (!s) return null
  if (['si', 's', 'yes', '1', 'activo', 'true', 'verdadero'].includes(s)) return true
  if (['no', 'n', '0', 'baja', 'inactivo', 'false', 'falso'].includes(s)) return false
  return null
}

// Convierte una fila (clave → texto) a lo que espera la base
export function normalizarFila(crudo: Record<string, unknown>, numero: number): FilaPersonal {
  const f: FilaPersonal = { fila: numero }
  for (const c of COLUMNAS_PERSONAL) {
    const v = crudo[c.clave]
    if (v === undefined || v === null || String(v).trim() === '') continue // vacío = no cambia
    let t: string | boolean | null = v instanceof Date ? fechaISO(v) : String(v).trim()
    if (c.clave === 'usuario') t = String(t).toLowerCase()
    if (c.clave === 'rol') t = normalizarRol(String(t))
    if (c.clave === 'vinculo') t = normalizarVinculo(String(t))
    if (c.clave === 'solicitado_por') t = normalizarSolicitante(String(t))
    if (c.clave === 'vigencia_hasta') t = fechaISO(v)
    if (c.clave === 'area' || c.clave === 'servicio') t = String(t).toUpperCase()
    if (c.clave === 'activo') t = siNo(v)
    if (t === null) continue
    f[c.clave] = t
  }
  return f
}

// Lee la hoja de Excel: primera fila con títulos, luego una persona por fila
export function interpretarHojaPersonal(hoja: unknown[][]): { filas: FilaPersonal[]; avisos: string[] } {
  const avisos: string[] = []
  const indice = hoja.findIndex((fila) => fila.some((c) => sinAcentos(String(c ?? '')) === 'usuario'))
  if (indice < 0) return { filas: [], avisos: ['No encontré la columna "Usuario". Usa la plantilla de Excel.'] }
  const titulos = hoja[indice].map((c) => sinAcentos(String(c ?? '')))
  const columna = new Map<string, number>()
  for (const c of COLUMNAS_PERSONAL) {
    const i = titulos.findIndex((t) => t === sinAcentos(c.titulo) || t === sinAcentos(c.clave))
    if (i >= 0) columna.set(c.clave, i)
  }
  const faltan = COLUMNAS_PERSONAL.filter((c) => c.obligatoria && !columna.has(c.clave)).map((c) => c.titulo)
  if (faltan.length) avisos.push(`Faltan columnas en el archivo: ${faltan.join(', ')}. Si solo vas a cambiar datos de usuarios existentes, no es problema.`)
  const filas: FilaPersonal[] = []
  hoja.slice(indice + 1).forEach((fila, i) => {
    if (!fila.some((c) => String(c ?? '').trim() !== '')) return
    const crudo: Record<string, unknown> = {}
    for (const [clave, col] of columna) crudo[clave] = fila[col]
    filas.push(normalizarFila(crudo, indice + i + 2))
  })
  if (filas.length > 3000) avisos.push('El archivo tiene más de 3,000 filas; divídelo en varios archivos.')
  return { filas: filas.slice(0, 3000), avisos }
}

export const nombreArchivoCredenciales = () => `credenciales-${new Date().toISOString().slice(0, 10)}.csv`

// CSV que Excel abre con acentos (BOM UTF-8)
export function csvCredenciales(lista: Credencial[]) {
  const celda = (s: string) => `"${s.replaceAll('"', '""')}"`
  return '﻿' + ['Usuario,Nombre,Contraseña temporal', ...lista.map((c) => [c.usuario, c.nombre, c.contrasena].map(celda).join(','))].join('\r\n')
}
