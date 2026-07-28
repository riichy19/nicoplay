# Convertidor multimedia

Servicio HTTP en Node.js que consulta metadatos y entrega contenido autorizado en
MP3 o MP4. Usa `yt-dlp` para acceder a las plataformas y FFmpeg para procesar los
archivos. La configuración inicial admite contenidos de hasta 4 horas, por lo que
cubre películas de aproximadamente 3 horas.

> Utiliza el servicio únicamente con contenido propio, de dominio público o para
> el que tengas permiso. El operador es responsable de cumplir derechos de autor,
> términos de las plataformas y legislación aplicable. El servicio no elude DRM.

## Inicio rápido con Docker

Docker instala todas las dependencias externas:

```bash
docker compose -f Backend/compose.yaml up --build
```

La API estará disponible en `http://localhost:3000`.

## Ejecución local

Requisitos:

- Node.js 20 o posterior
- `yt-dlp` disponible en `PATH`
- FFmpeg disponible en `PATH`

```bash
npm install
copy Backend\.env.example .env
npm run dev
```

Ejecuta esos comandos desde la raíz del proyecto. Backend y frontend comparten el
`node_modules` y `package-lock.json` de esa carpeta.

Node.js no carga `.env` automáticamente. En Node 20+ puedes iniciar producción
con:

```bash
npm run build
node --env-file=.env app.js
```

## API

### Estado

```http
GET /health
```

Devuelve `200` si `yt-dlp` y FFmpeg están disponibles, o `503` si falta alguno.

### Consultar información

```http
POST /api/media/info
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=..."
}
```

Respuesta:

```json
{
  "data": {
    "id": "...",
    "title": "Título",
    "description": "...",
    "duration": 123,
    "uploader": "Canal",
    "uploadDate": "20260727",
    "thumbnail": "https://...",
    "webpageUrl": "https://...",
    "extractor": "Youtube",
    "formats": ["mp3", "mp4"]
  }
}
```

### Descargar

```http
POST /api/media/download
Content-Type: application/json

{
  "url": "https://x.com/usuario/status/...",
  "format": "mp4"
}
```

`format` admite `mp3` o `mp4`. Si tiene éxito, la respuesta es el archivo como
adjunto. Los archivos temporales se eliminan al terminar la transferencia.

Ejemplo con `curl`:

```bash
curl -L -X POST http://localhost:3000/api/media/download \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.youtube.com/watch?v=...\",\"format\":\"mp3\"}" \
  --output descarga.mp3
```

## Configuración

Consulta [.env.example](.env.example). Las opciones principales son:

| Variable | Valor inicial | Uso |
| --- | ---: | --- |
| `PORT` | `3000` | Puerto HTTP |
| `ALLOWED_HOSTS` | YouTube y X/Twitter | Dominios separados por comas |
| `MAX_CONCURRENT_DOWNLOADS` | `1` | Conversiones simultáneas |
| `MAX_DURATION_SECONDS` | `14400` | Duración máxima: 4 horas |
| `MAX_VIDEO_HEIGHT` | `1080` | Resolución máxima del MP4 |
| `MAX_FILE_SIZE_MB` | `8192` | Tamaño máximo: 8 GB |
| `DOWNLOAD_TIMEOUT_MS` | `14400000` | Tiempo máximo: 4 horas |
| `RATE_LIMIT_MAX` | `20` | Solicitudes por IP y ventana |
| `TRUST_PROXY` | `false` | Activar solo detrás de un proxy confiable |

Los subdominios de cada entrada de `ALLOWED_HOSTS` también se aceptan. No uses una
lista abierta en un servicio expuesto a Internet.

## Archivos largos y almacenamiento

No se utiliza base de datos. Cada operación crea una carpeta temporal, procesa el
contenido y la elimina cuando termina la transferencia. Para películas de 3 horas
se recomienda reservar al menos **20 GB de disco libre por conversión activa**,
porque durante el proceso pueden coexistir video, audio y archivo final.

La concurrencia inicial es `1` para evitar que varias películas llenen el disco.
Si aumentas `MAX_CONCURRENT_DOWNLOADS`, incrementa proporcionalmente el espacio
disponible. También configura en el proxy o proveedor de alojamiento un tiempo de
respuesta de al menos 4 horas; de otro modo el proxy puede cerrar la conexión
aunque Node.js continúe trabajando.

## Pruebas

```bash
npm test
```

Las pruebas unitarias no descargan contenido real.
