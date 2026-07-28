const express = require("express");
const { asyncRoute } = require("../middleware/async-route");

function createHealthRouter({ mediaService }) {
  const router = express.Router();

  router.get("/", asyncRoute(async (_req, res) => {
    const tools = await mediaService.checkDependencies();
    const ready = tools.ytDlp && tools.ffmpeg;

    res.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "degraded",
      tools,
    });
  }));

  return router;
}

module.exports = { createHealthRouter };
