'use client'

import { useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'

export type PrivilegioCatalogo = {
  clave: string
  nombre: string
  grupo: string
  area_clave: string | null
  hemo_categoria: string | null
  cie9_rangos: string | null
  descripcion: string | null
  activo: boolean
}

const GRUPOS: Record<string, string> = {
  quirurgico: 'Quirúrgico (capítulos CIE-9-MC)',
  hemodinamia: 'Hemodinamia (categoría de procedimiento)',
  unidad: 'Unidad o gabinete (abre la sección)',
  anestesia: 'Anestesiología (informativo)',
}
const CATEGORIAS: Record<string, string> = {
  coronario: 'Coronarios',
  periferico: 'Periféricos',
  neuro: 'Neurointervención',
  electrofisiologia: 'Marcapasos y electrofisiología',
  otro: 'Otros intervencionistas',
}

// Alta o cambio de un privilegio del catálogo; los campos dependen del grupo
export function FormPrivilegioCatalogo({
  accion,
  inicial,
  unidades,
}: {
  accion: (p: Resultado, d: FormData) => Promise<Resultado>
  inicial: PrivilegioCatalogo | null
  unidades: { clave: string; nombre: string }[]
}) {
  const [grupo, setGrupo] = useState(inicial?.grupo ?? 'quirurgico')
  const nuevo = !inicial
  return (
    <FormAccion accion={accion} boton={nuevo ? 'Agregar al catálogo' : 'Guardar cambios'} variante={nuevo ? 'primario' : 'secundario'} className="grid gap-3 sm:grid-cols-4">
      {nuevo ? (
        <>
          <label className={claseEtiqueta}>
            Clave *
            <input name="clave" required placeholder="QX-BAR" className={`${claseCampo} font-mono uppercase`} />
          </label>
          <label className={`${claseEtiqueta} sm:col-span-3`}>
            Grupo *
            <select name="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} className={claseCampo}>
              {Object.entries(GRUPOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      <label className={`${claseEtiqueta} sm:col-span-2`}>
        Nombre *
        <input name="nombre" required defaultValue={inicial?.nombre} placeholder="Cirugía bariátrica" className={claseCampo} />
      </label>
      {grupo === 'quirurgico' && (
        <label className={claseEtiqueta}>
          Capítulos CIE-9-MC *
          <input name="cie9_rangos" required defaultValue={inicial?.cie9_rangos ?? ''} placeholder="43-45, 54" className={`${claseCampo} font-mono`} />
        </label>
      )}
      {grupo === 'hemodinamia' && (
        <label className={claseEtiqueta}>
          Categoría *
          <select name="hemo_categoria" required defaultValue={inicial?.hemo_categoria ?? ''} className={claseCampo}>
            <option value="">Elige…</option>
            {Object.entries(CATEGORIAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      {grupo === 'unidad' && (
        <label className={claseEtiqueta}>
          Unidad que abre *
          <select name="area_clave" required defaultValue={inicial?.area_clave ?? ''} className={claseCampo}>
            <option value="">Elige…</option>
            {unidades.map((u) => (
              <option key={u.clave} value={u.clave}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {grupo === 'anestesia' && <span className="self-end pb-2 text-xs text-slate-500">Se registra en la ficha del médico; no abre ni limita secciones.</span>}
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={inicial?.activo ?? true} /> Activo
      </label>
      <label className={`${claseEtiqueta} sm:col-span-2`}>
        Descripción
        <input name="descripcion" defaultValue={inicial?.descripcion ?? ''} className={claseCampo} />
      </label>
      <label className={`${claseEtiqueta} sm:col-span-2`}>
        Acta u oficio que aprueba el cambio *
        <input name="acta" required placeholder="CC-2026-060" className={claseCampo} />
      </label>
    </FormAccion>
  )
}
