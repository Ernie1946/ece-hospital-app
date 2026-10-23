import { crearClienteServidor } from '@/lib/supabase/server'
import { FormAccion } from '@/components/FormAccion'
import { BotonAccion } from '@/components/BotonAccion'
import { claseCampo, claseEtiqueta, claseTarjeta } from '@/lib/estilos'
import { TIPO_EGRESO } from '@/lib/medica'
import { darAlta, hospitalizar } from '@/app/medicos/acciones'
import { asignarCamaDestino, registrarSalida } from '@/app/enfermeria/acciones'

type Encuentro = { id: string; tipo: string; estado: string; tipo_egreso?: string | null }

const TIPO_INGRESO: [string, string][] = [
  ['hospitalizacion', 'Hospitalización'],
  ['corta_estancia', 'Corta estancia'],
  ['cirugia', 'Cirugía'],
]

// Destino del paciente: hospitalizar desde urgencias, alta médica y salida física.
// El médico decide; enfermería asigna la cama del piso y registra la salida.
export async function DestinoPaciente({ encuentro, rol, puedeEscribir }: { encuentro: Encuentro; rol: string; puedeEscribir: boolean }) {
  const supabase = await crearClienteServidor()
  const { data: tr } = await supabase
    .schema('clinico')
    .from('transferencia')
    .select('encuentro_destino_id, motivo')
    .eq('encuentro_origen_id', encuentro.id)
    .order('solicitada_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  const destinoId = (tr?.encuentro_destino_id as string | undefined) ?? null
  const urgencias = encuentro.tipo === 'urgencias'
  const enfermeria = rol === 'enfermeria'
  const medico = ['medico_tratante', 'medico_residente'].includes(rol)
  const tratante = rol === 'medico_tratante'
  if (!['activo', 'alta_medica'].includes(encuentro.estado)) return null
  if (!urgencias && encuentro.estado === 'activo' && !tratante && !destinoId) return null

  // Datos del ingreso a piso (si ya se solicitó)
  let destino: { servicio: string; servicio_clave: string; tipo: string; cama: string | null } | null = null
  let camas: { cama: string; area_nombre: string }[] = []
  if (destinoId) {
    const [{ data: d }, { data: asig }] = await Promise.all([
      supabase.schema('clinico').from('encuentro').select('tipo, servicio_id').eq('id', destinoId).maybeSingle(),
      supabase.schema('camas').from('v_censo').select('cama').eq('encuentro_id', destinoId).maybeSingle(),
    ])
    const { data: s } = await supabase.schema('catalogo').from('servicio').select('clave, nombre').eq('id', d?.servicio_id as number).maybeSingle()
    destino = { servicio: (s?.nombre as string) ?? '—', servicio_clave: (s?.clave as string) ?? '', tipo: (d?.tipo as string) ?? '', cama: (asig?.cama as string | null) ?? null }
    if (!destino.cama && enfermeria) {
      const { data: libres } = await supabase
        .schema('camas')
        .from('v_censo')
        .select('cama, area_nombre, servicio, area_tipo')
        .eq('estado', 'disponible')
        .in('area_tipo', ['hospitalizacion', 'critico'])
        .order('cama')
      camas = ((libres ?? []) as { cama: string; area_nombre: string; servicio: string | null }[]).filter((c) => !c.servicio || c.servicio === destino!.servicio_clave)
    }
  }
  const [{ data: servicios }, { data: medicos }] =
    urgencias && medico && !destinoId && encuentro.estado === 'activo'
      ? await Promise.all([
          supabase.schema('catalogo').from('servicio').select('clave, nombre').neq('clave', 'URG').order('nombre'),
          supabase.schema('seguridad').from('usuario').select('id, nombre, primer_apellido').eq('rol', 'medico_tratante').eq('activo', true).order('primer_apellido'),
        ])
      : [{ data: [] }, { data: [] }]

  return (
    <section className={`${claseTarjeta} border-sky-200`} aria-label="Destino del paciente">
      <h2 className="text-sm font-semibold text-slate-800">{urgencias ? 'Destino del paciente de urgencias' : 'Egreso'}</h2>

      {encuentro.estado === 'alta_medica' && (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-slate-700">
            Alta médica dada{encuentro.tipo_egreso ? ` (${TIPO_EGRESO[encuentro.tipo_egreso] ?? encuentro.tipo_egreso})` : ''}. Falta registrar la salida física del paciente.
          </p>
          {enfermeria && puedeEscribir && (
            <BotonAccion etiqueta="Registrar salida del paciente" confirmar="¿El paciente ya salió? Se cierra el ingreso y la cama pasa a limpieza." alHacer={registrarSalida.bind(null, encuentro.id, 'egreso')} />
          )}
        </div>
      )}

      {encuentro.estado === 'activo' && destino && (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-slate-700">
            Ingreso solicitado a <strong>{destino.servicio}</strong> ({TIPO_INGRESO.find(([v]) => v === destino!.tipo)?.[1] ?? destino.tipo})
            {tr?.motivo ? `: ${tr.motivo}` : ''}.
          </p>
          {destino.cama ? (
            <p className="text-slate-700">
              Cama asignada: <strong>{destino.cama}</strong>.
            </p>
          ) : enfermeria && puedeEscribir ? (
            <FormAccion accion={asignarCamaDestino.bind(null, encuentro.id, destinoId!)} boton="Asignar cama" variante="secundario" className="flex flex-wrap items-end gap-2">
              <label className={claseEtiqueta}>
                Cama en piso
                <select name="cama" defaultValue="" className={claseCampo}>
                  <option value="">Elegir…</option>
                  {camas.map((c) => (
                    <option key={c.cama} value={c.cama}>
                      {c.cama} · {c.area_nombre}
                    </option>
                  ))}
                </select>
              </label>
            </FormAccion>
          ) : (
            <p className="text-slate-500">Enfermería asigna la cama del piso.</p>
          )}
          {enfermeria && puedeEscribir && destino.cama && (
            <BotonAccion etiqueta="Registrar salida a piso" confirmar="¿El paciente ya salió hacia el piso?" alHacer={registrarSalida.bind(null, encuentro.id, 'traslado')} />
          )}
        </div>
      )}

      {encuentro.estado === 'activo' && !destino && puedeEscribir && (
        <div className="mt-2 grid gap-4 lg:grid-cols-2">
          {urgencias && medico && (
            <FormAccion accion={hospitalizar.bind(null, encuentro.id)} boton="Hospitalizar" className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">Hospitalizar</p>
              <p className="text-xs text-slate-500">Requiere la nota de urgencias firmada. El ingreso queda a nombre del médico tratante que elijas.</p>
              <label className={claseEtiqueta}>
                Tipo
                <select name="tipo" className={claseCampo}>
                  {TIPO_INGRESO.map(([v, t]) => (
                    <option key={v} value={v}>{t}</option>
                  ))}
                </select>
              </label>
              <label className={claseEtiqueta}>
                Servicio
                <select name="servicio" defaultValue="" className={claseCampo}>
                  <option value="">Elegir…</option>
                  {((servicios ?? []) as { clave: string; nombre: string }[]).map((s) => (
                    <option key={s.clave} value={s.clave}>{s.nombre}</option>
                  ))}
                </select>
              </label>
              <label className={claseEtiqueta}>
                Médico tratante en piso
                <select name="medico" defaultValue="" className={claseCampo}>
                  <option value="">El mismo de urgencias</option>
                  {((medicos ?? []) as { id: string; nombre: string; primer_apellido: string }[]).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.primer_apellido} {m.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className={claseEtiqueta}>
                Motivo del ingreso
                <input name="motivo" className={claseCampo} placeholder="Apendicitis aguda para apendicectomía…" />
              </label>
            </FormAccion>
          )}
          {tratante && (
            <FormAccion accion={darAlta.bind(null, encuentro.id)} boton={urgencias ? 'Dar de alta de urgencias' : 'Dar alta médica'} variante="secundario" className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">{urgencias ? 'Alta de urgencias' : 'Alta médica'}</p>
              <p className="text-xs text-slate-500">
                {urgencias ? 'Requiere la nota de urgencias firmada.' : 'Requiere la nota de egreso firmada.'} Después, enfermería registra la salida.
              </p>
              <label className={claseEtiqueta}>
                Tipo de egreso
                <select name="tipo_egreso" defaultValue="mejoria" className={claseCampo}>
                  {Object.entries(TIPO_EGRESO).map(([v, t]) => (
                    <option key={v} value={v}>{t}</option>
                  ))}
                </select>
              </label>
            </FormAccion>
          )}
          {urgencias && !medico && <p className="text-sm text-slate-500">El médico de urgencias decide si el paciente se hospitaliza o se da de alta.</p>}
        </div>
      )}
    </section>
  )
}
