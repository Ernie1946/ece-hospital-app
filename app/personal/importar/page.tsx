import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloSistemas } from '@/components/SoloSistemas'
import { ImportarPersonal } from '@/components/ImportarPersonal'
import { claseTarjeta } from '@/lib/estilos'
import { ETIQUETA_ROL } from '@/lib/roles'
import { VINCULOS } from '@/lib/personal'
import { aplicarLote, validarFilas } from '../acciones'

export default async function ImportarPersonalPage() {
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
  const [areas, servicios] = await Promise.all([
    supabase.schema('catalogo').from('area').select('clave, nombre, padre_id').eq('activo', true).order('orden'),
    supabase.schema('catalogo').from('servicio').select('clave, nombre').order('nombre'),
  ])

  return (
    <>
      <Encabezado perfil={perfil} activo="personal" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/personal" className="text-sm text-sky-700 hover:underline print:hidden">
            ← Personal
          </Link>
          <section className={claseTarjeta}>
            <h1 className="mb-2 text-lg font-semibold text-slate-900 print:hidden">Alta y cambios de personal desde Excel</h1>
            <ImportarPersonal validar={validarFilas} aplicar={aplicarLote} />
          </section>

          <section className={`${claseTarjeta} grid gap-4 text-xs text-slate-700 md:grid-cols-4 print:hidden`}>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Roles</h2>
              <ul>
                {Object.entries(ETIQUETA_ROL).map(([k, v]) => (
                  <li key={k}>
                    {v} <span className="font-mono text-slate-500">({k})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Vínculo</h2>
              <ul>
                {Object.values(VINCULOS).map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
              <p className="mt-2 text-slate-500">Credencializados, residentes y temporales llevan fecha de vigencia: al vencer, la cuenta deja de entrar sola.</p>
            </div>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Áreas (clave)</h2>
              <ul>
                {(areas.data ?? []).map((a) => (
                  <li key={a.clave as string}>
                    {a.padre_id ? '· ' : ''}
                    <span className="font-mono">{a.clave as string}</span> {a.nombre as string}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Servicios (clave)</h2>
              <ul>
                {(servicios.data ?? []).map((s) => (
                  <li key={s.clave as string}>
                    <span className="font-mono">{s.clave as string}</span> {s.nombre as string}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
