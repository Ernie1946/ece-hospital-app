import { RIESGO_NEWS, type RiesgoNews } from '@/lib/escalas'

export type News2Fila = { encuentro_id: string; puntaje: number; riesgo: RiesgoNews; completo: boolean; qsofa: number | null }

// Etiqueta NEWS2 de los tableros (últimos signos de 24 h, adultos)
export function BadgeNews2({ n }: { n?: News2Fila }) {
  if (!n?.riesgo) return null
  const r = RIESGO_NEWS[n.riesgo]
  return (
    <span className={`rounded border px-1 text-xs font-semibold ${r.clase}`} title={`${r.texto}. ${r.accion}.`}>
      NEWS2 {n.puntaje}
      {n.completo ? '' : '*'}
      {n.riesgo !== 'bajo' && ` · ${r.texto.replace('Riesgo ', '')}`}
      {(n.qsofa ?? 0) >= 2 && ' · qSOFA ≥ 2'}
    </span>
  )
}
