// Gráfica de tendencias transanestésicas (SVG simple, sin librerías):
// SpO₂, FC, TAS/TAD y EtCO₂ contra la hora.

export type SignoTrans = {
  id: number
  momento: string
  spo2: number | null
  fc: number | null
  tas: number | null
  tad: number | null
  etco2: number | null
  temp: number | null
  bis: number | null
  tof: number | null
}

const SERIES: { clave: keyof SignoTrans; nombre: string; color: string; guion?: string }[] = [
  { clave: 'spo2', nombre: 'SpO₂', color: '#059669' },
  { clave: 'fc', nombre: 'FC', color: '#0284c7' },
  { clave: 'tas', nombre: 'TAS', color: '#dc2626' },
  { clave: 'tad', nombre: 'TAD', color: '#dc2626', guion: '4 3' },
  { clave: 'etco2', nombre: 'EtCO₂', color: '#d97706' },
]

const horaCorta = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { timeZone: 'America/Chihuahua', hour: '2-digit', minute: '2-digit', hour12: false })

export function GraficaSignos({ signos }: { signos: SignoTrans[] }) {
  if (signos.length < 2) return null
  const W = 720
  const H = 220
  const izq = 34
  const der = 10
  const arr = 10
  const aba = 24
  const t0 = new Date(signos[0].momento).getTime()
  const t1 = new Date(signos[signos.length - 1].momento).getTime()
  const rango = Math.max(t1 - t0, 60_000)
  const yMin = 0
  const yMax = 200
  const x = (iso: string) => izq + ((new Date(iso).getTime() - t0) / rango) * (W - izq - der)
  const y = (v: number) => arr + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - arr - aba)
  const marcas = [0, 50, 100, 150, 200]
  const etiquetasX = signos.length <= 8 ? signos : signos.filter((_, i) => i % Math.ceil(signos.length / 8) === 0)

  return (
    <figure className="rounded-lg border border-slate-200 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Gráfica de signos vitales transanestésicos">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={izq} x2={W - der} y1={y(m)} y2={y(m)} stroke="#e2e8f0" />
            <text x={izq - 4} y={y(m) + 3} fontSize="9" textAnchor="end" fill="#64748b">
              {m}
            </text>
          </g>
        ))}
        {etiquetasX.map((s) => (
          <text key={s.id} x={x(s.momento)} y={H - 8} fontSize="9" textAnchor="middle" fill="#64748b">
            {horaCorta(s.momento)}
          </text>
        ))}
        {SERIES.map((serie) => {
          const puntos = signos.filter((s) => s[serie.clave] !== null)
          if (puntos.length === 0) return null
          const d = puntos.map((s, i) => `${i ? 'L' : 'M'}${x(s.momento).toFixed(1)},${y(Number(s[serie.clave])).toFixed(1)}`).join(' ')
          return (
            <g key={serie.clave}>
              <path d={d} fill="none" stroke={serie.color} strokeWidth="2" strokeDasharray={serie.guion} />
              {puntos.map((s) => (
                <circle key={s.id} cx={x(s.momento)} cy={y(Number(s[serie.clave]))} r="2.5" fill={serie.color} />
              ))}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.clave} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.nombre}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
