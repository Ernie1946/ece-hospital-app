'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'

export function CambiarContrasena({ nombre, usuario, obligatoria }: { nombre: string; usuario: string; obligatoria: boolean }) {
  const router = useRouter()
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (nueva.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (!/[a-zA-Z]/.test(nueva) || !/\d/.test(nueva)) return setError('Usa letras y números.')
    if (nueva.toLowerCase().includes(usuario.toLowerCase())) return setError('La contraseña no debe contener tu usuario.')
    if (nueva !== repetir) return setError('Las dos contraseñas no coinciden.')
    setEnviando(true)
    const supabase = crearClienteNavegador()
    const { error: e1 } = await supabase.auth.updateUser({ password: nueva })
    if (e1) {
      setEnviando(false)
      return setError(e1.message.includes('different from the old') ? 'La contraseña nueva debe ser distinta de la anterior.' : e1.message)
    }
    await supabase.schema('seguridad').rpc('contrasena_cambiada')
    router.replace('/?contrasena=cambiada')
    router.refresh()
  }

  return (
    <form onSubmit={guardar} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{obligatoria ? 'Crea tu contraseña' : 'Cambiar contraseña'}</h1>
        <p className="text-sm text-slate-500">
          {nombre} · usuario <span className="font-mono">{usuario}</span>
        </p>
        {obligatoria && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Entraste con una contraseña temporal. Antes de continuar, crea una propia: solo tú debes conocerla.
          </p>
        )}
      </div>
      <label className={claseEtiqueta}>
        Contraseña nueva
        <input type="password" autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} className={claseCampo} />
      </label>
      <label className={claseEtiqueta}>
        Repite la contraseña nueva
        <input type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} className={claseCampo} />
      </label>
      <p className="text-xs text-slate-500">Mínimo 8 caracteres, con letras y números.</p>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={enviando} className="w-full rounded-lg bg-sky-700 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60">
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
      {!obligatoria && (
        <Link href="/" className="block text-center text-sm text-sky-700 hover:underline">
          Cancelar
        </Link>
      )}
    </form>
  )
}
