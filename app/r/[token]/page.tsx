import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { crearClienteServidor } from '@/lib/supabase/server'
import { AbrirResultados } from '@/components/AbrirResultados'
import { fecha } from '@/lib/formato'
import { TIPO_RESULTADO } from '@/lib/resultados'
import { abrirResultados, cerrarResultados } from './acciones'

export const metadata: Metadata = { title: 'Sus resultados', robots: { index: false, follow: false } }

type Fila = { paciente: string; expira_en: string; resultado_id: string; tipo: string; estudio: string; realizado_en: string }

// Página pública: el paciente externo consulta sus resultados con el enlace y su fecha de nacimiento
export default async function ResultadosPacientePublicoPage({ params }: PageProps<'/r/[token]'>) {
  const { token } = await params
  const hospital = process.env.HOSPITAL_NOMBRE ?? 'Resultados en línea'
  const sesion = (await cookies()).get('resultados_sesion')?.value
  let filas: Fila[] = []
  if (sesion) {
    const supabase = await crearClienteServidor()
    const { data } = await supabase.rpc('resultados_de_entrega', { p_token: token, p_sesion: sesion })
    filas = (data ?? []) as Fila[]
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm text-slate-500">{hospital}</p>
          <h1 className="text-xl font-semibold text-slate-900">Sus resultados</h1>
        </div>
        {filas.length === 0 ? (
          <AbrirResultados accion={abrirResultados.bind(null, token)} />
        ) : (
          <>
            <p className="text-sm text-slate-700">
              <strong>{filas[0].paciente}</strong>
            </p>
            <ul className="divide-y divide-slate-100" aria-label="Resultados">
              {filas.map((f) => (
                <li key={f.resultado_id} className="py-3">
                  <a href={`/r/${token}/${f.resultado_id}`} target="_blank" rel="noopener" className="text-base font-medium text-sky-700 underline">
                    {f.estudio}
                  </a>
                  <p className="text-sm text-slate-500">
                    {TIPO_RESULTADO[f.tipo]} · {fecha(f.realizado_en)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              Este enlace vence el {fecha(f_vence(filas[0].expira_en))}. Sus resultados son confidenciales: no comparta este enlace. Ante cualquier duda,
              consulte a su médico.
            </p>
            <form action={cerrarResultados.bind(null, token)}>
              <button className="text-sm text-sky-700 underline">Salir</button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

const f_vence = (t: string) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })
