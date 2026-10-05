import Link from 'next/link'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { obtenerPerfil } from '@/lib/perfil'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { FormAccion } from '@/components/FormAccion'
import { FormValoracion } from '@/components/FormValoracion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { ahora, fechaHora } from '@/lib/formato'
import {
  ASA,
  COLOR_ASA,
  ESCALAS_VIA_AEREA,
  ESTADO_CIRUGIA,
  EXPLORACION,
  INTERROGATORIO,
  LABORATORIOS,
  alertasLaboratorio,
  factoresVAD,
  imc,
  sangradoPermisible,
  textoVAD,
} from '@/lib/anestesia'
import { HojaTransanestesica, type FarmacoTrans, type LiquidoTrans, type RegistroTrans, type SignoHoja } from '@/components/HojaTransanestesica'
import { GraficaSignos } from '@/components/GraficaSignos'
import { FormAldrete, FormAltaRecuperacion } from '@/components/Recuperacion'
import { TECNICA_SECCIONES, TIEMPOS, colorAldrete, duracion, hora, resumenSeccion, textoAldrete } from '@/lib/anestesia-trans'
import {
  agregarFarmaco,
  agregarLiquido,
  agregarSigno,
  altaRecuperacion,
  asignarmeCirugia,
  cancelarCirugia,
  cerrarHoja,
  guardarTecnica,
  iniciarAnestesia,
  marcarTiempo,
  quitarRenglon,
  registrarAldrete,
  registrarValoracion,
} from '../../acciones'

type Firma = { nombre_firmante: string; cedula: string; hash_sha256: string; firmado_en: string }
type Registro = RegistroTrans & {
  estado: 'en_curso' | 'cerrado'
  salida_sala: string | null
  salida: Record<string, string> | null
  documento_id: string | null
  alta_recuperacion: string | null
  alta_documento_id: string | null
}
type Aldrete = {
  id: number
  momento: string
  actividad: number
  respiracion: number
  circulacion: number
  conciencia: number
  saturacion: number
  total: number
  eva: number | null
  spo2: number | null
  fc: number | null
  ta: string | null
  notas: string | null
}

// ---------------------------------------------------------------------
// Cirugía: datos de la programación y valoración preanestésica.
// ---------------------------------------------------------------------

type Valoracion = {
  asa: string
  asa_urgencia?: boolean
  tecnica_anestesica: string
  plan_anestesico: string
  riesgo?: string
  consentimiento?: boolean
  ficha?: Record<string, string>
  via_aerea?: Record<string, string>
  interrogatorio?: Record<string, string>
  exploracion?: Record<string, string>
  laboratorios?: Record<string, string>
}

