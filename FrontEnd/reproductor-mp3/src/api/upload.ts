export async function uploadMedia(file: File, format: 'mp3' | 'mp4') {
  const response = await fetch(`/api/media/upload?format=${format}`, {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message || `El servidor respondió con el estado ${response.status}`)
  }

  return {
    blob: await response.blob(),
    filename: response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || `nicoplay.${format}`,
  }
}
