'use client'

import { useEffect, useState, useTransition } from 'react'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { celularWhatsApp, mensajeEntrega } from '@/lib/resultados'
import type { ResultadoEntrega } from '@/app/resultados/acciones'

type Opcion = { id: string; estudio: string; fecha: string; entregado: boolean }

// Entrega de resultados al paciente externo: enlace seguro que pide la
// fecha de nacimiento; se envía por WhatsApp o correo desde este equipo.
export function EntregaResultados({
  paciente,
  telefono,
  correo,
  resultados,
  crear,
}: {
  paciente: string
  telefono: string | null
  correo: string | null
  resultados: Opcion[]
  crear: (resultados: string[], canal: string, destino: string, consentimiento: boolean, dias: number) => Promise<ResultadoEntrega>
}) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set(resultados.filter((r) => !r.entregado).map((r) => r.id)))
  const [canal, setCanal] = useState<'whatsapp' | 'correo'>(telefono ? 'whatsapp' : correo ? 'correo' : 'whatsapp')
  const [destino, setDestino] = useState((telefono ? telefono : correo) ?? '')
  const [consentimiento, setConsentimiento] = useState(false)
  const [dias, setDias] = useState(30)
  const [r, setR] = useState<ResultadoEntrega | null>(null)
  const [sitio, setSitio] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [pendiente, iniciar] = useTransition()
  useEffect(() => setSitio(window.location.origin), [])

  if (resultados.length === 0) return <p className="text-sm text-slate-500">No hay resultados para entregar.</p>

  const enlace = r?.token ? `${sitio}/r/${r.token}` : ''
  const estudios = resultados.filter((x) => elegidos.has(x.id)).map((x) => x.estudio).join(', ')
  const mensaje = r?.token ? mensajeEntrega(paciente.split(' ')[0], estudios, enlace, r.vence ?? '') : ''

  if (r?.token)
    return (
      <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm" role="region" aria-label="Enlace de resultados">
        <p className="font-semibold text-emerald-900">Enlace creado (vence el {r.vence}).</p>
        <p className="break-all rounded bg-white px-2 py-1 font-mono text-xs text-slate-800">{enlace}</p>
        <div className="flex flex-wrap gap-2">
          {canal === 'whatsapp' ? (
            <a
              href={`https://wa.me/${celularWhatsApp(destino)}?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noopener"
              className="rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800"
            >
              Enviar por WhatsApp ↗
            </a>
          ) : (
            <a
              href={`mailto:${destino}?subject=${encodeURIComponent('Sus resultados están listos')}&body=${encodeURIComponent(mensaje)}`}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800"
            >
              Enviar por correo ↗
            </a>
          )}
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(mensaje).catch(() => {})
              setCopiado(true)
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            {copiado ? 'Mensaje copiado ✓' : 'Copiar mensaje'}
          </button>
          <button type="button" onClick={() => location.reload()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
            Listo
          </button>
        </div>
        <p className="text-xs text-emerald-900">
          El mensaje se abre en WhatsApp o en el correo de este equipo con el texto ya escrito; revisa el número o correo y envíalo. El paciente abrirá sus
          resultados con su fecha de nacimiento.
        </p>
      </div>
    )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        iniciar(async () => setR(await crear([...elegidos], canal, destino, consentimiento, dias)))
      }}
      className="space-y-3 text-sm"
    >
      <fieldset>
        <legend className="font-medium text-slate-700">Resultados a enviar</legend>
        {resultados.map((x) => (
          <label key={x.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={elegidos.has(x.id)}
              onChange={() =>
                setElegidos((s) => {
                  const n = new Set(s)
                  if (n.has(x.id)) n.delete(x.id)
                  else n.add(x.id)
                  return n
                })
              }
            />
            {x.estudio} <span className="text-slate-500">· {x.fecha}</span>
            {x.entregado && <span className="text-xs text-emerald-800">(ya enviado)</span>}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className={claseEtiqueta}>
          Enviar por
          <select
            value={canal}
            onChange={(e) => {
              const c = e.target.value as 'whatsapp' | 'correo'
              setCanal(c)
              setDestino((c === 'whatsapp' ? telefono : correo) ?? '')
            }}
            className={claseCampo}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="correo">Correo</option>
          </select>
        </label>
        <label className={`${claseEtiqueta} flex-1 min-w-56`}>
          {canal === 'whatsapp' ? 'Celular' : 'Correo'}
          <input
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            required
            inputMode={canal === 'whatsapp' ? 'tel' : 'email'}
            placeholder={canal === 'whatsapp' ? '10 dígitos' : 'correo@ejemplo.com'}
            className={claseCampo}
          />
        </label>
        <label className={claseEtiqueta}>
          Vigencia
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={claseCampo}>
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </label>
      </div>
      <label className="flex items-start gap-2 text-slate-700">
        <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} className="mt-1" />
        <span>
          El paciente (o su representante) autorizó recibir sus resultados por {canal === 'whatsapp' ? 'WhatsApp' : 'correo'} en este{' '}
          {canal === 'whatsapp' ? 'número' : 'correo'}.
        </span>
      </label>
      {r?.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {r.error}
        </p>
      )}
      <button
        disabled={pendiente || elegidos.size === 0 || !consentimiento}
        className="rounded-lg bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-800 disabled:opacity-50"
      >
        {pendiente ? 'Creando…' : 'Crear enlace seguro'}
      </button>
    </form>
  )
}
