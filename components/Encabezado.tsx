import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cerrarSesion } from '@/lib/sesion'
import { etiquetaRol } from '@/lib/roles'
import type { Perfil } from '@/lib/perfil'

const SECCIONES = [
  { href: '/', clave: 'censo', nombre: 'Censo' },
  { href: '/admision', clave: 'admision', nombre: 'Admisión' },
  { href: '/medicos', clave: 'medicos', nombre: 'Médicos' },
  { href: '/enfermeria', clave: 'enfermeria', nombre: 'Enfermería' },
  { href: '/anestesia', clave: 'anestesia', nombre: 'Anestesia' },
  { href: '/farmacia', clave: 'farmacia', nombre: 'Farmacia' },
  { href: '/resultados', clave: 'resultados', nombre: 'Resultados' },
  { href: '/hemodialisis', clave: 'hemodialisis', nombre: 'Hemodiálisis' },
  { href: '/gabinetes', clave: 'gabinetes', nombre: 'Gabinetes' },
  { href: '/hemodinamia', clave: 'hemodinamia', nombre: 'Hemodinamia' },
  { href: '/cargos', clave: 'cargos', nombre: 'Cargos' },
  { href: '/catalogos', clave: 'catalogos', nombre: 'Catálogos' },
  { href: '/personal', clave: 'personal', nombre: 'Personal' },
] as const

export function Encabezado({
  perfil,
  activo,
}: {
  perfil: Perfil
  activo: (typeof SECCIONES)[number]['clave']
}) {
  // Contraseña temporal: hay que cambiarla antes de usar el expediente
  if (perfil.debe_cambiar_contrasena) redirect('/cuenta/contrasena')
  const secciones = SECCIONES.filter(
    (s) =>
      // El técnico de gabinete solo trabaja en su agenda
      (perfil.rol !== 'gabinete' || ['gabinetes', 'hemodinamia', 'cargos', 'catalogos'].includes(s.clave)) &&
      (s.clave !== 'hemodinamia' || !!perfil.hemo) &&
      (s.clave !== 'personal' || perfil.rol === 'admin_sistema') &&
      (s.clave !== 'catalogos' || perfil.catalogos.length > 0) &&
      (s.clave !== 'cargos' || perfil.cargos.length > 0) &&
      (s.clave !== 'resultados' || ['laboratorio', 'imagenologia', 'admision', 'archivo'].includes(perfil.rol)) &&
      (s.clave !== 'hemodialisis' || !!perfil.hd) &&
      (s.clave !== 'gabinetes' || perfil.gabinetes.length > 0 || ['admision', 'archivo'].includes(perfil.rol))
  )
  return (
    <header className="bg-white border-b border-slate-200 print:hidden">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-900">ECE Hospital</span>
          <nav className="flex gap-1 text-sm" aria-label="Secciones">
            {secciones.map((s) => (
              <Link
                key={s.clave}
                href={s.href}
                aria-current={activo === s.clave ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 ${
                  activo === s.clave ? 'bg-sky-50 text-sky-800 font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s.nombre}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-700">
            {perfil.nombre} {perfil.primer_apellido}
            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {etiquetaRol(perfil.rol)}
            </span>
          </span>
          {['medico_tratante', 'anestesiologo'].includes(perfil.rol) && (
            <Link href="/cuenta/privilegios" className="text-slate-600 hover:underline">
              Mis privilegios
            </Link>
          )}
          <Link href="/cuenta/contrasena" className="text-slate-600 hover:underline">
            Contraseña
          </Link>
          <form action={cerrarSesion}>
            <button className="text-sky-700 hover:underline">Salir</button>
          </form>
        </div>
      </div>
    </header>
  )
}
