'use client'

import { useEffect, useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import { TECNICAS } from '@/lib/anestesia'

type Opcion = { id: string; texto: string }
type Procedimiento = { codigo: string; descripcion: string; tipo: string | null }

// Programación de una cirugía: paciente (ingreso vigente), procedimiento con
// buscador CIE-9-MC, sala, fecha, cirujano y anestesiólogo.
export function FormProgramarCirugia({
  accion,
  buscar,
  pacientes,
  salas,
  cirujanos,
  anestesiologos,
  encuentroInicial,
  fechaInicial,
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  buscar: (q: string) => Promise<Procedimiento[]>
  pacientes: Opcion[]
  salas: Opcion[]
  cirujanos: Opcion[]
  anestesiologos: Opcion[]
  encuentroInicial?: string
  fechaInicial: string
}) {
  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState<Procedimiento[]>([])
  const [elegido, setElegido] = useState<Procedimiento | null>(null)

  useEffect(() => {
    const q = consulta.trim()
    if (q.length < 2 || elegido) return
    let vigente = true
    const t = setTimeout(async () => {
      const r = await buscar(q)
      if (vigente) setResultados(r)
    }, 300)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consulta, elegido, buscar])

  return (
    <FormAccion accion={accion} boton="Programar cirugía" className="space-y-3">
      <label className={claseEtiqueta}>
        Paciente *
        <select name="encuentro" required defaultValue={encuentroInicial ?? ''} className={claseCampo}>
          <option value="">Elige…</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.texto}
            </option>
          ))}
        </select>
      </label>

      <div>
        <label className={claseEtiqueta}>
          Procedimiento *
          <input
            name="procedimiento"
            required
            value={elegido ? elegido.descripcion : consulta}
            onChange={(e) => {
              setElegido(null)
              setConsulta(e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            placeholder="Escribe para buscar en CIE-9-MC, o el nombre libre"
            className={claseCampo}
          />
        </label>
        <input type="hidden" name="cie9mc" value={elegido?.codigo ?? ''} />
        {elegido && <p className="mt-1 text-xs text-slate-600">CIE-9-MC {elegido.codigo}</p>}
        {!elegido && consulta.trim().length >= 2 && resultados.length > 0 && (
          <ul aria-label="Procedimientos CIE-9-MC" className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white text-sm">
            {resultados.map((r) => (
              <li key={r.codigo}>
                <button
                  type="button"
                  onClick={() => {
                    setElegido(r)
                    setResultados([])
                  }}
                  className="flex w-full gap-2 px-3 py-1.5 text-left hover:bg-sky-50"
                >
                  <span className="w-14 shrink-0 font-mono font-semibold">{r.codigo}</span>
                  <span>{r.descripcion}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className={claseEtiqueta}>
          Sala *
          <select name="sala" required className={claseCampo}>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.texto}
              </option>
            ))}
          </select>
        </label>
        <label className={`${claseEtiqueta} col-span-2 sm:col-span-1`}>
          Fecha y hora *
          <input name="inicio" type="datetime-local" required defaultValue={`${fechaInicial}T08:00`} className={claseCampo} />
        </label>
        <label className={claseEtiqueta}>
          Duración (min)
          <input name="duracion" type="number" min={10} max={1440} step={5} defaultValue={60} className={claseCampo} />
        </label>
        <label className={claseEtiqueta}>
          Tipo
          <select name="tipo" defaultValue="programada" className={claseCampo}>
            <option value="programada">Programada</option>
            <option value="urgencia">Urgencia</option>
          </select>
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <label className={claseEtiqueta}>
          Cirujano *
          <select name="cirujano" required defaultValue="" className={claseCampo}>
            <option value="">Elige…</option>
            {cirujanos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.texto}
              </option>
            ))}
          </select>
        </label>
        <label className={claseEtiqueta}>
          Anestesiólogo
          <select name="anestesiologo" defaultValue="" className={claseCampo}>
            <option value="">Por asignar</option>
            {anestesiologos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.texto}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <label className={claseEtiqueta}>
          Técnica propuesta
          <input name="tecnica" list="tecnicas" className={claseCampo} />
          <datalist id="tecnicas">
            {TECNICAS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className={claseEtiqueta}>
          Observaciones
          <input name="observaciones" placeholder="Material especial, sangre en reserva, posición…" className={claseCampo} />
        </label>
      </div>
    </FormAccion>
  )
}
