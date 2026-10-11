import { claseTarjeta } from '@/lib/estilos'

export function SoloHemodialisis() {
  return (
    <main className="flex-1 bg-slate-100">
      <p className={`${claseTarjeta} mx-auto mt-6 max-w-3xl text-sm text-slate-700`}>
        La unidad de hemodiálisis es para nefrología y para el personal de enfermería con área base en Hemodiálisis. Si un paciente tuyo está
        internado, sus sesiones aparecen en su expediente.
      </p>
    </main>
  )
}
