'use client'

import { useState } from 'react'
import { FormAccion, type Resultado } from '@/components/FormAccion'
import { CampoDictado } from '@/components/CampoDictado'
import { claseCampo, claseEtiqueta } from '@/lib/estilos'
import {
  ASA,
  ESCALAS_VIA_AEREA,
  EXPLORACION,
  INTERROGATORIO,
  LABORATORIOS,
  TECNICAS,
  alertasLaboratorio,
  factoresVAD,
  imc,
  sangradoPermisible,
  textoVAD,
  type OpcionEscala,
} from '@/lib/anestesia'

const PESTANAS = ['Ficha', 'Vía aérea', 'Interrogatorio', 'Exploración', 'Laboratorio', 'Plan'] as const

type Previos = {
  peso?: number | null
  talla?: number | null
  ta?: string | null
  fc?: number | null
  fr?: number | null
  temp?: number | null
  spo2?: number | null
  tipoSangre?: string | null
  tecnicaPropuesta?: string | null
}

// Valoración preanestésica en 6 pestañas (secciones de AnestesiApp).
// Todos los campos viven en el mismo formulario: cambiar de pestaña no borra nada.
export function FormValoracion({
  accion,
  sexo,
  alergias,
  previos,
}: {
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  sexo: string
  alergias: string[]
  previos: Previos
}) {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]>('Ficha')
  const [via, setVia] = useState<Record<string, string>>({})
  const [peso, setPeso] = useState(previos.peso ? String(previos.peso) : '')
  const [talla, setTalla] = useState(previos.talla ? String(previos.talla) : '')
  const [labs, setLabs] = useState<Record<string, string>>({})
  const [asa, setAsa] = useState('')

  const numPeso = Number(peso.replace(',', '.'))
  const valorImc = imc(numPeso, Number(talla))
  const nVad = factoresVAD(via)
  const sangrado = sangradoPermisible(numPeso, Number((labs.hb ?? '').replace(',', '.')), sexo)
  const alertas = alertasLaboratorio(labs)

  return (
    <FormAccion accion={accion} boton="Firmar valoración preanestésica" className="space-y-4">
      <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label="Secciones de la valoración">
        {PESTANAS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPestana(t)}
            aria-current={pestana === t ? 'page' : undefined}
            className={`rounded-t-lg px-3 py-1.5 text-sm ${
              pestana === t ? 'border border-b-white border-slate-200 bg-white font-semibold text-sky-800 -mb-px' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Ficha */}
      <section hidden={pestana !== 'Ficha'} className="space-y-3">
        {alergias.length > 0 ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">⚠ Alergias: {alergias.join(', ')}</p>
        ) : (
          <p className="text-sm text-slate-600">Sin alergias registradas en el expediente.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className={claseEtiqueta}>
            Peso (kg)
            <input name="ficha_peso_kg" value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Talla (cm)
            <input name="ficha_talla_cm" value={talla} onChange={(e) => setTalla(e.target.value)} inputMode="decimal" className={claseCampo} />
          </label>
          <div className={claseEtiqueta}>
            IMC
            <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-sky-800">{valorImc ?? '—'}</p>
          </div>
          <label className={claseEtiqueta}>
            Grupo sanguíneo
            <select name="ficha_grupo_sanguineo" defaultValue={previos.tipoSangre ?? ''} className={claseCampo}>
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={`${claseEtiqueta} max-w-xs`}>
          Último alimento sólido (hora)
          <input name="ficha_ultimo_alimento" type="time" className={claseCampo} />
        </label>
        <p className="text-xs text-slate-500">
          Ayuno: sólidos y leche 8 h · leche materna 4 h · líquidos claros 2 h · medicamentos con mínimo de agua.
        </p>
        <CampoDictado name="ficha_padecimientos" etiqueta="Padecimientos" rows={2} placeholder="HTA, DM2…" />
        <CampoDictado name="ficha_medicamentos_actuales" etiqueta="Medicamentos actuales" rows={2} placeholder="Metformina 850 mg…" />
        <CampoDictado name="ficha_antecedentes_anestesicos" etiqueta="Antecedentes anestésicos y quirúrgicos" rows={2} placeholder="Cirugías previas, complicaciones, NVPO…" />
      </section>

      {/* Vía aérea */}
      <section hidden={pestana !== 'Vía aérea'} className="space-y-3">
        <p
          className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${
            nVad === 0 ? 'bg-emerald-50 text-emerald-800' : nVad <= 2 ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'
          }`}
        >
          {textoVAD(nVad)}
        </p>
        {ESCALAS_VIA_AEREA.map((e) => (
          <SelectorEscala
            key={e.clave}
            nombre={`va_${e.clave}`}
            titulo={e.titulo}
            nota={e.nota}
            opciones={e.opciones}
            valor={via[e.clave] ?? 'N/E'}
            alCambiar={(v) => setVia((x) => ({ ...x, [e.clave]: v }))}
          />
        ))}
        <div className="grid grid-cols-2 gap-2">
          <label className={claseEtiqueta}>
            Circunferencia de cuello (cm)
            <input name="va_circunferencia_cuello" inputMode="decimal" className={claseCampo} />
          </label>
          <label className={claseEtiqueta}>
            Movilidad cervical
            <select name="va_movilidad_cervical" defaultValue="Normal" className={claseCampo}>
              <option>Normal</option>
              <option>Limitada</option>
            </select>
          </label>
        </div>
      </section>

      {/* Interrogatorio */}
      <section hidden={pestana !== 'Interrogatorio'} className="space-y-3">
        {INTERROGATORIO.map(([k, t, ph]) => (
          <CampoDictado key={k} name={`io_${k}`} etiqueta={t} rows={2} placeholder={ph} />
        ))}
      </section>

      {/* Exploración */}
      <section hidden={pestana !== 'Exploración'} className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Num nombre="ex_ta" titulo="TA (mmHg)" valor={previos.ta} texto />
          <Num nombre="ex_fc" titulo="FC (lpm)" valor={previos.fc} />
          <Num nombre="ex_fr" titulo="FR (rpm)" valor={previos.fr} />
          <Num nombre="ex_temp" titulo="Temp (°C)" valor={previos.temp} />
          <Num nombre="ex_spo2" titulo="SpO₂ (%)" valor={previos.spo2} />
        </div>
        {previos.fc !== undefined && previos.fc !== null && (
          <p className="text-xs text-slate-500">Signos precargados del último registro de enfermería; corrígelos si cambiaron.</p>
        )}
        {EXPLORACION.map(([k, t]) => (
          <CampoDictado key={k} name={`ex_${k}`} etiqueta={t} rows={2} placeholder="Hallazgos…" />
        ))}
      </section>

      {/* Laboratorio */}
      <section hidden={pestana !== 'Laboratorio'} className="space-y-3">
        <label className={`${claseEtiqueta} max-w-xs`}>
          Fecha de toma
          <input name="lab_fecha" type="date" className={claseCampo} />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LABORATORIOS.map(([k, t]) => (
            <label key={k} className={claseEtiqueta}>
              {t}
              <input
                name={`lab_${k}`}
                inputMode="decimal"
                value={labs[k] ?? ''}
                onChange={(e) => setLabs((x) => ({ ...x, [k]: e.target.value }))}
                className={claseCampo}
              />
            </label>
          ))}
        </div>
        {alertas.length > 0 && (
          <ul className="space-y-1">
            {alertas.map((a) => (
              <li key={a} className="rounded bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
                ⚠ {a}
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-800">🩸 Sangrado permisible</p>
          {sangrado ? (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
              <Dato titulo="VSE estimado" valor={`${sangrado.vse.toLocaleString('es-MX')} mL`} />
              <Dato titulo="Gross" valor={`${sangrado.gross.toLocaleString('es-MX')} mL`} />
              <Dato titulo="Bourke-Smith" valor={`${sangrado.bourke.toLocaleString('es-MX')} mL`} />
              <Dato titulo="Transfundir (Hb 7)" valor={`${sangrado.transfusion.toLocaleString('es-MX')} mL`} />
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Requiere peso (Ficha) y Hb.</p>
          )}
        </div>
        <CampoDictado name="lab_notas" etiqueta="Notas de laboratorio" rows={2} placeholder="Interpretación…" />
        <CampoDictado name="lab_imagenologia" etiqueta="Imagenología (Rx, ECG, USG, TAC…)" rows={2} placeholder="Rx de tórax sin alteraciones…" />
      </section>

      {/* Plan */}
      <section hidden={pestana !== 'Plan'} className="space-y-3">
        <SelectorEscala nombre="asa" titulo="Clase ASA *" opciones={ASA} valor={asa} alCambiar={setAsa} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="asa_urgencia" /> Cirugía de urgencia (ASA “E”)
        </label>
        <label className={`${claseEtiqueta} max-w-md`}>
          Técnica anestésica *
          <input name="tecnica_anestesica" list="tecnicas-plan" defaultValue={previos.tecnicaPropuesta ?? ''} className={claseCampo} />
          <datalist id="tecnicas-plan">
            {TECNICAS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <CampoDictado name="plan_anestesico" etiqueta="Plan anestésico *" rows={4} placeholder="Inducción, manejo de vía aérea, monitoreo, analgesia, destino postanestésico…" />
        <CampoDictado name="riesgo" etiqueta="Riesgo anestésico-quirúrgico y pronóstico" rows={2} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="consentimiento" /> Se explicó el plan y el paciente firmó el consentimiento informado de anestesia
        </label>
        <p className="text-xs text-slate-500">
          Al firmar, la valoración queda sellada con tu nombre, cédula y hora (NOM-004 / NOM-006) y se liga a esta cirugía.
        </p>
      </section>
    </FormAccion>
  )
}

function SelectorEscala({
  nombre,
  titulo,
  nota,
  opciones,
  valor,
  alCambiar,
}: {
  nombre: string
  titulo: string
  nota?: string
  opciones: OpcionEscala[]
  valor: string
  alCambiar: (v: string) => void
}) {
  const elegida = opciones.find((o) => o.codigo === valor)
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">{titulo}</legend>
      <div className="mt-1 flex flex-wrap gap-1">
        {opciones.map((o) => (
          <label
            key={o.codigo}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              valor === o.codigo ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            <input
              type="radio"
              name={nombre}
              value={o.codigo}
              checked={valor === o.codigo}
              onChange={() => alCambiar(o.codigo)}
              className="sr-only"
            />
            {o.codigo}
          </label>
        ))}
      </div>
      {elegida && elegida.texto !== elegida.codigo && <p className="mt-1 text-xs text-slate-600">{elegida.texto}</p>}
      {nota && <p className="text-xs text-slate-400">{nota}</p>}
    </fieldset>
  )
}

function Num({ nombre, titulo, valor, texto }: { nombre: string; titulo: string; valor?: number | string | null; texto?: boolean }) {
  return (
    <label className={claseEtiqueta}>
      {titulo}
      <input name={nombre} defaultValue={valor ?? ''} inputMode={texto ? 'text' : 'decimal'} className={claseCampo} />
    </label>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="font-semibold text-slate-900">{valor}</p>
    </div>
  )
}
