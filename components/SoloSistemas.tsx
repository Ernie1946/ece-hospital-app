import { claseTarjeta } from '@/lib/estilos'

export function SoloSistemas() {
  return (
    <main className="flex-1 bg-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <p className={`${claseTarjeta} text-sm text-slate-700`}>
          La administración del personal es exclusiva de Sistemas. Las altas se solicitan a través de Personal o de la Dirección Médica.
        </p>
      </div>
    </main>
  )
}
