'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { solicitarRecuperacion } from './acciones'

function Formulario() {
  const [estado, enviar, pendiente] = useActionState(solicitarRecuperacion, null)
  const enlaceMalo = useSearchParams().get('error') === 'enlace'
  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">¿Olvidaste tu contraseña?</h1>
        <p className="text-sm text-slate-500">Te enviamos un enlace a tu correo registrado para crear una nueva.</p>
      </div>
      {enlaceMalo && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          El enlace ya se usó o venció. Pide uno nuevo.
        </p>
      )}
      {estado?.enviado ? (
        <div role="status" className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <p>
            Si tu cuenta tiene un correo registrado, en unos minutos te llegará el enlace (revisa también la carpeta de correo no deseado). El enlace sirve
            una vez y vence en una hora.
          </p>
          <p>Si no tienes correo registrado en el hospital, pide a Sistemas que restablezca tu contraseña.</p>
        </div>
      ) : (
        <form action={enviar} className="space-y-4">
          <label className={claseEtiqueta}>
            Usuario o correo
            <input name="identificador" required autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" className={claseCampo} />
          </label>
          {estado?.error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {estado.error}
            </p>
          )}
          <button disabled={pendiente} className="w-full rounded-lg bg-sky-700 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-60">
            {pendiente ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
        </form>
      )}
      <Link href="/login" className="block text-center text-sm text-sky-700 hover:underline">
        ← Volver a entrar
      </Link>
    </div>
  )
}

export default function RecuperarPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <Suspense>
        <Formulario />
      </Suspense>
    </main>
  )
}
