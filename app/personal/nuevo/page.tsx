import Link from 'next/link'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloSistemas } from '@/components/SoloSistemas'
import { FormUsuario } from '@/components/FormUsuario'
import { claseTarjeta } from '@/lib/estilos'
import { guardarUsuario } from '../acciones'
import { opcionesPersonal } from '../opciones'

export default async function NuevoUsuarioPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!esSistemas(perfil))
    return (
      <>
        <Encabezado perfil={perfil} activo="personal" />
        <SoloSistemas />
      </>
    )
  const { areas, servicios } = await opcionesPersonal()
  return (
    <>
      <Encabezado perfil={perfil} activo="personal" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <Link href="/personal" className="text-sm text-sky-700 hover:underline print:hidden">
            ← Personal
          </Link>
          <section className={claseTarjeta}>
            <h1 className="mb-1 text-lg font-semibold text-slate-900 print:hidden">Alta individual</h1>
            <p className="mb-3 text-sm text-slate-600 print:hidden">
              Se genera una contraseña temporal que se muestra una sola vez; al entrar por primera vez, la persona la cambia.
            </p>
            <FormUsuario accion={guardarUsuario.bind(null, false)} inicial={null} areas={areas} servicios={servicios} />
          </section>
        </div>
      </main>
    </>
  )
}
