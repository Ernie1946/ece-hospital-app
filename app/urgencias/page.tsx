import Link from 'next/link'
import { obtenerPerfil } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { IngresoUrgencias } from '@/components/IngresoUrgencias'
import { claseTarjeta } from '@/lib/estilos'
import { ahora, edadDetalle, edadTextoCorto } from '@/lib/formato'
import { TRIAGE } from '@/lib/urgencias'
import { buscarPacientes, ingresarUrgencias } from './acciones'

type Fila = {
  encuentro_id: string
  estado: string
  inicio: string
  paciente: string
  expediente: string
  sexo: string
  fecha_nacimiento: string | null
  nivel: number | null
  tiempo_objetivo_min: number | null
  motivo_consulta: string | null
  atendido_en: string | null
  medico: string | null
  cubiculo: string | null
  con_nota: boolean
  destino_id: string | null
  destino_servicio: string | null
  destino_cama: string | null
}

const minutos = (desde: string) => Math.max(0, Math.round((ahora() - new Date(desde).getTime()) / 60000))
const duracion = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)

// Urgencias las 24 h: tablero por triage e ingreso sin depender de Admisión
export default async function UrgenciasPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const supabase = await crearClienteServidor()
  const puedeIngresar = ['enfermeria', 'medico_tratante', 'medico_residente', 'admision'].includes(perfil.rol)
  const [filasQ, medicosQ, cubQ] = await Promise.all([
    supabase.schema('clinico').from('v_urgencias').select('*').order('nivel').order('inicio'),
    supabase.schema('seguridad').from('usuario').select('id, nombre, primer_apellido, rol').in('rol', ['medico_tratante', 'medico_residente']).eq('activo', true).order('primer_apellido'),
    supabase.schema('camas').from('v_censo').select('cama').eq('area', 'URG').eq('estado', 'disponible').order('cama'),
  ])
  const filas = (filasQ.data ?? []) as Fila[]
  const medicos = ((medicosQ.data ?? []) as { id: string; nombre: string; primer_apellido: string; rol: string }[]).map((m) => ({
    id: m.id,
    nombre: `${m.primer_apellido} ${m.nombre}${m.rol === 'medico_residente' ? ' (residente)' : ''}`,
  }))
  const cubiculos = ((cubQ.data ?? []) as { cama: string }[]).map((c) => c.cama)
  const hoja = (id: string) => (perfil.rol === 'enfermeria' ? `/enfermeria/encuentro/${id}` : `/medicos/encuentro/${id}`)

  return (
    <>
      <Encabezado perfil={perfil} activo="urgencias" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Urgencias</h1>
            <span className="text-sm text-slate-600">
              {filas.length} paciente(s) · {cubiculos.length} cubículo(s) libre(s)
            </span>
          </div>

          <section className={claseTarjeta} aria-label="Pacientes en urgencias">
            {filas.length === 0 ? (
              <p className="text-sm text-slate-500">No hay pacientes en urgencias.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-2">Triage</th>
                      <th className="pr-2">Paciente</th>
                      <th className="pr-2">Motivo</th>
                      <th className="pr-2">Cubículo</th>
                      <th className="pr-2">Espera</th>
                      <th className="pr-2">Médico</th>
                      <th className="pr-2">Situación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const t = TRIAGE.find((x) => x.nivel === f.nivel)
                      const espera = minutos(f.inicio)
                      const tarde = !f.atendido_en && f.tiempo_objetivo_min !== null && espera > f.tiempo_objetivo_min
                      const situacion =
                        f.estado === 'alta_medica'
                          ? { texto: 'Alta médica: falta registrar la salida', clase: 'bg-slate-100 text-slate-700' }
                          : f.destino_id
                            ? { texto: `Se hospitaliza en ${f.destino_servicio}${f.destino_cama ? ` · cama ${f.destino_cama}` : ' · falta cama'}`, clase: 'bg-sky-100 text-sky-800' }
                            : f.con_nota
                              ? { texto: 'Valorado por médico', clase: 'bg-emerald-100 text-emerald-800' }
                              : { texto: 'Esperando médico', clase: 'bg-amber-100 text-amber-800' }
                      return (
                        <tr key={f.encuentro_id} className="border-t border-slate-100 align-top">
                          <td className="py-1.5 pr-2">{t && <span className={`rounded px-2 py-0.5 text-xs font-semibold ${t.clase}`}>{t.nivel} {t.color}</span>}</td>
                          <td className="pr-2">
                            <Link href={hoja(f.encuentro_id)} className="font-medium text-sky-700 hover:underline">
                              {f.paciente}
                            </Link>
                            <span className="block text-xs text-slate-500">
                              {f.expediente} · {f.sexo} · {edadTextoCorto(edadDetalle(f.fecha_nacimiento))}
                            </span>
                          </td>
                          <td className="pr-2">{f.motivo_consulta}</td>
                          <td className="pr-2">{f.cubiculo ?? <span className="text-slate-400">espera</span>}</td>
                          <td className={`pr-2 whitespace-nowrap ${tarde ? 'font-semibold text-red-700' : ''}`}>
                            {duracion(espera)}
                            {tarde && <span className="block text-xs">rebasa {duracion(f.tiempo_objetivo_min!)}</span>}
                          </td>
                          <td className="pr-2 text-xs">{f.medico}</td>
                          <td className="pr-2">
                            <span className={`rounded px-1.5 text-xs ${situacion.clase}`}>{situacion.texto}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {puedeIngresar && (
            <section className={claseTarjeta}>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Ingresar paciente a urgencias</h2>
              <p className="mb-3 text-xs text-slate-500">Disponible las 24 horas: no requiere a Admisión. Al terminar se imprime la pulsera.</p>
              <IngresoUrgencias accion={ingresarUrgencias} buscar={buscarPacientes} medicos={medicos} cubiculos={cubiculos} />
            </section>
          )}
        </div>
      </main>
    </>
  )
}
