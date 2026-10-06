'use client'

import { useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { TURNOS } from '@/lib/clinica'
import { ESCALA_RESULTADO, TIPO_DX, type DiagnosticoEnf, type EvaluacionPlan, type PlanCuidado } from '@/lib/cuidados'

type Accion = (previo: Resultado, datos: FormData) => Promise<Resultado>
type Evaluacion = EvaluacionPlan & { nombre: string }

const DEFAULTS: Record<string, [number, number]> = { real: [2, 4], riesgo: [4, 5], promocion: [3, 5] }
const hora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Chihuahua', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })

// Planes de cuidados del paciente: sugerencias por escalas, alta de plan,
// evaluación por turno con puntuación 1-5 e intervenciones realizadas, y cierre.
export function PlanCuidados({
  catalogo,
  planes,
  evaluaciones,
  sugeridos,
  turnoInicial,
  puedeRegistrar,
  crear,
  evaluar,
  cerrar,
}: {
  catalogo: DiagnosticoEnf[]
  planes: PlanCuidado[]
  evaluaciones: Evaluacion[]
  sugeridos: { diagnostico: DiagnosticoEnf; origen: string }[]
  turnoInicial: string
  puedeRegistrar: boolean
  crear: Accion
  evaluar: Record<string, Accion>
  cerrar: Record<string, Accion>
}) {
  const [elegido, setElegido] = useState<{ dx: DiagnosticoEnf; origen: string } | null>(null)
  const activos = planes.filter((p) => p.estado === 'activo')
  const cerrados = planes.filter((p) => p.estado !== 'activo')

  return (
    <div className="space-y-3">
      {puedeRegistrar && sugeridos.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
          <p className="text-xs font-semibold uppercase">Sugeridos por las escalas y signos</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {sugeridos.map((s) => (
              <button
                key={s.diagnostico.id}
                type="button"
                onClick={() => setElegido({ dx: s.diagnostico, origen: s.origen })}
                className="rounded-full border border-amber-400 bg-white px-3 py-1 text-sm hover:bg-amber-100"
              >
                {s.origen} → <strong>{s.diagnostico.etiqueta}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {activos.length === 0 && <p className="text-sm text-slate-500">Sin planes de cuidados activos.</p>}
      {activos.map((p) => (
        <TarjetaPlan
          key={p.id}
          plan={p}
          evaluaciones={evaluaciones.filter((e) => e.plan_id === p.id)}
          turnoInicial={turnoInicial}
          puedeRegistrar={puedeRegistrar}
          evaluar={evaluar[p.id]}
          cerrar={cerrar[p.id]}
        />
      ))}

      {puedeRegistrar && (
        <NuevoPlan
          key={elegido ? `${elegido.dx.id}-${elegido.origen}` : 'nuevo'}
          catalogo={catalogo.filter((d) => !activos.some((p) => p.diagnostico_id === d.id))}
          inicial={elegido}
          crear={crear}
          alGuardar={() => setElegido(null)}
        />
      )}

      {cerrados.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">Planes cerrados ({cerrados.length})</summary>
          <ul className="mt-1 space-y-1">
            {cerrados.map((p) => (
              <li key={p.id} className="text-slate-700">
                <span className={`mr-1 rounded px-1 text-xs ${p.estado === 'resuelto' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>
                  {p.estado === 'resuelto' ? 'Resuelto' : 'Suspendido'}
                </span>
                {p.etiqueta} · {p.cerrado_en ? hora(p.cerrado_en) : ''} · {p.motivo_cierre}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function TarjetaPlan({
  plan,
  evaluaciones,
  turnoInicial,
  puedeRegistrar,
  evaluar,
  cerrar,
}: {
  plan: PlanCuidado
  evaluaciones: Evaluacion[]
  turnoInicial: string
  puedeRegistrar: boolean
  evaluar: Accion
  cerrar: Accion
}) {
  const [puntuacion, setPuntuacion] = useState<number | null>(null)
  const ultima = evaluaciones[evaluaciones.length - 1]
  const actual = ultima?.puntuacion ?? plan.puntuacion_inicial
  const alcanzada = actual >= plan.meta

  return (
    <article className="rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{plan.etiqueta}</h3>
        <span className="flex flex-wrap gap-1 text-xs">
          {plan.origen && <span className="rounded bg-amber-100 px-1 text-amber-900">Por {plan.origen}</span>}
          <span className={`rounded px-1 ${alcanzada ? 'bg-emerald-100 text-emerald-900' : 'bg-sky-100 text-sky-900'}`}>
            Resultado {actual}/5 · meta {plan.meta}
            {alcanzada ? ' ✓' : ''}
          </span>
        </span>
      </div>
      {plan.relacionado_con && (
        <p className="text-slate-700">
          <span className="font-medium">Relacionado con:</span> {plan.relacionado_con}
        </p>
      )}
      {plan.manifestado_por && (
        <p className="text-slate-700">
          <span className="font-medium">Manifestado por:</span> {plan.manifestado_por}
        </p>
      )}
      <p className="text-slate-700">
        <span className="font-medium">Resultado esperado:</span> {plan.resultado_esperado} (inicial {plan.puntuacion_inicial} → meta {plan.meta})
      </p>
      {evaluaciones.length > 0 && (
        <ol className="mt-1 space-y-0.5 text-xs text-slate-600">
          {evaluaciones.slice(-4).map((e) => (
            <li key={e.id}>
              {hora(e.registrado_en)} · {e.turno} · <strong>{e.puntuacion}</strong> {ESCALA_RESULTADO[e.puntuacion]} · {e.intervenciones_hechas.length}/
              {plan.intervenciones.length} intervenciones · {e.nombre}
              {e.nota ? ` · ${e.nota}` : ''}
            </li>
          ))}
        </ol>
      )}

      {puedeRegistrar ? (
        <FormAccion accion={evaluar} boton="Registrar evaluación del turno" alGuardar={() => setPuntuacion(null)} className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-slate-500">Intervenciones realizadas</legend>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {plan.intervenciones.map((i) => (
                <label key={i} className="flex items-start gap-2">
                  <input type="checkbox" name="hechas" value={i} className="mt-0.5" />
                  <span>{i}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-slate-500">Resultado en este turno</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  title={ESCALA_RESULTADO[n]}
                  className={`cursor-pointer rounded-lg border px-2 py-1 text-xs ${
                    puntuacion === n ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <input type="radio" name="puntuacion" value={n} checked={puntuacion === n} onChange={() => setPuntuacion(n)} className="sr-only" />
                  <strong>{n}</strong> · {ESCALA_RESULTADO[n]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-xs text-slate-600">
              Turno
              <select name="turno" defaultValue={turnoInicial} className={claseCampo}>
                {TURNOS.map((t) => (
                  <option key={t.clave} value={t.clave}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600 sm:col-span-2">
              Nota de evolución del plan
              <input name="nota" aria-label={`Nota del plan ${plan.etiqueta}`} className={claseCampo} />
            </label>
          </div>
        </FormAccion>
      ) : null}

      {puedeRegistrar && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-slate-600">Cerrar plan</summary>
          <FormAccion accion={cerrar} boton="Cerrar plan" variante="secundario" className="mt-1 flex flex-wrap items-end gap-2">
            <label className="block text-xs text-slate-600">
              Cierre
              <select name="estado" defaultValue="resuelto" className={claseCampo}>
                <option value="resuelto">Resuelto (se alcanzó la meta)</option>
                <option value="suspendido">Suspendido (ya no aplica)</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              Motivo
              <input name="motivo" required aria-label={`Motivo de cierre de ${plan.etiqueta}`} className={claseCampo} />
            </label>
          </FormAccion>
        </details>
      )}
    </article>
  )
}

function NuevoPlan({
  catalogo,
  inicial,
  crear,
  alGuardar,
}: {
  catalogo: DiagnosticoEnf[]
  inicial: { dx: DiagnosticoEnf; origen: string } | null
  crear: Accion
  alGuardar: () => void
}) {
  const [dx, setDx] = useState<DiagnosticoEnf | null>(inicial?.dx ?? null)
  const [resultado, setResultado] = useState(inicial?.dx.resultado_esperado ?? '')
  const [intervenciones, setIntervenciones] = useState((inicial?.dx.intervenciones ?? []).join('\n'))
  const [ini, meta] = DEFAULTS[dx?.tipo ?? 'real']

  const elegir = (id: string) => {
    const d = catalogo.find((x) => String(x.id) === id) ?? null
    setDx(d)
    setResultado(d?.resultado_esperado ?? '')
    setIntervenciones((d?.intervenciones ?? []).join('\n'))
  }
  const dominios = [...new Set(catalogo.map((d) => d.dominio ?? 'Otros'))]

  return (
    <details open={!!inicial} className="rounded-lg border border-dashed border-slate-300 p-2">
      <summary className="cursor-pointer text-sm font-medium text-sky-800">+ Nuevo plan de cuidados</summary>
      <FormAccion
        accion={crear}
        boton="Iniciar plan de cuidados"
        alGuardar={() => {
          setDx(null)
          setResultado('')
          setIntervenciones('')
          alGuardar()
        }}
        className="mt-2 space-y-2"
      >
        <input type="hidden" name="origen" value={inicial?.origen ?? ''} />
        <label className={claseEtiqueta}>
          Diagnóstico de enfermería
          <select name="diagnostico" value={dx ? String(dx.id) : ''} onChange={(e) => elegir(e.target.value)} required className={claseCampo}>
            <option value="">Elige…</option>
            {dominios.map((dom) => (
              <optgroup key={dom} label={dom}>
                {catalogo
                  .filter((d) => (d.dominio ?? 'Otros') === dom)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.etiqueta} ({TIPO_DX[d.tipo]})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {dx && (
          <div key={dx.id} className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={claseEtiqueta}>
                {dx.tipo === 'riesgo' ? 'Factores de riesgo' : 'Relacionado con'}
                <input name="relacionado_con" placeholder={dx.tipo === 'riesgo' ? 'Edad, sedación, deambulación inestable…' : 'Causa o factor relacionado'} className={claseCampo} />
              </label>
              {dx.tipo === 'real' && (
                <label className={claseEtiqueta}>
                  Manifestado por *
                  <input name="manifestado_por" required placeholder="Lo que observas o refiere el paciente" className={claseCampo} />
                </label>
              )}
            </div>
            <label className={claseEtiqueta}>
              Resultado esperado *
              <input name="resultado_esperado" value={resultado} onChange={(e) => setResultado(e.target.value)} required className={claseCampo} />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:max-w-md">
              <label className={claseEtiqueta}>
                Puntuación inicial
                <select name="puntuacion_inicial" defaultValue={ini} className={claseCampo}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} · {ESCALA_RESULTADO[n]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={claseEtiqueta}>
                Meta
                <select name="meta" defaultValue={meta} className={claseCampo}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} · {ESCALA_RESULTADO[n]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={claseEtiqueta}>
              Intervenciones <span className="font-normal text-slate-400">(una por renglón; puedes editarlas)</span>
              <textarea name="intervenciones" rows={6} value={intervenciones} onChange={(e) => setIntervenciones(e.target.value)} className={claseCampo} />
            </label>
          </div>
        )}
      </FormAccion>
    </details>
  )
}
