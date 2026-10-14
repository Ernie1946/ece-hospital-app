import { obtenerPerfil } from '@/lib/perfil'
import { SinAlta } from '@/components/SinAlta'
import { CambiarContrasena } from '@/components/CambiarContrasena'

// Cambio de contraseña (obligatorio si la contraseña es temporal)
export default async function ContrasenaPage({ searchParams }: PageProps<'/cuenta/contrasena'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const recuperacion = (await searchParams).recuperacion === '1'
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <CambiarContrasena nombre={`${perfil.nombre} ${perfil.primer_apellido}`} usuario={perfil.usuario} obligatoria={perfil.debe_cambiar_contrasena || recuperacion} recuperacion={recuperacion} />
    </main>
  )
}
