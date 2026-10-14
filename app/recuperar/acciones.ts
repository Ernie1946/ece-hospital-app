'use server'

import { headers } from 'next/headers'

// "¿Olvidaste tu contraseña?": la función de servidor decide si envía el enlace.
// La respuesta es siempre la misma, exista o no la cuenta.
export async function solicitarRecuperacion(_p: { enviado?: boolean } | null, d: FormData): Promise<{ enviado?: boolean; error?: string }> {
  const identificador = String(d.get('identificador') ?? '').trim().toLowerCase()
  if (identificador.length < 3) return { error: 'Escribe tu usuario o tu correo.' }
  const h = await headers()
  const ip = h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/personal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'x-ip-cliente': ip,
      },
      body: JSON.stringify({ accion: 'recuperar', identificador }),
      cache: 'no-store',
    })
    if (!r.ok) console.error('recuperar contraseña:', r.status, await r.text())
  } catch (e) {
    console.error('recuperar contraseña:', e)
  }
  return { enviado: true }
}
