import { cerrarSesion } from '@/lib/sesion'

// Cuenta que existe en Authentication pero no está dada de alta como personal
export function SinAlta({ email }: { email?: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Cuenta sin alta en el hospital</h1>
        <p className="text-sm text-slate-600">
          Iniciaste sesión como <strong>{email}</strong>, pero esta cuenta no está registrada como personal
          del hospital. Pide al administrador que te dé de alta.
        </p>
        <form action={cerrarSesion}>
          <button className="text-sm text-sky-700 underline">Cerrar sesión</button>
        </form>
      </div>
    </main>
  )
}
