const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { loadConfig } = require("./config");
const { AppError } = require("./errors");
const { createRoutes } = require("./routes");
const { validateMediaUrl } = require("./security/url-policy");
const { MediaService } = require("./services/media-service");

function createApp(options = {}) {
  const config = options.config || loadConfig();
  const mediaService = options.mediaService || new MediaService(config);
  const validateUrl = options.validateUrl || validateMediaUrl;
  const frontendDist =
    options.frontendDist ||
    path.resolve(__dirname, "../../FrontEnd/reproductor-mp3/dist");
  const serveFrontend =
    options.serveFrontend ?? process.env.NODE_ENV === "production";
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use(createRoutes({ config, mediaService, validateUrl }));

  if (serveFrontend && fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
      const acceptsHtml = req.method === "GET" && req.accepts("html");
      const isBackendRoute =
        req.path === "/health" || req.path.startsWith("/api/");

      if (!acceptsHtml || isBackendRoute) return next();
      return res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Ruta no encontrada" },
    });
  });

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    const known = error instanceof AppError;
    const status = known ? error.status : error.type === "entity.parse.failed" ? 400 : 500;
    const code = known
      ? error.code
      : error.type === "entity.parse.failed"
        ? "INVALID_JSON"
        : "INTERNAL_ERROR";
    const message = known
      ? error.message
      : error.type === "entity.parse.failed"
        ? "El cuerpo JSON no es válido"
        : "Error interno del servidor";

    if (!known && process.env.NODE_ENV !== "test") console.error(error);
    res.status(status).json({
      error: {
        code,
        message,
        ...(known && error.details ? { details: error.details } : {}),
      },
    });
  });

  return app;
}

module.exports = { createApp };
