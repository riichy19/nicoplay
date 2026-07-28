# NicoPlay

Interfaz responsiva para convertir enlaces de video a MP3 o MP4. Incluye
validación de URL, selección de formato y calidad, estados de conversión,
progreso, alertas e historial reciente.

## Desarrollo

Desde la raíz del proyecto:

```bash
npm install
npm run dev
```

El frontend usa `/api/media/info` y `/api/media/download`. En desarrollo Vite
redirige ambas rutas a Express; en producción Express sirve el frontend
compilado. No se necesita configurar CORS ni una URL duplicada para la API.

## Producción

```bash
npm run build
npm start
```
