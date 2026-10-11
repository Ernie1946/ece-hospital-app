'use client'

import { useState } from 'react'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import type { Equipo, Estudio } from '@/lib/gabinetes'

// Estudio y equipo: solo se ofrecen los equipos que hacen el estudio elegido
export function SelectorEstudioGab({ estudios, equipos }: { estudios: Estudio[]; equipos: Equipo[] }) {
  const [clave, setClave] = useState(estudios.length === 1 ? estudios[0].clave : '')
  const estudio = estudios.find((e) => e.clave === clave)
  const aptos = equipos.filter((q) => q.tipo === estudio?.tipo_equipo)
  return (
    <>
      <label className={`${claseEtiqueta} sm:col-span-2`}>
        Estudio *
        <select name="estudio" required value={clave} onChange={(e) => setClave(e.target.value)} className={claseCampo}>
          <option value="">Elige…</option>
          {estudios.map((e) => (
            <option key={e.clave} value={e.clave}>
              {e.nombre} ({e.duracion_min} min)
            </option>
          ))}
        </select>
      </label>
      <label className={claseEtiqueta}>
        Equipo *
        <select key={clave} name="equipo" required defaultValue={aptos.length === 1 ? aptos[0].clave : ''} className={claseCampo}>
          <option value="">{estudio ? 'Elige…' : 'Primero el estudio'}</option>
          {aptos.map((q) => (
            <option key={q.clave} value={q.clave}>
              {q.nombre}
            </option>
          ))}
        </select>
      </label>
      {estudio?.indicaciones && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-3">
          <strong>Indicaciones para el paciente:</strong> {estudio.indicaciones}
        </p>
      )}
    </>
  )
}
