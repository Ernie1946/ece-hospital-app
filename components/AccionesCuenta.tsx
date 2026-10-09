'use client'

import { startTransition, useActionState, useState } from 'react'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import type { ResultadoUsuario } from '@/app/personal/acciones'
import { Credenciales } from '@/components/Credenciales'

// Restablecer contraseña y dar de baja / reactivar una cuenta
export function AccionesCuenta({
  activo,
  propia,
  restablecer,
  cambiarEstado,
}: {
  activo: boolean
  propia: boolean
  restablecer: () => Promise<ResultadoUsuario>
  cambiarEstado: (previo: ResultadoUsuario, datos: FormData) => Promise<ResultadoUsuario>
}) {
  const [reset, setReset] = useState<ResultadoUsuario>({})
  const [ocupado, setOcupado] = useState(false)
  const [estado, ejecutar, pendiente] = useActionState(cambiarEstado, {})
  const aviso = (r: ResultadoUsuario) =>
    r.error ? (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {r.error}
      </p>
    ) : r.ok ? (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {r.ok}
      </p>
    ) : null

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-2 print:hidden">
        <h2 className="font-semibold text-slate-800">Contraseña</h2>
        <p className="text-slate-600">Genera una contraseña temporal nueva (por ejemplo, si la persona la olvidó). La anterior deja de funcionar.</p>
        <button
          type="button"
          disabled={ocupado || !activo}
          onClick={async () => {
            setOcupado(true)
            setReset(await restablecer())
            setOcupado(false)
          }}
          className="rounded-lg border border-sky-700 bg-white px-3 py-1.5 font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-50"
        >
          {ocupado ? 'Generando…' : 'Restablecer contraseña'}
        </button>
        {aviso(reset)}
      </div>
      {reset.credencial && <Credenciales lista={[reset.credencial]} />}

      {!propia && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const datos = new FormData(e.currentTarget)
            startTransition(() => ejecutar(datos))
          }}
          className="space-y-2 border-t border-slate-100 pt-3 print:hidden"
        >
          <h2 className="font-semibold text-slate-800">{activo ? 'Dar de baja' : 'Reactivar'}</h2>
          {activo ? (
            <>
              <p className="text-slate-600">La persona deja de entrar de inmediato. Lo que registró en el expediente se conserva con su nombre.</p>
              <label className={claseEtiqueta}>
                Motivo de la baja
                <input name="motivo" required minLength={3} placeholder="Renuncia, fin de contrato, término de rotación…" className={claseCampo} />
              </label>
            </>
          ) : (
            <p className="text-slate-600">La cuenta vuelve a tener acceso con su misma contraseña. Revisa su rol, área y vigencia.</p>
          )}
          <button
            disabled={pendiente}
            className={`rounded-lg px-3 py-1.5 font-medium text-white disabled:opacity-50 ${activo ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}
          >
            {activo ? 'Dar de baja' : 'Reactivar cuenta'}
          </button>
          {aviso(estado)}
        </form>
      )}
    </div>
  )
}
