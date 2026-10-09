import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloSistemas } from '@/components/SoloSistemas'
import { FormUsuario, type DatosUsuario } from '@/components/FormUsuario'
import { AccionesCuenta } from '@/components/AccionesCuenta'
import { claseTarjeta } from '@/lib/estilos'
import { fecha, fechaHora } from '@/lib/formato'
import { ESTADO_CUENTA, SOLICITANTES } from '@/lib/personal'
import { cambiarEstado, guardarUsuario, marcarJefatura, restablecerContrasena } from '../acciones'
import { BotonAccion } from '@/components/BotonAccion'
import { opcionesPersonal } from '../opciones'

export default async function UsuarioPage({ params }: PageProps<'/personal/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!esSistemas(perfil))
    return (
      <>
        <Encabezado perfil={perfil} activo="personal" />
        <SoloSistemas />
      </>
    )
  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data: u } = await supabase.schema('seguridad').from('v_personal').select('*').eq('id', id).maybeSingle()
  if (!u) notFound()
  const { areas, servicios } = await opcionesPersonal()
  const e = ESTADO_CUENTA[u.estado_cuenta as string]
  const inicial: DatosUsuario = {
    usuario: u.usuario,
    nombre: u.nombre,
    primer_apellido: u.primer_apellido,
    segundo_apellido: u.segundo_apellido,
    rol: u.rol,
    vinculo: u.vinculo,
    vigencia_hasta: u.vigencia_hasta,
    area: u.area,
    servicio: u.servicio,
    cedula_profesional: u.cedula_profesional,
    especialidad: u.especialidad,
    cedula_especialidad: u.cedula_especialidad,
    correo: u.correo,
    solicitado_por: u.solicitado_por,
    folio_solicitud: u.folio_solicitud,
  }

  return (
    <>
      <Encabezado perfil={perfil} activo="personal" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <Link href="/personal" className="text-sm text-sky-700 hover:underline print:hidden">
            ← Personal
          </Link>
          <section className={`${claseTarjeta} print:hidden`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{u.nombre_completo as string}</h1>
              <span className={`rounded px-2 py-0.5 text-sm ${e?.color}`}>{e?.texto}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Usuario <span className="font-mono">{u.usuario as string}</span> · alta {fecha(u.creado_en as string)}
              {u.solicitado_por ? ` a solicitud de ${SOLICITANTES[u.solicitado_por as string] ?? u.solicitado_por}` : ''}
              {u.folio_solicitud ? ` (folio ${u.folio_solicitud})` : ''} · última modificación {fechaHora(u.actualizado_en as string)}
            </p>
            {!u.activo && (
              <p className="mt-1 text-sm text-red-800">
                Baja el {fechaHora(u.baja_en as string)}: {u.motivo_baja as string}
              </p>
            )}
            {u.debe_cambiar_contrasena && u.activo && <p className="mt-1 text-sm text-slate-600">Aún no cambia su contraseña temporal.</p>}
          </section>
          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800 print:hidden">Datos</h2>
            <FormUsuario accion={guardarUsuario.bind(null, true)} inicial={inicial} areas={areas} servicios={servicios} />
          </section>
          {u.rol === 'enfermeria' && u.activo && (
            <section className={`${claseTarjeta} space-y-2 text-sm print:hidden`}>
              <h2 className="font-semibold text-slate-800">Jefatura de Enfermería</h2>
              <p className="text-slate-600">
                {u.jefatura_enfermeria
                  ? 'Tiene Jefatura de Enfermería: asigna camas por turno y ve a todos los pacientes del hospital.'
                  : 'Con Jefatura de Enfermería podrá asignar camas por turno y ver a todos los pacientes del hospital.'}
              </p>
              <BotonAccion
                etiqueta={u.jefatura_enfermeria ? 'Quitar Jefatura de Enfermería' : 'Dar Jefatura de Enfermería'}
                variante="secundario"
                alHacer={marcarJefatura.bind(null, id, !u.jefatura_enfermeria)}
              />
            </section>
          )}
          <section className={claseTarjeta}>
            <AccionesCuenta
              activo={u.activo as boolean}
              propia={u.id === perfil.id}
              restablecer={restablecerContrasena.bind(null, id, u.usuario as string, u.nombre_completo as string)}
              cambiarEstado={cambiarEstado.bind(null, u.usuario as string, !u.activo)}
            />
          </section>
        </div>
      </main>
    </>
  )
}
