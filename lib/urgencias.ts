// Niveles de triage (escala de 5 niveles por colores)
export const TRIAGE: { nivel: number; color: string; texto: string; objetivo: string; clase: string }[] = [
  { nivel: 1, color: 'Rojo', texto: 'Reanimación', objetivo: 'inmediato', clase: 'bg-red-600 text-white' },
  { nivel: 2, color: 'Naranja', texto: 'Muy urgente', objetivo: '10 min', clase: 'bg-orange-500 text-white' },
  { nivel: 3, color: 'Amarillo', texto: 'Urgente', objetivo: '60 min', clase: 'bg-yellow-300 text-yellow-950' },
  { nivel: 4, color: 'Verde', texto: 'Menos urgente', objetivo: '2 h', clase: 'bg-emerald-500 text-white' },
  { nivel: 5, color: 'Azul', texto: 'No urgente', objetivo: '4 h', clase: 'bg-sky-600 text-white' },
]
