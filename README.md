# NicoPlay

Aplicación full stack organizada como un monorepo con npm workspaces. El frontend
React y la API Express comparten una sola instalación de dependencias, un solo
`package-lock.json` y comandos desde la raíz.

## Estructura

```text
.
├── app.js                         # Punto de entrada de toda la aplicación
├── Backend/
│   └── src/
│       ├── app.js                 # Ensambla middleware, rutas y frontend
│       └── routes/                # Rutas HTTP separadas por responsabilidad
└── FrontEnd/reproductor-mp3/
    └── src/api/media.ts           # Cliente de la API
```

## Instalar y desarrollar

Ejecuta todo desde esta carpeta:

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

Vite envía automáticamente `/api` y `/health` al backend. Al usar rutas relativas
no hace falta configurar CORS ni mantener URLs distintas por ambiente.

## Producción

```bash
npm run build
npm start
```

Express sirve tanto la API como el frontend compilado en
`http://localhost:3000`.

## Comandos

| Comando | Acción |
| --- | --- |
| `npm run dev` | Inicia frontend y backend |
| `npm run build` | Compila React para producción |
| `npm start` | Inicia la aplicación completa |
| `npm test` | Ejecuta las pruebas del backend |
| `npm run lint` | Revisa el frontend |

Para convertir contenido localmente también necesitas `yt-dlp` y FFmpeg en
`PATH`. Usa la aplicación únicamente con contenido propio o autorizado.

