const express = require("express");
const { AppError } = require("../errors");
const { asyncRoute } = require("../middleware/async-route");

function createMediaRouter({ config, mediaService, validateUrl }) {
  const router = express.Router();
  const maxUploadMb = config.maxFileSizeMb || 1024;

  router.post(
    "/upload",
    express.raw({
      type: ["application/octet-stream", "audio/*", "video/*"],
      limit: `${maxUploadMb}mb`,
    }),
    asyncRoute(async (req, res) => {
      const format = String(req.query.format || "").toLowerCase();
      if (!['mp3', 'mp4'].includes(format)) {
        throw new AppError(400, "INVALID_FORMAT", "format debe ser mp3 o mp4");
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new AppError(400, "EMPTY_FILE", "Selecciona un archivo para convertir");
      }

      const controller = new AbortController();
      const abort = () => { if (!res.writableEnded) controller.abort(); };
      req.once("aborted", abort);
      res.once("close", abort);
      let file;
      try {
        file = await mediaService.convertUpload(
          req.body,
          req.get("x-file-name") || "media",
          format,
          controller.signal,
        );
      } finally {
        req.removeListener("aborted", abort);
        res.removeListener("close", abort);
      }
      res.download(file.path, file.filename, async (error) => {
        await file.cleanup().catch(() => {});
        if (error && !res.headersSent) res.status(500).end();
      });
    }),
  );

  router.post("/info", asyncRoute(async (req, res) => {
    const url = await validateUrl(req.body?.url, config.allowedHosts);
    const controller = new AbortController();
    const abort = () => {
      if (!res.writableEnded) controller.abort();
    };

    req.once("aborted", abort);
    res.once("close", abort);
    try {
      const info = await mediaService.info(url, controller.signal);
      res.json({ data: info });
    } finally {
      req.removeListener("aborted", abort);
      res.removeListener("close", abort);
    }
  }));

  router.post("/download", asyncRoute(async (req, res) => {
    const format = String(req.body?.format || "").toLowerCase();
    if (!["mp3", "mp4"].includes(format)) {
      throw new AppError(400, "INVALID_FORMAT", "format debe ser mp3 o mp4");
    }

    const url = await validateUrl(req.body?.url, config.allowedHosts);
    const controller = new AbortController();
    const abort = () => {
      if (!res.writableEnded) controller.abort();
    };

    req.once("aborted", abort);
    res.once("close", abort);
    let file;
    try {
      file = await mediaService.download(url, format, controller.signal);
    } finally {
      req.removeListener("aborted", abort);
      res.removeListener("close", abort);
    }

    res.download(file.path, file.filename, async (error) => {
      await file.cleanup().catch(() => {});
      if (error && !res.headersSent) res.status(500).end();
    });
  }));

  return router;
}

module.exports = { createMediaRouter };
