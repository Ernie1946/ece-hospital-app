'use client'

import { startTransition, useActionState, useState } from 'react'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import type { PacienteBusqueda, ResultadoIngreso } from '@/app/urgencias/acciones'
import { TRIAGE } from '@/lib/urgencias'


// Ingreso a urgencias a cualquier hora: busca o registra al paciente, triage, médico y cubículo
export function IngresoUrgencias({
  accion,
  buscar,
  medicos,
  cubiculos,
}: {
  accion: (previo: ResultadoIngreso | null, datos: FormData) => Promise<ResultadoIngreso>
  buscar: (t: string) => Promise<PacienteBusqueda[]>
  medicos: { id: string; nombre: string }[]
  cubiculos: string[]
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null)
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [sug, setSug] = useState<PacienteBusqueda[]>([])
  const [nivel, setNivel] = useState<number | null>(null)

  if (estado?.encuentro) {
    return (
      <div role="status" className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
        <p className="font-medium">Paciente ingresado a urgencias.</p>
        <p>
          Pulsera <span className="font-mono">{estado.pulsera}</span>.{' '}
          <a href={`/admision/pulsera/${estado.encuentro}`} className="font-medium underline">
            Imprimir pulsera
          </a>{' '}
          ·{' '}
          <a href={`/enfermeria/encuentro/${estado.encuentro}`} className="font-medium underline">
            Abrir hoja
          </a>
        </p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm">
          Ingresar otro paciente
        </button>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
        startTransition(() => ejecutar(datos))
      }}
    >
      {/* 1. Paciente */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800">1. Paciente</legend>
        {paciente ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <strong>{paciente.nombre}</strong>
            <span className="text-slate-500">
              Exp. {paciente.expediente} · {paciente.fecha_nacimiento ?? 'sin fecha de nacimiento'}
            </span>
            <button type="button" onClick={() => setPaciente(null)} className="text-xs text-sky-700 hover:underline">
              Cambiar
            </button>
            <input type="hidden" name="paciente_id" value={paciente.id} />
          </p>
        ) : nuevo ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <label className={claseEtiqueta}>
              Nombre(s)
              <input name="nombre" required className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Primer apellido
              <input name="primer_apellido" required className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Segundo apellido
              <input name="segundo_apellido" className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Sexo
              <select name="sexo" required defaultValue="" className={claseCampo}>
                <option value="">Elegir…</option>
                <option value="H">Hombre</option>
                <option value="M">Mujer</option>
                <option value="NE">No especificado</option>
              </select>
            </label>
            <label className={claseEtiqueta}>
              Fecha de nacimiento <span className="font-normal text-slate-400">(si se conoce)</span>
              <input name="fecha_nacimiento" type="date" className={claseCampo} />
            </label>
            <label className={claseEtiqueta}>
              Teléfono
              <input name="telefono" inputMode="tel" placeholder="10 dígitos" className={claseCampo} />
            </label>
            <p className="text-xs text-slate-500 sm:col-span-3">
              Registro rápido. Admisión completa CURP, póliza y demás datos en su turno.{' '}
              <button type="button" onClick={() => setNuevo(false)} className="text-sky-700 hover:underline">
                Buscar mejor un paciente registrado
              </button>
            </p>
          </div>
        ) : (
          <div className="relative max-w-xl">
            <label className={claseEtiqueta}>
              Busca por nombre, expediente o CURP
              <input
                aria-label="Buscar paciente"
                autoComplete="off"
                className={claseCampo}
                onChange={(e) => {
                  const t = e.target.value
                  if (t.trim().length < 3) return setSug([])
                  buscar(t).then(setSug)
                }}
              />
            </label>
            {sug.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white text-sm shadow">
                {sug.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => (setPaciente(p), setSug([]))} className="w-full px-3 py-1.5 text-left hover:bg-sky-50">
                      {p.nombre} <span className="text-xs text-slate-500">· {p.expediente} · {p.fecha_nacimiento ?? 's/f'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setNuevo(true)} className="mt-2 text-sm font-medium text-sky-700 hover:underline">
              + Paciente nuevo (no está registrado)
            </button>
          </div>
        )}
        {estado?.duplicados && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Posibles expedientes duplicados: si es la misma persona, elígela.</p>
            <ul className="mt-1 space-y-1">
              {estado.duplicados.map((d) => (
                <li key={d.paciente_id}>
                  <button
                    type="button"
                    className="text-left text-sky-800 hover:underline"
                    onClick={() => {
                      setPaciente({ id: d.paciente_id, nombre: d.nombre_completo, expediente: d.expediente, fecha_nacimiento: d.fecha_nacimiento, sexo: '' })
                      setNuevo(false)
                    }}
                  >
                    {d.nombre_completo} · {d.expediente} · {d.fecha_nacimiento ?? 's/f'} ({d.motivo})
                  </button>
                </li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" name="confirmar_nuevo" value="1" /> Es otra persona: registrar como paciente nuevo
            </label>
          </div>
        )}
      </fieldset>

      {/* 2. Triage */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800">2. Triage</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Nivel de triage">
          {TRIAGE.map((t) => (
            <label key={t.nivel} className={`cursor-pointer rounded-lg border-2 px-3 py-1.5 text-sm ${nivel === t.nivel ? `${t.clase} border-slate-900` : 'border-slate-200 bg-white text-slate-700'}`}>
              <input type="radio" name="nivel" value={t.nivel} className="sr-only" onChange={() => setNivel(t.nivel)} />
              <strong>{t.nivel} {t.color}</strong> · {t.texto} <span className="text-xs opacity-80">({t.objetivo})</span>
            </label>
          ))}
        </div>
        <label className={`${claseEtiqueta} max-w-xl`}>
          Motivo de consulta
          <input name="motivo" required placeholder="Dolor torácico de 2 h, disnea…" className={claseCampo} />
        </label>
      </fieldset>

      {/* 3. Médico y cubículo */}
      <fieldset className="grid max-w-xl gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-slate-800">3. Médico y cubículo</legend>
        <label className={claseEtiqueta}>
          Médico que atiende
          <select name="medico" required defaultValue="" className={claseCampo}>
            <option value="">Elegir…</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </label>
        <label className={claseEtiqueta}>
          Cubículo
          <select name="cubiculo" defaultValue="" className={claseCampo}>
            <option value="">Sin cubículo (sala de espera)</option>
            {cubiculos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </fieldset>

      {estado?.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      <button type="submit" disabled={pendiente || (!paciente && !nuevo)} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60">
        {pendiente ? 'Ingresando…' : 'Ingresar a urgencias e imprimir pulsera'}
      </button>
    </form>
  )
}
