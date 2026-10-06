// Planes de cuidados de enfermería: escala de resultado y sugerencias por escalas/signos

export type DiagnosticoEnf = {
  id: number
  clave: string
  etiqueta: string
  tipo: 'real' | 'riesgo' | 'promocion'
  dominio: string | null
  resultado_esperado: string
  intervenciones: string[]
  disparador: string | null
  disparador_op: '>=' | '<=' | null
  disparador_valor: number | null
}

export type PlanCuidado = {
  id: string
  diagnostico_id: number
  etiqueta: string
  relacionado_con: string | null
  manifestado_por: string | null
  resultado_esperado: string
  puntuacion_inicial: number
  meta: number
  intervenciones: string[]
  origen: string | null
  estado: 'activo' | 'resuelto' | 'suspendido'
  creado_en: string
  cerrado_en: string | null
  motivo_cierre: string | null
}

export type EvaluacionPlan = {
  id: number
  plan_id: string
  turno: string
  puntuacion: number
  intervenciones_hechas: string[]
  nota: string | null
  registrado_por: string
  registrado_en: string
}

// Escala de resultado (1 = gravemente comprometido … 5 = sin compromiso)
export const ESCALA_RESULTADO: Record<number, string> = {
  1: 'Gravemente comprometido',
  2: 'Sustancialmente comprometido',
  3: 'Moderadamente comprometido',
  4: 'Levemente comprometido',
  5: 'Sin compromiso',
}

export const TIPO_DX: Record<string, string> = { real: 'Real', riesgo: 'Riesgo', promocion: 'Promoción de la salud' }

const NOMBRE_DISPARADOR: Record<string, string> = {
  caidas_morse: 'Morse',
  braden: 'Braden',
  dolor_eva: 'EVA',
  glasgow: 'Glasgow',
  temperatura: 'Temperatura',
  spo2: 'SpO₂',
}

// Diagnósticos que conviene iniciar según los últimos valores registrados
export function sugerencias(catalogo: DiagnosticoEnf[], valores: Record<string, number | null | undefined>, activos: Set<number>) {
  return catalogo
    .filter((d) => d.disparador && !activos.has(d.id))
    .flatMap((d) => {
      const v = valores[d.disparador as string]
      if (v === null || v === undefined || d.disparador_valor === null) return []
      const cumple = d.disparador_op === '>=' ? v >= Number(d.disparador_valor) : v <= Number(d.disparador_valor)
      return cumple ? [{ diagnostico: d, origen: `${NOMBRE_DISPARADOR[d.disparador as string]} ${v}` }] : []
    })
}
