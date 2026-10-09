'use client'

import { startTransition, useActionState, useState } from 'react'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { ETIQUETA_ROL } from '@/lib/roles'
import { CON_VIGENCIA, SOLICITANTES, VINCULOS } from '@/lib/personal'
import type { ResultadoUsuario } from '@/app/personal/acciones'
import { Credenciales } from '@/components/Credenciales'

export type DatosUsuario = {
  usuario: string
  nombre: string
  primer_apellido: string
  segundo_apellido: string | null
  rol: string
  vinculo: string
  vigencia_hasta: string | null
  area: string | null
  servicio: string | null
  cedula_profesional: string | null
  especialidad: string | null
  cedula_especialidad: string | null
  correo: string | null
  solicitado_por: string | null
  folio_solicitud: string | null
}

type Opcion = { clave: string; nombre: string }

// Alta individual o modificación de un usuario
export function FormUsuario({
  accion,
  inicial,
  areas,
  servicios,
}: {
  accion: (previo: ResultadoUsuario, datos: FormData) => Promise<ResultadoUsuario>
  inicial: DatosUsuario | null
  areas: Opcion[]
  servicios: Opcion[]
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, {})
  const [vinculo, setVinculo] = useState(inicial?.vinculo ?? 'empleado')
  const [rol, setRol] = useState(inicial?.rol ?? '')
  const firma = ['medico_tratante', 'medico_residente', 'anestesiologo', 'enfermeria'].includes(rol)
  const editar = inicial !== null

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const datos = new FormData(e.currentTarget)
          startTransition(() => ejecutar(datos))
        }}
        className="space-y-3 print:hidden"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={claseEtiqueta}>
            Usuario *
            <input
              name="usuario"
              required
              defaultValue={inicial?.usuario}
              readOnly={editar}
              placeholder="Número de empleado o credencial"
              className={`${claseCampo} font-mono ${editar ? 'bg-slate-100' : ''}`}
            />
          </label>
          <label className={claseEtiqueta}>
            Rol *
            <select name="rol" required value={rol} onChange={(e) => setRol(e.target.value)} className={claseCampo}>
              <option value="">Elige…</option>
              {Object.entries(ETIQUETA_ROL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Vínculo con el hospital
            <select name="vinculo" value={vinculo} onChange={(e) => setVinculo(e.target.value)} className={claseCampo}>
              {Object.entries(VINCULOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Nombre(s) *
            <input name="nombre" required defaultValue={inicial?.nombre} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Primer apellido *
            <input name="primer_apellido" required defaultValue={inicial?.primer_apellido} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Segundo apellido
            <input name="segundo_apellido" defaultValue={inicial?.segundo_apellido ?? ''} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Vigencia hasta {CON_VIGENCIA.includes(vinculo) ? '*' : ''}
            <input name="vigencia_hasta" type="date" required={CON_VIGENCIA.includes(vinculo)} defaultValue={inicial?.vigencia_hasta ?? ''} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Área base (enfermería)
            <select name="area" defaultValue={inicial?.area ?? ''} className={claseCampo}>
              <option value="">Sin área</option>
              {areas.map((a) => (
                <option key={a.clave} value={a.clave}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Servicio (médicos)
            <select name="servicio" defaultValue={inicial?.servicio ?? ''} className={claseCampo}>
              <option value="">Sin servicio</option>
              {servicios.map((s) => (
                <option key={s.clave} value={s.clave}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Cédula profesional {firma ? '*' : ''}
            <input name="cedula_profesional" required={firma} defaultValue={inicial?.cedula_profesional ?? ''} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Especialidad
            <input name="especialidad" defaultValue={inicial?.especialidad ?? ''} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Cédula de especialidad
            <input name="cedula_especialidad" defaultValue={inicial?.cedula_especialidad ?? ''} className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Correo (opcional)
            <input name="correo" type="email" defaultValue={inicial?.correo ?? ''} placeholder="nombre@hospital.mx" className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Solicitado por {editar ? '' : '*'}
            <select name="solicitado_por" required={!editar} defaultValue={inicial?.solicitado_por ?? ''} className={claseCampo}>
              <option value="">{editar ? 'Sin cambio' : 'Elige…'}</option>
              {Object.entries(SOLICITANTES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className={claseEtiqueta}>
            Folio de solicitud
            <input name="folio_solicitud" defaultValue={inicial?.folio_solicitud ?? ''} placeholder="Oficio o número de solicitud" className={claseCampo} />
          </label>
        </div>
        {estado.error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {estado.ok}
          </p>
        )}
        <button disabled={pendiente} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50">
          {pendiente ? 'Guardando…' : editar ? 'Guardar cambios' : 'Dar de alta y generar contraseña'}
        </button>
      </form>
      {estado.credencial && <Credenciales lista={[estado.credencial]} />}
    </div>
  )
}
