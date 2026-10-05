'use client'

import { useEffect, useRef, useState } from 'react'
import { claseCampo } from '@/lib/estilos'

const DURACION_MAXIMA = 180 // segundos por dictado

type Estado = 'listo' | 'grabando' | 'transcribiendo'

// Campo de texto largo con botón 🎤: graba la voz, la transcribe en el servidor
// y agrega el texto al final de lo ya escrito (no lo reemplaza). El texto se
// puede corregir antes de guardar o firmar.
export function CampoDictado({
  name,
  etiqueta,
  rows = 3,
  required,
  placeholder,
  defaultValue,
}: {
  name: string
  etiqueta: string
  rows?: number
  required?: boolean
  placeholder?: string
  defaultValue?: string
}) {
  const [estado, setEstado] = useState<Estado>('listo')
  const [segundos, setSegundos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const grabadora = useRef<MediaRecorder | null>(null)
  const trozos = useRef<Blob[]>([])
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null)

  // Si se sale de la página grabando, soltar el micrófono
  useEffect(() => {
    return () => {
      if (reloj.current) clearInterval(reloj.current)
      grabadora.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function iniciar() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar audio.')
      return
    }
    let flujo: MediaStream
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('No hay permiso para usar el micrófono. Actívalo en el navegador.')
      return
    }
    // Chrome graba en webm; Safari (iPhone, iPad, Mac) en mp4
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    const g = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined)
    trozos.current = []
    g.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.current.push(e.data)
    }
    g.onstop = () => {
      flujo.getTracks().forEach((t) => t.stop())
      void enviar(new Blob(trozos.current, { type: g.mimeType || 'audio/webm' }))
    }
    grabadora.current = g
    g.start()
    setSegundos(0)
    setEstado('grabando')
    reloj.current = setInterval(() => setSegundos((s) => s + 1), 1000)
  }

  function detener() {
    if (reloj.current) clearInterval(reloj.current)
    reloj.current = null
    if (grabadora.current?.state === 'recording') grabadora.current.stop()
  }

  async function enviar(audio: Blob) {
    setEstado('transcribiendo')
    try {
      const extension = audio.type.includes('mp4') ? 'mp4' : 'webm'
      const datos = new FormData()
      datos.append('audio', audio, `dictado.${extension}`)
      const r = await fetch('/api/transcribir', { method: 'POST', body: datos })
      const cuerpo = (await r.json().catch(() => ({}))) as { texto?: string; error?: string }
      if (!r.ok || cuerpo.error) {
        setError(cuerpo.error ?? 'No se pudo transcribir el dictado.')
      } else if (!cuerpo.texto) {
        setError('No se entendió el audio. Intenta de nuevo, más cerca del micrófono.')
      } else if (campo.current) {
        const actual = campo.current.value.trimEnd()
        campo.current.value = actual ? `${actual} ${cuerpo.texto}` : cuerpo.texto
        campo.current.focus()
      }
    } catch {
      setError('No se pudo conectar para transcribir. Revisa la conexión.')
    } finally {
      setEstado('listo')
    }
  }

  // Tope de duración: al llegar al máximo se detiene y se transcribe lo grabado
  useEffect(() => {
    if (estado === 'grabando' && segundos >= DURACION_MAXIMA) detener()
  }, [estado, segundos])

  const mmss = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={`campo-${name}`} className="block text-sm font-medium text-slate-700">
          {etiqueta}
        </label>
        <button
          type="button"
          onClick={estado === 'grabando' ? detener : iniciar}
          disabled={estado === 'transcribiendo'}
          aria-label={
            estado === 'grabando'
              ? `Detener dictado de ${etiqueta}`
              : estado === 'transcribiendo'
                ? `Transcribiendo dictado de ${etiqueta}`
                : `Dictar ${etiqueta}`
          }
          className={
            estado === 'grabando'
              ? 'rounded-full bg-red-600 text-white text-xs font-medium px-3 py-1 animate-pulse'
              : 'rounded-full border border-slate-300 bg-white text-slate-700 text-xs font-medium px-3 py-1 hover:bg-slate-50 disabled:opacity-60'
          }
        >
          {estado === 'grabando' ? `■ Detener ${mmss}` : estado === 'transcribiendo' ? 'Transcribiendo…' : '🎤 Dictar'}
        </button>
      </div>
      <textarea
        id={`campo-${name}`}
        ref={campo}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={claseCampo}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
