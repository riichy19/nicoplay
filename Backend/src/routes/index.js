const express = require("express");
const { createRateLimit } = require("../middleware/rate-limit");
const { createHealthRouter } = require("./health.routes");
const { createMediaRouter } = require("./media.routes");

function createRoutes(dependencies) {
  const router = express.Router();
  const { config } = dependencies;

  router.use("/health", createHealthRouter(dependencies));
  router.use(
    "/api",
    createRateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
    }),
  );
  router.use("/api/media", createMediaRouter(dependencies));

  return router;
}

module.exports = { createRoutes };
