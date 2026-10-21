import { obtenerPerfil } from '@/lib/perfil'
import { crearClienteServidor } from '@/lib/supabase/server'
import { Encabezado } from '@/components/Encabezado'
import { SinAlta } from '@/components/SinAlta'
import { CargoLector } from '@/components/CargoLector'
import {
  buscarArticulo,
  buscarArticulos,
  buscarPacientes,
  buscarPorPulsera,
  cancelarCargo,
  cargar,
  cargosDelPaciente,
  elegirPaciente,
} from './acciones'

// Cargo al paciente desde las áreas (lector de código de barras)
export default async function CargosPage() {
  const { perfil, email } = await obtenerPerfil()
  if (!perfil) return <SinAlta email={email} />
  const supabase = await crearClienteServidor()
  const { data: areas } = perfil.cargos.length
    ? await supabase.schema('catalogo').from('area_cargo').select('nombre').in('id', perfil.cargos).order('orden')
    : { data: [] }
  const verCuenta = ['caja', 'costos', 'admision', 'admin_sistema'].includes(perfil.rol)
  return (
    <>
      <Encabezado perfil={perfil} activo="cargos" />
      <main className="flex-1 bg-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Cargos al paciente</h1>
            <p className="text-sm text-slate-600">
              {perfil.cargos.length
                ? `Puedes cargar artículos de: ${((areas ?? []) as { nombre: string }[]).map((a) => a.nombre).join(', ')}. Los medicamentos se cobran al surtirlos en Farmacia y el día-cama se genera solo.`
                : 'No tienes áreas desde las que puedas cargar.'}
            </p>
          </div>
          {perfil.cargos.length > 0 && (
            <CargoLector
              usuarioId={perfil.id}
              verCuenta={verCuenta}
              acciones={{ buscarPorPulsera, buscarPacientes, elegirPaciente, buscarArticulo, buscarArticulos, cargar, cargosDelPaciente, cancelarCargo }}
            />
          )}
        </div>
      </main>
    </>
  )
}
