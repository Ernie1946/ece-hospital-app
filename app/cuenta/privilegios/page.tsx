import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { claseTarjeta } from '@/lib/estilos'
import { fecha } from '@/lib/formato'
import { AUTORIZADO_POR, ESTADO_PRIVILEGIO, GRUPO_PRIVILEGIO, TIPO_ESPECIALIDAD, type Especialidad, type PrivilegioMedico } from '@/lib/privilegios'

// El médico consulta sus especialidades y los privilegios que le ratificó el hospital
export default async function MisPrivilegiosPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const supabase = await crearClienteServidor()
  const [{ data: pr }, { data: es }] = await Promise.all([
    supabase.schema('seguridad').from('v_usuario_privilegio').select('*').eq('usuario_id', perfil.id).order('grupo').order('privilegio'),
    supabase.schema('seguridad').from('usuario_especialidad').select('*').eq('usuario_id', perfil.id).order('tipo'),
  ])
  const privilegios = ((pr ?? []) as PrivilegioMedico[]).filter((p) => p.estado !== 'revocado')
  const especialidades = (es ?? []) as Especialidad[]

  return (
    <>
      <Encabezado perfil={perfil} activo="medicos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <h1 className="text-xl font-semibold text-slate-900">Mis privilegios clínicos</h1>
          <section className={claseTarjeta}>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Especialidades</h2>
            {especialidades.length === 0 ? (
              <p className="text-sm text-slate-500">Sin especialidades registradas.</p>
            ) : (
              <ul className="text-sm">
                {especialidades.map((e) => (
                  <li key={e.id}>
                    {TIPO_ESPECIALIDAD[e.tipo]}: <strong>{e.nombre}</strong>
                    {e.cedula ? ` · Céd. ${e.cedula}` : ''}
                    {e.institucion ? ` · ${e.institucion}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={claseTarjeta} aria-label="Privilegios">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Privilegios</h2>
            {privilegios.length === 0 ? (
              <p className="text-sm text-slate-600">
                Aún no tienes privilegios registrados. Siempre puedes atender a tus pacientes internados; para operar, entrar a hemodinamia, hemodiálisis o
                gabinetes, solicítalos a Dirección Médica con tus credenciales.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {privilegios.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span>
                      <span className="text-slate-500">{GRUPO_PRIVILEGIO[p.grupo]} · </span>
                      <strong>{p.privilegio}</strong>
                      {p.restricciones ? <span className="text-amber-800"> · {p.restricciones}</span> : ''}
                    </span>
                    <span className="text-xs text-slate-600">
                      {AUTORIZADO_POR[p.autorizado_por]} · acta {p.acta} · {fecha(p.fecha_autorizacion)}
                      {p.vigencia_hasta ? ` · vence ${fecha(p.vigencia_hasta)}` : ''}{' '}
                      <span className={`rounded px-1 ${ESTADO_PRIVILEGIO[p.estado]?.color}`}>{ESTADO_PRIVILEGIO[p.estado]?.texto}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">Para agregar o renovar privilegios, solicítalo a Dirección Médica; Sistemas los registra cuando el comité los ratifica.</p>
          </section>
        </div>
      </main>
    </>
  )
}
