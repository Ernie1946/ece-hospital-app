import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { claseTarjeta } from '@/lib/estilos'
import { FormPaciente } from './FormPaciente'

export default async function NuevoPacientePage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  return (
    <>
      <Encabezado perfil={perfil} activo="admision" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Nuevo paciente</h1>
          <p className="text-sm text-slate-600">
            Antes de registrar, el sistema busca expedientes con nombre parecido, misma fecha de nacimiento o
            misma CURP para evitar duplicados.
          </p>
          <section className={claseTarjeta}>
            <FormPaciente />
          </section>
        </div>
      </main>
    </>
  )
}
