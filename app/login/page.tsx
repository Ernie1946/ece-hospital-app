'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { DOMINIO_USUARIOS } from '@/lib/personal'

export default function LoginPage() {
  const router = useRouter()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function iniciarSesion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setError(null)

    const supabase = crearClienteNavegador()
    // Se entra con el usuario (número de empleado, credencial…) o con el correo
    const identificador = correo.trim().toLowerCase()
    const { data: acceso } = await supabase.schema('seguridad').rpc('correo_de_acceso', { p_identificador: identificador })
    const email = (acceso as string | null) ?? (identificador.includes('@') ? identificador : `${identificador}@${DOMINIO_USUARIOS}`)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: contrasena,
    })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Usuario o contraseña incorrectos.'
          : error.message
      )
      setEnviando(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={iniciarSesion}
        className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Expediente Clínico Electrónico</h1>
          <p className="text-sm text-slate-500">Acceso para personal del hospital</p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Usuario o correo</span>
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-sky-700 text-white font-medium py-2 hover:bg-sky-800 disabled:opacity-60"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
