import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloSistemas } from '@/components/SoloSistemas'
import { ImportarPrivilegios } from '@/components/ImportarPrivilegios'
import { claseTarjeta } from '@/lib/estilos'
import { GRUPO_PRIVILEGIO, type Privilegio } from '@/lib/privilegios'
import { procesarEspecialidades, procesarPrivilegios } from '../acciones'

// Carga masiva de privilegios y especialidades (lo ratificado por el Comité de Credenciales)
export default async function ImportarPrivilegiosPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!esSistemas(perfil))
    return (
      <>
        <Encabezado perfil={perfil} activo="personal" />
        <SoloSistemas />
      </>
    )
  const supabase = await crearClienteServidor()
  const { data } = await supabase.schema('catalogo').from('privilegio').select('clave, nombre, grupo, cie9_rangos, descripcion').eq('activo', true).order('orden')
  const catalogo = (data ?? []) as Privilegio[]

  return (
    <>
      <Encabezado perfil={perfil} activo="personal" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/personal/privilegios" className="text-sm text-sky-700 hover:underline">
            ← Padrón de privilegios
          </Link>
          <section className={claseTarjeta}>
            <h1 className="mb-1 text-lg font-semibold text-slate-900">Privilegios y especialidades desde Excel</h1>
            <p className="mb-3 text-sm text-slate-600">
              Una fila por médico y acta en la hoja «Privilegios» (una o varias claves separadas por coma; acción Otorgar, Renovar o Revocar), y sus
              especialidades en la hoja «Especialidades». Primero verás la revisión fila por fila; nada se guarda hasta que presiones Aplicar.
            </p>
            <ImportarPrivilegios privilegios={procesarPrivilegios} especialidades={procesarEspecialidades} />
          </section>
          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Claves de privilegio</h2>
            <div className="grid gap-4 text-xs text-slate-700 md:grid-cols-2">
              {Object.entries(GRUPO_PRIVILEGIO).map(([g, titulo]) => {
                const lista = catalogo.filter((c) => c.grupo === g)
                if (!lista.length) return null
                return (
                  <div key={g}>
                    <h3 className="mb-1 font-semibold text-slate-800">{titulo}</h3>
                    <ul>
                      {lista.map((c) => (
                        <li key={c.clave}>
                          <span className="font-mono font-semibold">{c.clave}</span> · {c.nombre}
                          {c.cie9_rangos ? <span className="text-slate-500"> (CIE-9-MC {c.cie9_rangos})</span> : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
