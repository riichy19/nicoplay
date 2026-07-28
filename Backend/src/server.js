const fs = require("node:fs").promises;
const { createApp } = require("./app");
const { loadConfig } = require("./config");

async function main() {
  const config = loadConfig();
  await fs.mkdir(config.tempDir, { recursive: true });
  const app = createApp({ config });

  const server = app.listen(config.port, () => {
    console.log(`API disponible en http://localhost:${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal}: cerrando servidor...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };
