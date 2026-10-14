import { crearClienteServidor } from '@/lib/supabase/server'
import { FormAccion } from '@/components/FormAccion'
import { BotonAccion } from '@/components/BotonAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { fecha } from '@/lib/formato'
import {
  AUTORIZADO_POR,
  ESTADO_PRIVILEGIO,
  GRUPO_PRIVILEGIO,
  TIPO_ESPECIALIDAD,
  type Especialidad,
  type Privilegio,
  type PrivilegioMedico,
} from '@/lib/privilegios'
import { agregarEspecialidad, otorgarPrivilegios, quitarEspecialidad, revocarPrivilegio } from '@/app/personal/privilegios/acciones'

// Ficha de Personal: especialidades y privilegios clínicos del médico (los captura Sistemas)
export async function PrivilegiosMedico({ usuarioId, rol }: { usuarioId: string; rol: string }) {
  const supabase = await crearClienteServidor()
  const [{ data: cat }, { data: pr }, { data: es }] = await Promise.all([
    supabase.schema('catalogo').from('privilegio').select('clave, nombre, grupo, cie9_rangos, descripcion').eq('activo', true).order('orden'),
    supabase.schema('seguridad').from('v_usuario_privilegio').select('*').eq('usuario_id', usuarioId).order('otorgado_en', { ascending: false }),
    supabase.schema('seguridad').from('usuario_especialidad').select('*').eq('usuario_id', usuarioId).order('registrado_en'),
  ])
  const catalogo = (cat ?? []) as Privilegio[]
  const privilegios = (pr ?? []) as PrivilegioMedico[]
  const especialidades = (es ?? []) as Especialidad[]
  const activos = new Set(privilegios.filter((p) => !p.revocado_en).map((p) => p.clave))
  const puedePrivilegios = ['medico_tratante', 'anestesiologo'].includes(rol)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chihuahua' })

  return (
    <>
      <section className={`${claseTarjeta} print:hidden`} aria-label="Especialidades">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Especialidades y subespecialidades</h2>
        {especialidades.length === 0 ? (
          <p className="text-sm text-slate-500">Sin registrar (la especialidad principal está en Datos).</p>
        ) : (
          <ul className="text-sm">
            {especialidades.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-0.5">
                <span>
                  {TIPO_ESPECIALIDAD[e.tipo]}: <strong>{e.nombre}</strong>
                  {e.cedula ? ` · Céd. ${e.cedula}` : ''}
                  {e.institucion ? ` · ${e.institucion}` : ''}
                </span>
                <BotonAccion etiqueta="Quitar" variante="secundario" confirmar="¿Quitar esta especialidad?" alHacer={quitarEspecialidad.bind(null, e.id, usuarioId)} />
              </li>
            ))}
          </ul>
        )}
        <FormAccion accion={agregarEspecialidad.bind(null, usuarioId)} boton="Agregar especialidad" variante="secundario" className="mt-3 grid gap-2 sm:grid-cols-4">
          <label className={claseEtiqueta}>
            Tipo
            <select name="tipo" defaultValue="subespecialidad" className={claseCampo}>
              {Object.entries(TIPO_ESPECIALIDAD).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Nombre
            <input name="nombre" required placeholder="Cardiología intervencionista" className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Cédula
            <input name="cedula" className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Institución
            <input name="institucion" className={claseCampo} />
          </label>
        </FormAccion>
      </section>

      {puedePrivilegios && (
        <section className={`${claseTarjeta} print:hidden`} aria-label="Privilegios clínicos">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Privilegios clínicos</h2>
          <p className="mb-2 text-xs text-slate-500">
            Captura aquí lo que ratificaron Dirección Médica y el Comité de Credenciales. Sin privilegios el médico atiende a sus pacientes internados, pero
            no opera, no es responsable en hemodinamia ni entra a hemodiálisis o gabinetes.
          </p>
          {privilegios.length === 0 ? (
            <p className="text-sm text-slate-500">Sin privilegios.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {privilegios.map((p) => (
                <li key={p.id} className={`py-1.5 ${p.revocado_en ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <span className="text-slate-500">{GRUPO_PRIVILEGIO[p.grupo]} · </span>
                      <strong>{p.privilegio}</strong>
                      {p.cie9_rangos && <span className="text-xs text-slate-500"> (CIE-9-MC {p.cie9_rangos})</span>}
                      {p.restricciones && <span className="text-amber-800"> · {p.restricciones}</span>}
                    </span>
                    <span className={`rounded px-1.5 text-xs ${ESTADO_PRIVILEGIO[p.estado]?.color}`}>{ESTADO_PRIVILEGIO[p.estado]?.texto}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {AUTORIZADO_POR[p.autorizado_por]} · acta {p.acta} del {fecha(p.fecha_autorizacion)}
                    {p.vigencia_hasta ? ` · vigente hasta ${fecha(p.vigencia_hasta)}` : ' · sin fecha de vencimiento'} · capturó {p.otorgado_por_nombre}
                    {p.revocado_en ? ` · revocado ${fecha(p.revocado_en)}: ${p.motivo_revocacion}` : ''}
                  </p>
                  {!p.revocado_en && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-red-700">Revocar</summary>
                      <FormAccion accion={revocarPrivilegio.bind(null, p.id, usuarioId)} boton="Revocar privilegio" variante="secundario" className="mt-1 flex flex-wrap items-end gap-2">
                        <label className={`${claseEtiqueta} flex-1`}>
                          Motivo
                          <input name="motivo" required placeholder="Renovación, acuerdo del comité…" className={claseCampo} />
                        </label>
                      </FormAccion>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}

          <details className="mt-3" open={privilegios.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-sky-700">+ Registrar privilegios ratificados</summary>
            <FormAccion accion={otorgarPrivilegios.bind(null, usuarioId)} boton="Registrar privilegios" className="mt-2 space-y-3">
              {Object.entries(GRUPO_PRIVILEGIO).map(([g, titulo]) => {
                const delGrupo = catalogo.filter((c) => c.grupo === g && !activos.has(c.clave))
                if (delGrupo.length === 0) return null
                return (
                  <fieldset key={g}>
                    <legend className="text-xs font-semibold uppercase text-slate-500">{titulo}</legend>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {delGrupo.map((c) => (
                        <label key={c.clave} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" name="privilegio" value={c.clave} className="mt-1" />
                          <span>
                            {c.nombre}
                            {c.cie9_rangos && <span className="text-xs text-slate-500"> · CIE-9-MC {c.cie9_rangos}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )
              })}
              <div className="grid gap-2 sm:grid-cols-4">
                <label className={claseEtiqueta}>
                  Autorizó *
                  <select name="autorizado_por" required defaultValue="ambos" className={claseCampo}>
                    {Object.entries(AUTORIZADO_POR).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={claseEtiqueta}>
                  Acta u oficio *
                  <input name="acta" required placeholder="CC-2026-014" className={claseCampo} />
                </label>
                <label className={claseEtiqueta}>
                  Fecha de autorización *
                  <input name="fecha" type="date" required max={hoy} defaultValue={hoy} className={claseCampo} />
                </label>
                <label className={claseEtiqueta}>
                  Vigente hasta
                  <input name="vigencia" type="date" className={claseCampo} />
                </label>
                <label className={`${claseEtiqueta} sm:col-span-4`}>
                  Restricciones o condiciones
                  <input name="restricciones" placeholder="Bajo supervisión los primeros 6 meses, solo adultos…" className={claseCampo} />
                </label>
              </div>
            </FormAccion>
          </details>
        </section>
      )}
    </>
  )
}
