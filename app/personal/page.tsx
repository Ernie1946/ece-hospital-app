import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { esSistemas, obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { SoloSistemas } from '@/components/SoloSistemas'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { ETIQUETA_ROL, etiquetaRol } from '@/lib/roles'
import { ESTADO_CUENTA, VINCULOS } from '@/lib/personal'
import { fecha } from '@/lib/formato'

// ---------------------------------------------------------------------
// Personal (Sistemas): lista de usuarios con búsqueda y filtros,
// alta individual, alta/cambios masivos desde Excel.
// ---------------------------------------------------------------------

type Fila = {
  id: string
  usuario: string
  nombre_completo: string
  rol: string
  vinculo: string
  vigencia_hasta: string | null
  area_nombre: string | null
  servicio_nombre: string | null
  cedula_profesional: string | null
  correo: string | null
  estado_cuenta: string
  debe_cambiar_contrasena: boolean
}

const ESTADOS = [
  ['vigentes', 'Activas'],
  ['por_vencer', 'Vencen en 30 días'],
  ['vencida', 'Vencidas'],
  ['baja', 'Bajas'],
  ['todas', 'Todas'],
] as const

export default async function PersonalPage({ searchParams }: PageProps<'/personal'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!esSistemas(perfil))
    return (
      <>
        <Encabezado perfil={perfil} activo="personal" />
        <SoloSistemas />
      </>
    )

  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const rol = typeof sp.rol === 'string' ? sp.rol : ''
  const estado = typeof sp.estado === 'string' ? sp.estado : 'vigentes'

  const supabase = await crearClienteServidor()
  let consulta = supabase
    .schema('seguridad')
    .from('v_personal')
    .select('id, usuario, nombre_completo, rol, vinculo, vigencia_hasta, area_nombre, servicio_nombre, cedula_profesional, correo, estado_cuenta, debe_cambiar_contrasena', { count: 'exact' })
    .order('primer_apellido')
    .order('nombre')
    .limit(200)
  if (q) {
    const t = q.replace(/[%,()]/g, ' ')
    consulta = consulta.or(`usuario.ilike.%${t}%,nombre_completo.ilike.%${t}%,cedula_profesional.ilike.%${t}%,correo.ilike.%${t}%`)
  }
  if (rol) consulta = consulta.eq('rol', rol)
  if (estado === 'vigentes') consulta = consulta.in('estado_cuenta', ['activa', 'por_vencer'])
  else if (estado !== 'todas') consulta = consulta.eq('estado_cuenta', estado)
  const { data, count } = await consulta
  const lista = (data ?? []) as Fila[]

  const [{ count: porVencer }, { count: total }] = await Promise.all([
    supabase.schema('seguridad').from('v_personal').select('id', { count: 'exact', head: true }).eq('estado_cuenta', 'por_vencer'),
    supabase.schema('seguridad').from('v_personal').select('id', { count: 'exact', head: true }).in('estado_cuenta', ['activa', 'por_vencer']),
  ])

  const enlace = (e: string) => `/personal?${new URLSearchParams({ ...(q ? { q } : {}), ...(rol ? { rol } : {}), estado: e })}`

  return (
    <>
      <Encabezado perfil={perfil} activo="personal" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold text-slate-900">Personal ({total ?? 0} cuentas activas)</h1>
            <div className="flex gap-2 text-sm">
              <Link href="/personal/nuevo" className="rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800">
                + Alta individual
              </Link>
              <Link href="/personal/importar" className="rounded-lg border border-sky-700 bg-white px-3 py-1.5 font-medium text-sky-800 hover:bg-sky-50">
                Alta y cambios desde Excel
              </Link>
            </div>
          </div>

          {(porVencer ?? 0) > 0 && estado !== 'por_vencer' && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {porVencer} cuenta(s) vencen en los próximos 30 días (credenciales, rotaciones o accesos temporales).{' '}
              <Link href={enlace('por_vencer')} className="font-medium underline">
                Ver cuáles
              </Link>
            </p>
          )}

          <section className={claseTarjeta}>
            <form className="flex flex-wrap items-end gap-3">
              <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                Buscar
                <input name="q" defaultValue={q} placeholder="Nombre, usuario, cédula o correo" className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Rol
                <select name="rol" defaultValue={rol} className={claseCampo}>
                  <option value="">Todos</option>
                  {Object.entries(ETIQUETA_ROL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="estado" value={estado} />
              <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Buscar</button>
            </form>
            <nav className="mt-3 flex flex-wrap gap-1 text-sm" aria-label="Estado de la cuenta">
              {ESTADOS.map(([k, v]) => (
                <Link
                  key={k}
                  href={enlace(k)}
                  aria-current={estado === k ? 'page' : undefined}
                  className={`rounded-full px-3 py-1 ${estado === k ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {v}
                </Link>
              ))}
            </nav>
          </section>

          <section className={claseTarjeta}>
            {lista.length === 0 ? (
              <p className="text-sm text-slate-500">Sin resultados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1">Usuario</th>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Área / servicio</th>
                      <th>Vínculo</th>
                      <th>Vigencia</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((u) => {
                      const e = ESTADO_CUENTA[u.estado_cuenta]
                      return (
                        <tr key={u.id} className="border-t border-slate-100">
                          <td className="py-1.5 font-mono">
                            <Link href={`/personal/${u.id}`} className="text-sky-700 hover:underline">
                              {u.usuario}
                            </Link>
                          </td>
                          <td>{u.nombre_completo}</td>
                          <td>{etiquetaRol(u.rol)}</td>
                          <td className="text-slate-600">{[u.area_nombre, u.servicio_nombre].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="text-slate-600">{VINCULOS[u.vinculo] ?? u.vinculo}</td>
                          <td className="text-slate-600">{u.vigencia_hasta ? fecha(u.vigencia_hasta) : '—'}</td>
                          <td>
                            <span className={`rounded px-1.5 py-0.5 text-xs ${e?.color}`}>{e?.texto}</span>
                            {u.debe_cambiar_contrasena && u.estado_cuenta !== 'baja' && (
                              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600" title="Aún no cambia su contraseña temporal">
                                Contraseña temporal
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {(count ?? 0) > lista.length && <p className="mt-2 text-xs text-slate-500">Se muestran {lista.length} de {count}; afina la búsqueda.</p>}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
