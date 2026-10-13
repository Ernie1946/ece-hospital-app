import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { claseTarjeta } from '@/lib/estilos'
import { fechaHora } from '@/lib/formato'
import { ESTADO_CASO, nombreProc, type Caso } from '@/lib/hemodinamia'

// Procedimientos de hemodinamia del ingreso, en el expediente (médicos y enfermería)
export async function ListaHemodinamia({ encuentroId }: { encuentroId: string }) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .schema('clinico')
    .from('v_hemo_caso')
    .select('id, inicio, estado, procedimiento, procedimiento_clave, procedimiento_detalle, firmado_en, salida_sala_en, hemodinamista_nombre')
    .eq('encuentro_id', encuentroId)
    .neq('estado', 'cancelado')
    .order('inicio', { ascending: false })
  const lista = (data ?? []) as Caso[]
  if (lista.length === 0) return null
  return (
    <section className={claseTarjeta} aria-label="Hemodinamia">
      <h2 className="text-sm font-semibold text-slate-800">Hemodinamia ({lista.length})</h2>
      <ul className="mt-2 divide-y divide-slate-100 text-sm">
        {lista.map((c) => (
          <li key={c.id} className="py-1.5">
            <Link href={`/hemodinamia/caso/${c.id}`} className="font-medium text-sky-700 hover:underline">
              {nombreProc(c)}
            </Link>
            <span className="text-slate-500"> · {fechaHora(c.inicio)}</span>
            <span className={`ml-1 rounded px-1 text-xs ${ESTADO_CASO[c.estado]?.color}`}>{ESTADO_CASO[c.estado]?.texto}</span>
            {c.estado === 'recuperacion' && <span className="ml-1 rounded bg-amber-500 px-1 text-xs font-semibold text-white">Vigilar sitio de punción</span>}
            <span className="ml-1 text-xs text-slate-500">{c.firmado_en ? 'informe firmado' : 'informe pendiente'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
