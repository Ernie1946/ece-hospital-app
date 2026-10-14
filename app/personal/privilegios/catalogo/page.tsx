import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloSistemas } from '@/components/SoloSistemas'
import { FormPrivilegioCatalogo, type PrivilegioCatalogo } from '@/components/FormPrivilegioCatalogo'
import { claseTarjeta } from '@/lib/estilos'
import { fechaHora } from '@/lib/formato'
import { GRUPO_PRIVILEGIO } from '@/lib/privilegios'
import { guardarPrivilegioCatalogo } from '../acciones'

type Fila = PrivilegioCatalogo & { acta_aprobacion: string | null; actualizado_en: string | null; actualizado_por_nombre: string | null; medicos: number }
const CATEGORIA: Record<string, string> = {
  coronario: 'coronarios',
  periferico: 'periféricos',
  neuro: 'neurointervención',
  electrofisiologia: 'marcapasos y electrofisiología',
  otro: 'otros',
}

// Catálogo de privilegios: lo decide el Comité de Credenciales; Sistemas lo captura con el acta
export default async function CatalogoPrivilegiosPage() {
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
  const [{ data }, { data: areas }] = await Promise.all([
    supabase.schema('catalogo').from('v_privilegio_admin').select('*').order('orden'),
    supabase.schema('catalogo').from('area').select('clave, nombre').eq('es_gabinete', true).eq('activo', true).order('orden'),
  ])
  const lista = (data ?? []) as Fila[]
  const unidades = [{ clave: 'HD', nombre: 'Hemodiálisis' }, ...((areas ?? []) as { clave: string; nombre: string }[])]
  const nombreUnidad = (c: string | null) => unidades.find((u) => u.clave === c)?.nombre ?? c

  return (
    <>
      <Encabezado perfil={perfil} activo="personal" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <Link href="/personal/privilegios" className="text-sm text-sky-700 hover:underline">
            ← Padrón de privilegios
          </Link>
          <section className={claseTarjeta}>
            <h1 className="text-xl font-semibold text-slate-900">Catálogo de privilegios</h1>
            <p className="mt-1 text-sm text-slate-600">
              Dirección Médica y el Comité de Credenciales deciden qué privilegios existen; aquí Sistemas los captura con el acta que los aprobó. Un privilegio
              no se borra: se desactiva (los médicos que lo tenían dejan de usarlo, pero queda su historial). La plantilla de Excel siempre sale con este
              catálogo.
            </p>
          </section>

          <section className={claseTarjeta} aria-label="Nuevo privilegio">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Agregar privilegio</h2>
            <FormPrivilegioCatalogo accion={guardarPrivilegioCatalogo.bind(null, null)} inicial={null} unidades={unidades} />
          </section>

          {Object.entries(GRUPO_PRIVILEGIO).map(([g, titulo]) => {
            const del = lista.filter((p) => p.grupo === g)
            if (!del.length) return null
            return (
              <section key={g} className={claseTarjeta} aria-label={titulo}>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">{titulo}</h2>
                <ul className="divide-y divide-slate-100 text-sm">
                  {del.map((p) => (
                    <li key={p.clave} className={`py-2 ${p.activo ? '' : 'opacity-60'}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span>
                          <span className="font-mono font-semibold">{p.clave}</span> · {p.nombre}
                          <span className="text-slate-500">
                            {p.cie9_rangos ? ` · CIE-9-MC ${p.cie9_rangos}` : ''}
                            {p.hemo_categoria ? ` · ${CATEGORIA[p.hemo_categoria]}` : ''}
                            {g === 'unidad' && p.area_clave ? ` · abre ${nombreUnidad(p.area_clave)}` : ''}
                          </span>
                          {!p.activo && <span className="ml-1 rounded bg-slate-200 px-1 text-xs">Inactivo</span>}
                        </span>
                        <span className="text-xs text-slate-500">
                          {p.medicos} médico(s) con él
                          {p.acta_aprobacion ? ` · acta ${p.acta_aprobacion}` : ''}
                          {p.actualizado_en ? ` · ${fechaHora(p.actualizado_en)} ${p.actualizado_por_nombre ?? ''}` : ''}
                        </span>
                      </div>
                      {p.descripcion && <p className="text-xs text-slate-500">{p.descripcion}</p>}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-sky-700">Modificar o desactivar</summary>
                        <div className="mt-2">
                          <FormPrivilegioCatalogo accion={guardarPrivilegioCatalogo.bind(null, p.clave)} inicial={p} unidades={unidades} />
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </main>
    </>
  )
}
