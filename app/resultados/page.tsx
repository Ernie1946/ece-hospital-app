import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { edad, fecha, fechaHora } from '@/lib/formato'
import { COLUMNAS_RESULTADO, ROLES_RESULTADOS, TIPO_RESULTADO, type Resultado } from '@/lib/resultados'
import { registrarExterno } from './acciones'

// ---------------------------------------------------------------------
// Resultados (laboratorio / imagenología / admisión): buscar paciente o
// registrar uno externo, y ver lo subido recientemente.
// ---------------------------------------------------------------------

type Paciente = { id: string; expediente: string; nombre: string; primer_apellido: string; segundo_apellido: string | null; fecha_nacimiento: string | null; sexo: string }

export default async function ResultadosPage({ searchParams }: PageProps<'/resultados'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  if (!ROLES_RESULTADOS.includes(perfil.rol))
    return (
      <>
        <Encabezado perfil={perfil} activo="resultados" />
        <main className="flex-1 bg-slate-100">
          <p className={`${claseTarjeta} mx-auto mt-6 max-w-3xl text-sm text-slate-700`}>
            Esta sección es de laboratorio, imagenología y admisión. Los resultados de tus pacientes aparecen en su expediente.
          </p>
        </main>
      </>
    )
  const { q } = await searchParams
  const busqueda = typeof q === 'string' ? q.trim() : ''
  const supabase = await crearClienteServidor()
  const t = busqueda.replace(/[%,()_]/g, ' ')
  // Sin distinguir acentos: las vocales y la ñ/n se comparan con comodín
  const patron = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[aeioun]/g, '_')
    .replace(/\s+/g, '%')
  const [{ data: pacientes }, { data: recientes }] = await Promise.all([
    busqueda.length >= 2
      ? supabase
          .schema('clinico')
          .from('paciente')
          .select('id, expediente, nombre, primer_apellido, segundo_apellido, fecha_nacimiento, sexo')
          .or(`nombre_busqueda.ilike.%${patron}%,expediente.ilike.%${t}%`)
          .eq('activo', true)
          .is('fusionado_en', null)
          .order('primer_apellido')
          .limit(30)
      : Promise.resolve({ data: [] }),
    supabase.schema('clinico').from('v_resultado').select(COLUMNAS_RESULTADO).order('subido_en', { ascending: false }).limit(30),
  ])
  const lista = (pacientes ?? []) as Paciente[]
  const ultimos = (recientes ?? []) as Resultado[]

  return (
    <>
      <Encabezado perfil={perfil} activo="resultados" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          <h1 className="text-xl font-semibold text-slate-900">Resultados de laboratorio e imagen</h1>

          <section className={claseTarjeta}>
            <form className="flex flex-wrap items-end gap-3">
              <label className={`${claseEtiqueta} flex-1 min-w-64`}>
                Buscar paciente
                <input name="q" defaultValue={busqueda} placeholder="Nombre o número de expediente" className={claseCampo} />
              </label>
              <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Buscar</button>
            </form>
            {busqueda.length >= 2 && (
              <ul className="mt-3 divide-y divide-slate-100 text-sm" aria-label="Pacientes encontrados">
                {lista.length === 0 && <li className="py-2 text-slate-500">Sin coincidencias. Si es un paciente externo nuevo, regístralo abajo.</li>}
                {lista.map((p) => (
                  <li key={p.id} className="py-2">
                    <Link href={`/resultados/paciente/${p.id}`} className="font-medium text-sky-700 hover:underline">
                      {[p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')}
                    </Link>
                    <span className="text-slate-500">
                      {' '}
                      · Exp. {p.expediente} · {p.sexo} · {p.fecha_nacimiento ? `${fecha(p.fecha_nacimiento)} (${edad(p.fecha_nacimiento)} a)` : 'sin fecha de nacimiento'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className={claseTarjeta}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">+ Registrar paciente externo (no internado)</summary>
            <FormAccion accion={registrarExterno} boton="Registrar y continuar" className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className={claseEtiqueta}>
                Nombre(s) *
                <input name="nombre" required className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Primer apellido *
                <input name="primer_apellido" required className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Segundo apellido
                <input name="segundo_apellido" className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Fecha de nacimiento *
                <input name="fecha_nacimiento" type="date" required className={claseCampo} />
              </label>
              <label className={claseEtiqueta}>
                Sexo *
                <select name="sexo" required defaultValue="" className={claseCampo}>
                  <option value="" disabled>
                    Elige…
                  </option>
                  <option value="M">Mujer</option>
                  <option value="H">Hombre</option>
                  <option value="NE">No especificado</option>
                </select>
              </label>
              <label className={claseEtiqueta}>
                Celular (WhatsApp)
                <input name="telefono" inputMode="tel" placeholder="10 dígitos" className={claseCampo} />
              </label>
              <label className={`${claseEtiqueta} sm:col-span-2`}>
                Correo
                <input name="correo" type="email" className={claseCampo} />
              </label>
              <p className="text-xs text-slate-500 sm:col-span-3">
                La fecha de nacimiento es la clave con la que el paciente abrirá sus resultados en línea. Si ya existe un paciente con el mismo nombre y
                fecha de nacimiento, se usa su expediente.
              </p>
            </FormAccion>
          </details>

          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Subidos recientemente</h2>
            {ultimos.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay resultados.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Paciente</th>
                    <th>Estudio</th>
                    <th>Tipo</th>
                    <th>Subido</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimos.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-1.5">
                        <Link href={`/resultados/paciente/${r.paciente_id}`} className="text-sky-700 hover:underline">
                          {r.paciente}
                        </Link>
                      </td>
                      <td>
                        {r.estudio}
                        {r.critico && <span className="ml-1 rounded bg-red-100 px-1 text-xs font-semibold text-red-800">CRÍTICO</span>}
                      </td>
                      <td className="text-slate-600">{TIPO_RESULTADO[r.tipo]}</td>
                      <td className="text-slate-600">{fechaHora(r.subido_en)}</td>
                      <td className="text-xs">
                        {r.anulado ? (
                          <span className="text-slate-500 line-through">Anulado</span>
                        ) : r.entregado_en ? (
                          <span className="text-emerald-800">Enviado al paciente</span>
                        ) : r.encuentro_id ? (
                          <span className="text-sky-800">{r.visto_en ? 'Visto por el médico' : 'En el expediente'}</span>
                        ) : (
                          <span className="text-amber-800">Por entregar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
