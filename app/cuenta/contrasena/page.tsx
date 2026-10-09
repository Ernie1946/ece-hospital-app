import { obtenerPerfil } from '@/lib/perfil'
import { SinAlta } from '@/components/SinAlta'
import { CambiarContrasena } from '@/components/CambiarContrasena'

// Cambio de contraseña (obligatorio si la contraseña es temporal)
export default async function ContrasenaPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <CambiarContrasena nombre={`${perfil.nombre} ${perfil.primer_apellido}`} usuario={perfil.usuario} obligatoria={perfil.debe_cambiar_contrasena} />
    </main>
  )
}
