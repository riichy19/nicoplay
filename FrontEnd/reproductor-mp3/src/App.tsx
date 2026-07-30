import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { uploadMedia } from './api/upload'

type Format = 'mp3' | 'mp4'
type JobStatus = 'idle' | 'processing' | 'ready'

const steps = [
  { at: 0, label: 'Analizando enlace' },
  { at: 24, label: 'Obteniendo el archivo' },
  { at: 58, label: 'Convirtiendo formato' },
  { at: 86, label: 'Preparando descarga' },
]

const demoHistory = [
  { title: 'Lo-fi focus session', format: 'MP3', meta: '08:42 · 12.4 MB', time: 'Hace 8 min' },
  { title: 'Creative workflow tutorial', format: 'MP4', meta: '14:18 · 108 MB', time: 'Ayer' },
]

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [downloadedFile, setDownloadedFile] = useState<{ blob: Blob; filename: string } | null>(null)
  const [format, setFormat] = useState<Format>('mp3')
  const [quality, setQuality] = useState('320 kbps')
  const [status, setStatus] = useState<JobStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mediaTitle, setMediaTitle] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const timerRef = useRef<number | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const currentStep = [...steps].reverse().find((step) => progress >= step.at) ?? steps[0]
  const remaining = Math.max(0, Math.ceil((100 - progress) / 16))

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      requestRef.current?.abort()
    }
  }, [])

  async function startConversion(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!file) {
      setError('Selecciona un archivo de audio o video')
      return
    }

    if (timerRef.current) window.clearInterval(timerRef.current)
    requestRef.current?.abort()
    requestRef.current = new AbortController()
    setStatus('processing')
    setProgress(4)

    timerRef.current = window.setInterval(() => {
      setProgress((value) => {
        const increment = value < 58 ? 4 : value < 86 ? 2 : 1
        return Math.min(90, value + increment)
      })
    }, 180)

    try {
      const result = await uploadMedia(file, format)
      if (timerRef.current) window.clearInterval(timerRef.current)
      setDownloadedFile(result)
      setMediaTitle(file.name)
      setProgress(100)
      window.setTimeout(() => setStatus('ready'), 250)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      if (timerRef.current) window.clearInterval(timerRef.current)
      setStatus('idle')
      setProgress(0)
      setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar el enlace')
    } finally {
      requestRef.current = null
    }
  }

  function resetJob() {
    if (timerRef.current) window.clearInterval(timerRef.current)
    requestRef.current?.abort()
    setProgress(0)
    setStatus('idle')
    setFile(null)
    setDownloadedFile(null)
    setError('')
    setNotice('')
    setMediaTitle('')
  }

  async function downloadFile() {
    setError('')
    setNotice('')
    setIsDownloading(true)

    try {
      if (!downloadedFile) throw new Error('No hay un archivo convertido disponible')
      const blobUrl = URL.createObjectURL(downloadedFile.blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = downloadedFile.filename
      link.click()
      URL.revokeObjectURL(blobUrl)
      setNotice('Descarga iniciada.')
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'No se pudo descargar el archivo')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="NicoPlay, inicio">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>Nico<span>Play</span></span>
        </a>
        <div className="topbar-actions">
          <span className="secure-label"><i aria-hidden="true" /> Conversión segura</span>
          <button className="avatar" type="button" aria-label="Abrir perfil">RG</button>
        </div>
      </header>

      <main>
        <section className="hero-section" aria-labelledby="page-title">
          <div className="eyebrow"><span>●</span> Rápido, limpio y sin complicaciones</div>
          <h1 id="page-title">Tu contenido favorito,<br /><em>en el formato que quieras.</em></h1>
          <p className="hero-copy">
            Pega el enlace, elige el formato y nosotros nos encargamos del resto.
            Calidad profesional en unos cuantos segundos.
          </p>

          <div className="converter-card">
            <form onSubmit={startConversion} noValidate>
                  <label className="field-label" htmlFor="media-file">Archivo de audio o video</label>
              <div className={`url-field ${error ? 'has-error' : ''}`}>
                <span aria-hidden="true">↗</span>
                  <input
                    id="media-file"
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] || null)
                      if (error) setError('')
                    }}
                  disabled={status === 'processing'}
                  aria-describedby={error ? 'url-error' : 'url-help'}
                  aria-invalid={Boolean(error)}
                />
              </div>
              {error ? (
                <p className="field-message error-message" id="url-error" role="alert">! {error}</p>
              ) : (
                <p className="field-message" id="url-help">Sube un archivo propio o autorizado desde tu dispositivo.</p>
              )}

              <div className="options-grid">
                <div>
                  <span className="field-label">Formato de salida</span>
                  <div className="format-toggle" role="radiogroup" aria-label="Formato de salida">
                    <button
                      type="button"
                      className={format === 'mp3' ? 'active' : ''}
                      onClick={() => {
                        setFormat('mp3')
                        setQuality('320 kbps')
                      }}
                      aria-pressed={format === 'mp3'}
                      disabled={status === 'processing'}
                    >
                      <b>MP3</b><small>Solo audio</small>
                    </button>
                    <button
                      type="button"
                      className={format === 'mp4' ? 'active' : ''}
                      onClick={() => {
                        setFormat('mp4')
                        setQuality('1080p')
                      }}
                      aria-pressed={format === 'mp4'}
                      disabled={status === 'processing'}
                    >
                      <b>MP4</b><small>Audio + video</small>
                    </button>
                  </div>
                </div>
                <label>
                  <span className="field-label">Calidad</span>
                  <select
                    value={quality}
                    onChange={(event) => setQuality(event.target.value)}
                    disabled={status === 'processing'}
                  >
                    {format === 'mp3' ? (
                      <>
                        <option>320 kbps</option>
                        <option>256 kbps</option>
                        <option>192 kbps</option>
                        <option>128 kbps</option>
                      </>
                    ) : (
                      <>
                        <option>1080p</option>
                        <option>720p</option>
                        <option>480p</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              {status === 'idle' && (
                <button className="primary-button" type="submit">
                  Convertir y descargar <span aria-hidden="true">↓</span>
                </button>
              )}
            </form>

            {status === 'processing' && (
              <div className="progress-panel" aria-live="polite">
                <div className="progress-heading">
                  <div>
                    <span className="pulse-dot" aria-hidden="true" />
                    <strong>{currentStep.label}</strong>
                    <p>Esto puede tomar unos momentos</p>
                  </div>
                  <b>{progress}%</b>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-meta">
                  <span>{format.toUpperCase()} · {quality}</span>
                  <span>~{remaining} s restantes</span>
                </div>
                <button className="cancel-button" type="button" onClick={resetJob}>Cancelar conversión</button>
              </div>
            )}

            {status === 'ready' && (
              <div className="ready-panel" aria-live="polite">
                <div className="ready-icon" aria-hidden="true">✓</div>
                <div className="ready-copy">
                  <strong>{mediaTitle || '¡Tu archivo está listo!'}</strong>
                  <p>Conversión completada en {format.toUpperCase()} · {quality}</p>
                </div>
                <button type="button" className="download-button" onClick={downloadFile} disabled={isDownloading}>
                  {isDownloading ? 'Preparando archivo…' : 'Descargar archivo ↓'}
                </button>
                <button type="button" className="text-button" onClick={resetJob}>Convertir otro enlace</button>
              </div>
            )}

            {notice && <div className="toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso">×</button></div>}

            <div className="privacy-note">
              <span aria-hidden="true">◇</span>
              <span><strong>Tu privacidad es prioridad.</strong> Los enlaces se procesan de forma temporal y se eliminan automáticamente.</span>
            </div>
          </div>
        </section>

        <section className="history-section" aria-labelledby="history-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">TU ACTIVIDAD</span>
              <h2 id="history-title">Descargas recientes</h2>
            </div>
            <button type="button" className="text-button history-action">Ver todo →</button>
          </div>
          <div className="history-list">
            {demoHistory.map((item, index) => (
              <article className="history-item" key={item.title}>
                <div className={`file-icon file-icon-${index}`} aria-hidden="true">{item.format === 'MP3' ? '♪' : '▶'}</div>
                <div className="file-details">
                  <h3>{item.title}</h3>
                  <p>{item.meta}</p>
                </div>
                <span className="format-badge">{item.format}</span>
                <time>{item.time}</time>
                <button type="button" aria-label={`Más opciones para ${item.title}`} className="more-button">•••</button>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#"><span className="brand-mark">N</span><span>Nico<span>Play</span></span></a>
        <p>Convierte únicamente contenido propio o con permiso de su titular.</p>
        <nav aria-label="Enlaces legales">
          <a href="#privacy">Privacidad</a>
          <a href="#terms">Términos</a>
          <a href="mailto:soporte@example.com">Soporte</a>
        </nav>
      </footer>
    </div>
  )
}

export default App
