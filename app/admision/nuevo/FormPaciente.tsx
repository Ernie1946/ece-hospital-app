'use client'

import Link from 'next/link'
import { startTransition, useActionState } from 'react'
import { crearPaciente, type ResultadoPaciente } from '../acciones'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { fecha } from '@/lib/formato'

export function FormPaciente() {
  const [estado, ejecutar, pendiente] = useActionState<ResultadoPaciente, FormData>(crearPaciente, null)
  return (
    // El botón "No es ninguno…" envía confirmar_nuevo=1; el botón normal no lo envía.
    // Se envía a mano para que React no limpie lo capturado si hay duplicados o error.
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
        startTransition(() => ejecutar(datos))
      }}
      className="space-y-4"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <label className={claseEtiqueta}>
          Nombre(s) *
          <input name="nombre" required className={claseCampo} autoComplete="off" />
        </label>
        <label className={claseEtiqueta}>
          Primer apellido *
          <input name="primer_apellido" required className={claseCampo} autoComplete="off" />
        </label>
        <label className={claseEtiqueta}>
          Segundo apellido
          <input name="segundo_apellido" className={claseCampo} autoComplete="off" />
        </label>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <label className={claseEtiqueta}>
          Sexo *
          <select name="sexo" required defaultValue="" className={claseCampo}>
            <option value="" disabled>Elegir…</option>
            <option value="M">Mujer</option>
            <option value="H">Hombre</option>
            <option value="NE">No especificado</option>
          </select>
        </label>
        <label className={claseEtiqueta}>
          Fecha de nacimiento
          <input name="fecha_nacimiento" type="date" className={claseCampo} />
        </label>
        <label className={`${claseEtiqueta} sm:col-span-2`}>
          CURP
          <input
            name="curp"
            maxLength={18}
            className={`${claseCampo} uppercase font-mono`}
            autoComplete="off"
            placeholder="18 caracteres"
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className={claseEtiqueta}>
          Tipo de sangre
          <select name="tipo_sangre" defaultValue="" className={claseCampo}>
            <option value="">Desconocido</option>
            {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className={claseEtiqueta}>
          Teléfono
          <input name="telefono" type="tel" className={claseCampo} />
        </label>
        <label className={claseEtiqueta}>
          Correo
          <input name="correo" type="email" className={claseCampo} />
        </label>
      </div>

      {estado?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {estado.error}
        </p>
      )}

      {estado?.duplicados && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-900">
            Posibles expedientes duplicados. Revisa antes de registrar:
          </p>
          <ul className="text-sm space-y-1">
            {estado.duplicados.map((d) => (
              <li key={d.paciente_id}>
                <Link href={`/admision/paciente/${d.paciente_id}`} className="text-sky-800 underline">
                  {d.expediente} — <span className="capitalize">{d.nombre_completo}</span>
                </Link>{' '}
                <span className="text-slate-600">
                  (nac. {fecha(d.fecha_nacimiento)} · {d.motivo})
                </span>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            name="confirmar_nuevo"
            value="1"
            disabled={pendiente}
            className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
          >
            No es ninguno: registrar paciente nuevo
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-sky-700 text-white text-sm font-medium px-4 py-2 hover:bg-sky-800 disabled:opacity-60"
        >
          {pendiente ? 'Revisando…' : 'Registrar paciente'}
        </button>
        <Link href="/admision" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
