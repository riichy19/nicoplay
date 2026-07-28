export type MediaInfo = {
  title: string
  duration?: number
  thumbnail?: string
  webpageUrl?: string
  formats?: Array<'mp3' | 'mp4'>
}

type ApiErrorBody = {
  error?: {
    message?: string
  }
}

async function apiError(response: Response) {
  const fallback = `El servidor respondió con el estado ${response.status}`

  try {
    const body = await response.json() as ApiErrorBody
    return new Error(body.error?.message || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function getMediaInfo(url: string, signal?: AbortSignal) {
  const response = await fetch('/api/media/info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  })

  if (!response.ok) throw await apiError(response)
  const body = await response.json() as { data: MediaInfo }
  return body.data
}

function responseFilename(response: Response, format: 'mp3' | 'mp4') {
  const disposition = response.headers.get('content-disposition') || ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1]

  if (encoded) return decodeURIComponent(encoded)
  return plain || `descarga.${format}`
}

export async function downloadMedia(url: string, format: 'mp3' | 'mp4') {
  const response = await fetch('/api/media/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, format }),
  })

  if (!response.ok) throw await apiError(response)

  return {
    blob: await response.blob(),
    filename: responseFilename(response, format),
  }
}