export default async function CirugiaPage({ params }: PageProps<'/anestesia/cirugia/[id]'>) {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />

  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data: c } = await supabase
    .schema('clinico')
    .from('v_agenda_quirurgica')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!c) notFound()

  const hace24h = new Date(ahora() - 24 * 3600 * 1000).toISOString()
  const [paciente, alergias, signos, valoracion] = await Promise.all([
    supabase.schema('clinico').from('paciente').select('sexo, tipo_sangre').eq('id', c.paciente_id).single(),
    supabase.schema('clinico').from('paciente_alergia').select('sustancia, severidad').eq('paciente_id', c.paciente_id).eq('activa', true),
    supabase
      .schema('clinico')
      .from('signos_vitales')
      .select('ta_sistolica, ta_diastolica, frecuencia_cardiaca, frecuencia_respiratoria, temperatura, spo2, peso_kg, talla_cm')
      .eq('encuentro_id', c.encuentro_id)
      .gte('tomado_en', hace24h)
      .order('tomado_en', { ascending: false })
      .limit(1),
    c.valoracion_id
      ? supabase
          .schema('clinico')
          .from('documento_clinico')
          .select('contenido, firma(nombre_firmante, cedula, hash_sha256, firmado_en)')
          .eq('id', c.valoracion_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Hoja transanestésica y recuperación
  const { data: reg } = await supabase.schema('clinico').from('anestesia_registro').select('*').eq('cirugia_id', id).maybeSingle()
  const registro = reg as Registro | null
  let signosTrans: SignoHoja[] = []
  let farmacos: FarmacoTrans[] = []
  let liquidos: LiquidoTrans[] = []
  let aldretes: Aldrete[] = []
  const firmas: Record<string, Firma | undefined> = {}
  if (registro) {
    const docs = [registro.documento_id, registro.alta_documento_id].filter(Boolean) as string[]
    const [sg, fa, li, al, fi] = await Promise.all([
      supabase.schema('clinico').from('anestesia_signo').select('*').eq('registro_id', registro.id).order('momento').order('id'),
      supabase.schema('clinico').from('anestesia_farmaco').select('*').eq('registro_id', registro.id).order('momento').order('id'),
      supabase.schema('clinico').from('anestesia_liquido').select('*').eq('registro_id', registro.id).order('momento').order('id'),
      supabase.schema('clinico').from('recuperacion_aldrete').select('*').eq('registro_id', registro.id).order('momento').order('id'),
      docs.length
        ? supabase.schema('clinico').from('firma').select('documento_id, nombre_firmante, cedula, hash_sha256, firmado_en').in('documento_id', docs)
        : Promise.resolve({ data: [] }),
    ])
    signosTrans = (sg.data ?? []) as SignoHoja[]
    farmacos = (fa.data ?? []) as FarmacoTrans[]
    liquidos = (li.data ?? []) as LiquidoTrans[]
    aldretes = (al.data ?? []) as Aldrete[]
    for (const f of (fi.data ?? []) as (Firma & { documento_id: string })[]) firmas[f.documento_id] = f
  }

  const s = signos.data?.[0]
  const listaAlergias = (alergias.data ?? []).map((a) => `${a.sustancia}${a.severidad ? ` (${a.severidad})` : ''}`)
  const esAnestesiologo = perfil.rol === 'anestesiologo'
  const puedeCancelar = ['medico_tratante', 'medico_residente', 'anestesiologo', 'admision'].includes(perfil.rol) && c.estado === 'programada'
  const v = (valoracion.data?.contenido ?? null) as Valoracion | null
  const firma = (valoracion.data as { firma?: { nombre_firmante: string; cedula: string; hash_sha256: string; firmado_en: string }[] } | null)?.firma?.[0]
  const estado = ESTADO_CIRUGIA[c.estado as string]
  const pesoPaciente = Number(v?.ficha?.peso_kg) || s?.peso_kg || null
  const hbPaciente = Number(String(v?.laboratorios?.hb ?? '').replace(',', '.')) || null
  const puedeIniciar = esAnestesiologo && c.estado === 'programada' && (v || c.tipo === 'urgencia')
  const enRecuperacion = c.estado === 'en_recuperacion'
  const ultimoAldrete = aldretes.length ? aldretes[aldretes.length - 1].total : null

  return (
    <>
      <Encabezado perfil={perfil} activo="anestesia" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link href={`/anestesia?fecha=${(c.inicio_programado as string).slice(0, 10)}`} className="text-sky-700 hover:underline">
              ← Agenda quirúrgica
            </Link>
            <Link href={`/medicos/encuentro/${c.encuentro_id}`} className="text-sky-700 hover:underline">
              Expediente médico →
            </Link>
          </div>

          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{c.paciente as string}</h1>
              <span className="flex gap-1 text-xs">
                {c.tipo === 'urgencia' && <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">Urgencia</span>}
                <span className={`rounded px-2 py-0.5 ${estado.color}`}>{estado.texto}</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Exp. {c.expediente as string} · {c.sexo as string} · {(c.edad as number | null) ?? '—'} años{c.cama ? ` · ${c.cama}` : ''}
            </p>
            <p className="mt-2 text-sm text-slate-900">
              <strong>{c.procedimiento as string}</strong>
              {c.cie9mc ? <span className="text-slate-500"> · CIE-9-MC {c.cie9mc as string}</span> : null}
            </p>
            <p className="text-sm text-slate-700">
              {c.sala_nombre as string} · {fechaHora(c.inicio_programado as string)} · {c.duracion_min as number} min
            </p>
            <p className="text-sm text-slate-700">
              Cirujano: Dr(a). {c.cirujano as string} · Anestesiólogo: {c.anestesiologo ? `Dr(a). ${c.anestesiologo as string}` : 'por asignar'}
            </p>
            {c.tecnica_propuesta && <p className="text-sm text-slate-700">Técnica propuesta: {c.tecnica_propuesta as string}</p>}
            {c.observaciones && <p className="text-sm text-slate-700">Observaciones: {c.observaciones as string}</p>}
            {c.motivo_cancelacion && <p className="text-sm text-red-800">Cancelada: {c.motivo_cancelacion as string}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {listaAlergias.map((a) => (
                <span key={a} className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">
                  Alergia: {a}
                </span>
              ))}
              {listaAlergias.length === 0 && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">Sin alergias registradas</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {esAnestesiologo && !c.anestesiologo_id && c.estado === 'programada' && (
                <FormAccion accion={asignarmeCirugia.bind(null, id)} boton="Tomar este caso" variante="secundario" className="flex items-center gap-2" />
              )}
              {puedeCancelar && (
                <details>
                  <summary className="cursor-pointer text-sm text-red-700">Cancelar cirugía</summary>
                  <FormAccion accion={cancelarCirugia.bind(null, id)} boton="Cancelar cirugía" variante="secundario" className="mt-1 flex flex-wrap items-end gap-2">
                    <label className={claseEtiqueta}>
                      Motivo
                      <input name="motivo" required className={claseCampo} />
                    </label>
                  </FormAccion>
                </details>
              )}
            </div>
          </section>

          {/* Valoración preanestésica */}
          <section className={claseTarjeta}>
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Valoración preanestésica</h2>
            {v ? (
              <ResumenValoracion v={v} sexo={c.sexo as string} firma={firma} />
            ) : c.estado === 'cancelada' ? (
              <p className="text-sm text-slate-500">Cirugía cancelada.</p>
            ) : esAnestesiologo ? (
              <FormValoracion
                accion={registrarValoracion.bind(null, id)}
                sexo={c.sexo as string}
                alergias={listaAlergias}
                previos={{
                  peso: s?.peso_kg ?? null,
                  talla: s?.talla_cm ?? null,
                  ta: s?.ta_sistolica ? `${s.ta_sistolica}/${s.ta_diastolica}` : null,
                  fc: s?.frecuencia_cardiaca ?? null,
                  fr: s?.frecuencia_respiratoria ?? null,
                  temp: s?.temperatura ?? null,
                  spo2: s?.spo2 ?? null,
                  tipoSangre: paciente.data?.tipo_sangre ?? null,
                  tecnicaPropuesta: (c.tecnica_propuesta as string | null) ?? null,
                }}
              />
            ) : (
              <p className="text-sm text-amber-800">Pendiente: la valoración la realiza y firma el anestesiólogo.</p>
            )}
          </section>

          {/* Registro transanestésico */}
          {c.estado !== 'cancelada' && (
            <section className={claseTarjeta}>
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Registro transanestésico</h2>
              {!registro ? (
                puedeIniciar ? (
                  <FormAccion accion={iniciarAnestesia.bind(null, id)} boton="Paciente en sala: abrir hoja transanestésica" className="space-y-2">
                    {!v && <p className="text-sm text-amber-800">Urgencia sin valoración preanestésica firmada.</p>}
                  </FormAccion>
                ) : (
                  <p className="text-sm text-slate-500">
                    {esAnestesiologo && !v ? 'Primero se firma la valoración preanestésica.' : 'La hoja la abre el anestesiólogo cuando el paciente entra a sala.'}
                  </p>
                )
              ) : registro.estado === 'en_curso' && esAnestesiologo ? (
                <HojaTransanestesica
                  registro={registro}
                  signos={signosTrans}
                  farmacos={farmacos}
                  liquidos={liquidos}
                  usuarioId={perfil.id}
                  peso={pesoPaciente}
                  hb={hbPaciente}
                  sexo={c.sexo as string}
                  alergias={listaAlergias}
                  acciones={{
                    marcarTiempo: marcarTiempo.bind(null, registro.id, id),
                    agregarSigno: agregarSigno.bind(null, registro.id, id),
                    agregarFarmaco: agregarFarmaco.bind(null, registro.id, id),
                    agregarLiquido: agregarLiquido.bind(null, registro.id, id),
                    guardarTecnica: guardarTecnica.bind(null, registro.id, id),
                    cerrarHoja: cerrarHoja.bind(null, registro.id, id),
                    quitar: quitarRenglon.bind(null, registro.id, id),
                  }}
                />
              ) : (
                <ResumenTrans
                  registro={registro}
                  signos={signosTrans}
                  farmacos={farmacos}
                  liquidos={liquidos}
                  firma={registro.documento_id ? firmas[registro.documento_id] : undefined}
                />
              )}
            </section>
          )}

          {/* Recuperación */}
          {registro?.estado === 'cerrado' && registro.salida?.destino === 'UCPA' && (
            <section className={claseTarjeta}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800">Recuperación (UCPA)</h2>
                <span className="text-xs text-slate-600">
                  Ingreso {hora(registro.salida_sala)}
                  {registro.alta_recuperacion && ` · Alta ${hora(registro.alta_recuperacion)} (${duracion(registro.salida_sala, registro.alta_recuperacion)})`}
                </span>
              </div>
              {aldretes.length === 0 && <p className="text-sm text-slate-500">Sin valoraciones de Aldrete.</p>}
              {aldretes.length > 0 && (
                <ul className="mb-3 divide-y divide-slate-100 text-sm">
                  {aldretes.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-baseline gap-2 py-1">
                      <span className="font-medium text-sky-800">{hora(a.momento)}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${colorAldrete(a.total)}`}>
                        Aldrete {a.total}/10 · {textoAldrete(a.total)}
                      </span>
                      <span className="text-xs text-slate-600">
                        A{a.actividad} R{a.respiracion} C{a.circulacion} Co{a.conciencia} S{a.saturacion}
                        {a.eva !== null && ` · EVA ${a.eva}`}
                        {a.spo2 !== null && ` · SpO₂ ${a.spo2}%`}
                        {a.fc !== null && ` · FC ${a.fc}`}
                        {a.ta && ` · TA ${a.ta}`}
                      </span>
                      {a.notas && <span className="w-full text-slate-700">{a.notas}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {enRecuperacion && (esAnestesiologo || perfil.rol === 'enfermeria') && (
                <div className="space-y-4">
                  <FormAldrete accion={registrarAldrete.bind(null, registro.id, id)} />
                  {esAnestesiologo && (
                    <div className="rounded-lg border border-slate-200 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Alta de recuperación</h3>
                      {ultimoAldrete === null ? (
                        <p className="text-sm text-slate-500">Registra al menos un Aldrete antes del alta.</p>
                      ) : (
                        <FormAltaRecuperacion accion={altaRecuperacion.bind(null, registro.id, id)} ultimoAldrete={ultimoAldrete} />
                      )}
                    </div>
                  )}
                </div>
              )}
              {registro.alta_documento_id && firmas[registro.alta_documento_id] && (
                <p className="text-xs text-emerald-800">
                  ✓ Alta de recuperación firmada por {firmas[registro.alta_documento_id]!.nombre_firmante} · Céd. {firmas[registro.alta_documento_id]!.cedula} ·{' '}
                  {fechaHora(firmas[registro.alta_documento_id]!.firmado_en)}
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  )
}

function ResumenTrans({
  registro,
  signos,
  farmacos,
  liquidos,
  firma,
}: {
  registro: Registro
  signos: SignoHoja[]
  farmacos: FarmacoTrans[]
  liquidos: LiquidoTrans[]
  firma?: Firma
}) {
  const ingresos = liquidos.filter((l) => l.tipo === 'ingreso').reduce((a, l) => a + Number(l.volumen_ml), 0)
  const egresos = liquidos.filter((l) => l.tipo === 'egreso').reduce((a, l) => a + Number(l.volumen_ml), 0)
  const sal = registro.salida ?? {}
  const ml = (n: number) => `${n.toLocaleString('es-MX')} mL`
  return (
    <div className="space-y-3 text-sm">
      {registro.estado === 'en_curso' && (
        <p className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">Cirugía en curso · vista de consulta (la captura el anestesiólogo).</p>
      )}
      <div className="flex flex-wrap gap-2">
        {registro.tipo_anestesia && <span className="rounded bg-slate-100 px-2 py-1 font-medium">{registro.tipo_anestesia}</span>}
        <span className="rounded bg-slate-100 px-2 py-1">Anestesia {duracion(registro.inicio_anestesia, registro.fin_anestesia) ?? '—'}</span>
        <span className="rounded bg-slate-100 px-2 py-1">Cirugía {duracion(registro.inicio_cirugia, registro.fin_cirugia) ?? '—'}</span>
        <span className="rounded bg-slate-100 px-2 py-1">
          Balance {ingresos - egresos >= 0 ? '+' : ''}
          {ml(ingresos - egresos)}
        </span>
      </div>
      <p className="text-slate-700">
        Ingreso a sala {hora(registro.ingreso_sala)} ·{' '}
        {TIEMPOS.map(([k, t]) => `${t} ${hora(registro[k as keyof RegistroTrans] as string | null)}`).join(' · ')}
        {registro.salida_sala && ` · Salida de sala ${hora(registro.salida_sala)}`}
      </p>
      <GraficaSignos signos={signos} />
      {signos.length > 0 && (
        <Bloque titulo={`Signos vitales (${signos.length})`}>
          {signos.map((x) => (
            <p key={x.id}>
              <span className="font-medium">{hora(x.momento)}</span>{' '}
              {[
                x.spo2 !== null && `SpO₂ ${x.spo2}%`,
                x.fc !== null && `FC ${x.fc}`,
                x.tas !== null && `TA ${x.tas}/${x.tad ?? '—'}`,
                x.etco2 !== null && `EtCO₂ ${x.etco2}`,
                x.temp !== null && `T ${x.temp} °C`,
                x.bis !== null && `BIS ${x.bis}`,
                x.tof !== null && `TOF ${x.tof}%`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ))}
        </Bloque>
      )}
      {farmacos.length > 0 && (
        <Bloque titulo={`Fármacos (${farmacos.length})`}>
          {farmacos.map((f) => (
            <p key={f.id}>
              <span className="font-medium">{hora(f.momento)}</span> {f.farmaco}
              {f.dosis !== null && ` ${Number(f.dosis).toLocaleString('es-MX')} ${f.unidad ?? ''}`} · {f.via}
              {f.notas && ` · ${f.notas}`}
            </p>
          ))}
        </Bloque>
      )}
      {liquidos.length > 0 && (
        <Bloque titulo={`Líquidos · ingresos ${ml(ingresos)} · egresos ${ml(egresos)}`}>
          {liquidos.map((l) => (
            <p key={l.id}>
              <span className="font-medium">{hora(l.momento)}</span> {l.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}: {l.concepto} {ml(Number(l.volumen_ml))}
            </p>
          ))}
        </Bloque>
      )}
      {TECNICA_SECCIONES.some((x) => registro.datos?.[x.clave]) && (
        <Bloque titulo="Técnica">
          {TECNICA_SECCIONES.filter((x) => registro.datos?.[x.clave]).map((x) => (
            <Linea key={x.clave} t={x.titulo} v={resumenSeccion(x, registro.datos[x.clave])} />
          ))}
        </Bloque>
      )}
      {registro.salida && (
        <Bloque titulo="Salida de quirófano">
          <p>
            Destino <strong>{sal.destino}</strong> · Condición {sal.condicion}
            {sal.consciencia && ` · ${sal.consciencia}`}
            {sal.eva && ` · EVA ${sal.eva}/10`}
          </p>
          <p>
            {[sal.ta && `TA ${sal.ta}`, sal.fc && `FC ${sal.fc}`, sal.spo2 && `SpO₂ ${sal.spo2}%`, sal.fr && `FR ${sal.fr}`, sal.temp && `T ${sal.temp} °C`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {sal.indicaciones && <Linea t="Indicaciones" v={sal.indicaciones} />}
          {sal.observaciones && <Linea t="Observaciones" v={sal.observaciones} />}
          {sal.recibe && <Linea t="Recibe" v={sal.recibe} />}
        </Bloque>
      )}
      {firma && (
        <p className="text-xs text-emerald-800">
          ✓ Hoja firmada por {firma.nombre_firmante} · Céd. {firma.cedula} · {fechaHora(firma.firmado_en)} ·{' '}
          <span className="font-mono" title={firma.hash_sha256}>SHA-256 {firma.hash_sha256.slice(0, 12)}…</span>
        </p>
      )}
    </div>
  )
}

function ResumenValoracion({
  v,
  sexo,
  firma,
}: {
  v: Valoracion
  sexo: string
  firma?: { nombre_firmante: string; cedula: string; hash_sha256: string; firmado_en: string }
}) {
  const va = v.via_aerea ?? {}
  const f = v.ficha ?? {}
  const lab = v.laboratorios ?? {}
  const ex = v.exploracion ?? {}
  const io = v.interrogatorio ?? {}
  const peso = Number(f.peso_kg)
  const nVad = factoresVAD(va)
  const sangrado = sangradoPermisible(peso, Number(lab.hb), sexo)
  const alertas = alertasLaboratorio(lab)
  const textoAsa = ASA.find((a) => a.codigo === v.asa)?.texto ?? v.asa

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <span className={`rounded px-2 py-1 font-semibold ${COLOR_ASA[v.asa] ?? 'bg-slate-100'}`}>
          ASA {v.asa}
          {v.asa_urgencia ? 'E' : ''}
        </span>
        {va.mallampati && <span className="rounded bg-slate-100 px-2 py-1">Mallampati {va.mallampati}</span>}
        <span className={`rounded px-2 py-1 ${nVad === 0 ? 'bg-emerald-50 text-emerald-800' : nVad <= 2 ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`}>
          {textoVAD(nVad)}
        </span>
        {v.consentimiento && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">Consentimiento firmado</span>}
      </div>
      <p className="text-slate-600">{textoAsa}</p>
      <p>
        <strong>Técnica:</strong> {v.tecnica_anestesica}
      </p>
      <p className="whitespace-pre-line">
        <strong>Plan anestésico:</strong> {v.plan_anestesico}
      </p>
      {v.riesgo && (
        <p className="whitespace-pre-line">
          <strong>Riesgo y pronóstico:</strong> {v.riesgo}
        </p>
      )}

      <Bloque titulo="Ficha">
        {[
          f.peso_kg && `Peso ${f.peso_kg} kg`,
          f.talla_cm && `Talla ${f.talla_cm} cm`,
          imc(peso, Number(f.talla_cm)) && `IMC ${imc(peso, Number(f.talla_cm))}`,
          f.grupo_sanguineo && `Grupo ${f.grupo_sanguineo}`,
          f.ultimo_alimento && `Último alimento ${f.ultimo_alimento}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        {f.padecimientos && <Linea t="Padecimientos" v={f.padecimientos} />}
        {f.medicamentos_actuales && <Linea t="Medicamentos" v={f.medicamentos_actuales} />}
        {f.antecedentes_anestesicos && <Linea t="Antecedentes anestésicos" v={f.antecedentes_anestesicos} />}
      </Bloque>

      <Bloque titulo="Vía aérea">
        {ESCALAS_VIA_AEREA.filter((e) => va[e.clave]).map((e) => (
          <Linea key={e.clave} t={e.titulo} v={e.opciones.find((o) => o.codigo === va[e.clave])?.texto ?? va[e.clave]} />
        ))}
        {va.circunferencia_cuello && <Linea t="Circunferencia de cuello" v={`${va.circunferencia_cuello} cm`} />}
        {va.movilidad_cervical && <Linea t="Movilidad cervical" v={va.movilidad_cervical} />}
      </Bloque>

      {Object.keys(io).length > 0 && (
        <Bloque titulo="Interrogatorio">
          {INTERROGATORIO.filter(([k]) => io[k]).map(([k, t]) => (
            <Linea key={k} t={t} v={io[k]} />
          ))}
        </Bloque>
      )}

      <Bloque titulo="Exploración">
        {[ex.ta && `TA ${ex.ta}`, ex.fc && `FC ${ex.fc}`, ex.fr && `FR ${ex.fr}`, ex.temp && `T ${ex.temp} °C`, ex.spo2 && `SpO₂ ${ex.spo2} %`]
          .filter(Boolean)
          .join(' · ')}
        {EXPLORACION.filter(([k]) => ex[k]).map(([k, t]) => (
          <Linea key={k} t={t} v={ex[k]} />
        ))}
      </Bloque>

      {Object.keys(lab).length > 0 && (
        <Bloque titulo={`Laboratorio${lab.fecha ? ` (${lab.fecha})` : ''}`}>
          {LABORATORIOS.filter(([k]) => lab[k])
            .map(([k, t]) => `${t.replace(/ \(.*\)/, '')} ${lab[k]}`)
            .join(' · ')}
          {alertas.map((a) => (
            <p key={a} className="text-amber-900">
              ⚠ {a}
            </p>
          ))}
          {sangrado && (
            <p>
              Sangrado permisible: Gross {sangrado.gross.toLocaleString('es-MX')} mL · Bourke-Smith {sangrado.bourke.toLocaleString('es-MX')} mL ·
              transfundir a {sangrado.transfusion.toLocaleString('es-MX')} mL (VSE {sangrado.vse.toLocaleString('es-MX')} mL)
            </p>
          )}
          {lab.notas && <Linea t="Notas" v={lab.notas} />}
          {lab.imagenologia && <Linea t="Imagenología" v={lab.imagenologia} />}
        </Bloque>
      )}

      {firma && (
        <p className="text-xs text-emerald-800">
          ✓ Firmada por {firma.nombre_firmante} · Céd. {firma.cedula} · {fechaHora(firma.firmado_en)} ·{' '}
          <span className="font-mono" title={firma.hash_sha256}>SHA-256 {firma.hash_sha256.slice(0, 12)}…</span>
        </p>
      )}
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{titulo}</p>
      <div className="mt-1 space-y-0.5 text-slate-800">{children}</div>
    </div>
  )
}

function Linea({ t, v }: { t: string; v: string }) {
  return (
    <p className="whitespace-pre-line">
      <span className="font-medium text-slate-700">{t}:</span> {v}
    </p>
  )
}
