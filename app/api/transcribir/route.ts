import { crearClienteServidor } from '@/lib/supabase/server'

// Dictado por voz: recibe el audio grabado en el navegador, lo transcribe con
// OpenAI (Whisper) y regresa solo el texto. El audio no se guarda en ningún lado.
// La clave OPENAI_API_KEY vive solo en el servidor; nunca llega al navegador.

const TAMANO_MAXIMO = 5 * 1024 * 1024 // 5 MB ≈ varios minutos de voz

// Vocabulario que ayuda al reconocimiento de términos clínicos en español
const CONTEXTO =
  'Nota clínica hospitalaria en español de México. Términos frecuentes: signos vitales, TA, FC, FR, SpO2, ' +
  'Glasgow, EVA, Braden, Morse, solución Hartmann, NaCl 0.9 %, KCl, mEq, catéter venoso periférico, sonda Foley, ' +
  'herida quirúrgica, apendicectomía, colecistectomía, laparoscópica, cesárea, diuresis, balance hídrico, ' +
  'paracetamol, metamizol, ketorolaco, ceftriaxona, omeprazol, enoxaparina, insulina.'

export async function POST(request: Request) {
  // Solo personal con sesión y dado de alta en el expediente
  const supabase = await crearClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return Response.json({ error: 'Tu sesión terminó. Vuelve a entrar.' }, { status: 401 })
  const { data: usuario } = await supabase
    .schema('seguridad')
    .from('usuario')
    .select('id')
    .eq('id', auth.user.id)
    .eq('activo', true)
    .maybeSingle()
  if (!usuario) return Response.json({ error: 'Tu cuenta no está dada de alta en el expediente.' }, { status: 403 })

  const clave = process.env.OPENAI_API_KEY
  if (!clave) {
    return Response.json({ error: 'El dictado no está configurado (falta OPENAI_API_KEY en el servidor).' }, { status: 503 })
  }

  let audio: File | null = null
  try {
    const datos = await request.formData()
    const valor = datos.get('audio')
    audio = valor instanceof File ? valor : null
  } catch {
    audio = null
  }
  if (!audio || audio.size === 0) return Response.json({ error: 'No se recibió audio.' }, { status: 400 })
  if (audio.size > TAMANO_MAXIMO) {
    return Response.json({ error: 'La grabación es muy larga. Dicta en partes más cortas.' }, { status: 413 })
  }

  const envio = new FormData()
  envio.append('file', audio, audio.name || 'dictado.webm')
  envio.append('model', process.env.OPENAI_MODELO_DICTADO || 'whisper-1')
  envio.append('language', 'es')
  envio.append('prompt', CONTEXTO)
  envio.append('response_format', 'json')

  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  let respuesta: Response
  try {
    respuesta = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}` },
      body: envio,
    })
  } catch {
    return Response.json({ error: 'No se pudo conectar con el servicio de dictado. Intenta de nuevo.' }, { status: 502 })
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    console.error('Dictado: error de OpenAI', respuesta.status, detalle.slice(0, 300))
    const mensaje =
      respuesta.status === 401
        ? 'La clave del servicio de dictado no es válida.'
        : respuesta.status === 429
          ? 'El servicio de dictado no tiene saldo o está saturado. Avisa a sistemas.'
          : 'El servicio de dictado falló. Intenta de nuevo.'
    return Response.json({ error: mensaje }, { status: 502 })
  }

  const { text } = (await respuesta.json()) as { text?: string }
  return Response.json({ texto: (text ?? '').trim() })
}
