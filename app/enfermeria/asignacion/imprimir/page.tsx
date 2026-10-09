import { obtenerPerfil } from '@/lib/perfil'
import { SinAlta } from '@/components/SinAlta'
import { BotonImprimir } from '@/components/BotonImprimir'
import { fechaHora } from '@/lib/formato'
import { fechaLarga } from '@/lib/turnos'
import { datosAsignacion } from '../datos'

// Rol de asignación imprimible (sustituye la hoja de Excel de jefatura)
export default async function ImprimirAsignacionPage({ searchParams }: PageProps<'/enfermeria/asignacion/imprimir'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const d = await datosAsignacion(await searchParams, perfil.area_id)

  // Por área: cada enfermera con sus camas y pacientes
  const porGrupo = new Map<string, Map<string, { camas: string[]; pacientes: number }>>()
  const sinEnfermera = new Map<string, string[]>()
  for (const c of d.camas) {
    const a = d.asignaciones[c.cama]
    if (!a) {
      if (c.paciente) sinEnfermera.set(c.grupo, [...(sinEnfermera.get(c.grupo) ?? []), c.cama])
      continue
    }
    const g = porGrupo.get(c.grupo) ?? new Map()
    const x = g.get(a.enfermera) ?? { camas: [], pacientes: 0 }
    x.camas.push(c.cama)
    if (c.paciente) x.pacientes++
    g.set(a.enfermera, x)
    porGrupo.set(c.grupo, g)
  }
  const grupos = [...new Set(d.camas.map((c) => c.grupo))]

  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-sm text-slate-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Rol de asignación de enfermería</h1>
          <p>
            {d.turno?.nombre} · {fechaLarga(d.fecha)} · {d.area?.nombre ?? 'Todo el hospital'}
          </p>
          <p className="text-xs text-slate-500">Impreso {fechaHora(new Date().toISOString())}</p>
        </div>
        <BotonImprimir />
      </div>
      {grupos.map((g) => {
        const filas = [...(porGrupo.get(g) ?? new Map()).entries()]
        return (
          <section key={g} className="mb-4 break-inside-avoid">
            <h2 className="mb-1 border-b border-slate-400 font-semibold">{g}</h2>
            {filas.length === 0 ? (
              <p className="text-slate-500">Sin asignación.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-1/3 py-1">Enfermera</th>
                    <th>Camas</th>
                    <th className="w-24 text-right">Pacientes</th>
                    <th className="w-32">Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(([nombre, x]) => (
                    <tr key={nombre} className="border-t border-slate-200">
                      <td className="py-1.5">{nombre}</td>
                      <td>{x.camas.join(', ')}</td>
                      <td className="text-right">{x.pacientes}</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sinEnfermera.get(g) && <p className="mt-1 font-medium text-red-800">Pacientes sin enfermera: {sinEnfermera.get(g)!.join(', ')}</p>}
          </section>
        )
      })}
      <p className="mt-6 text-xs text-slate-500">Jefatura de Enfermería: ______________________________</p>
    </main>
  )
}
