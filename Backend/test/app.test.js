const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs").promises;
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../src/app");

function testConfig() {
  return {
    trustProxy: false,
    allowedHosts: ["youtube.com"],
    rateLimitWindowMs: 60_000,
    rateLimitMax: 100,
  };
}

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /health informa disponibilidad", async () => {
  const mediaService = {
    checkDependencies: async () => ({ ytDlp: true, ffmpeg: true }),
  };
  await withServer(createApp({ config: testConfig(), mediaService }), async (base) => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      tools: { ytDlp: true, ffmpeg: true },
    });
  });
});

test("rechaza formatos distintos de mp3 y mp4", async () => {
  const mediaService = {
    checkDependencies: async () => ({ ytDlp: true, ffmpeg: true }),
  };
  await withServer(createApp({ config: testConfig(), mediaService }), async (base) => {
    const response = await fetch(`${base}/api/media/download`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://youtube.com/watch?v=x", format: "avi" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_FORMAT");
  });
});

test("devuelve metadatos a través de la API", async () => {
  const mediaService = {
    checkDependencies: async () => ({ ytDlp: true, ffmpeg: true }),
    info: async (url) => ({ title: "Video", webpageUrl: url }),
  };
  const validateUrl = async (url) => url;
  const app = createApp({ config: testConfig(), mediaService, validateUrl });

  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/media/info`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://youtube.com/watch?v=x" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.title, "Video");
  });
});

test("sirve el frontend y conserva los errores JSON de la API", async () => {
  const frontendDist = await fs.mkdtemp(path.join(os.tmpdir(), "nicoplay-test-"));
  await fs.writeFile(
    path.join(frontendDist, "index.html"),
    "<!doctype html><title>NicoPlay</title>",
  );

  const mediaService = {
    checkDependencies: async () => ({ ytDlp: true, ffmpeg: true }),
  };
  const app = createApp({
    config: testConfig(),
    mediaService,
    frontendDist,
    serveFrontend: true,
  });

  try {
    await withServer(app, async (base) => {
      const page = await fetch(base, {
        headers: { accept: "text/html" },
      });
      assert.equal(page.status, 200);
      assert.match(await page.text(), /NicoPlay/);

      const api = await fetch(`${base}/api/desconocida`);
      assert.equal(api.status, 404);
      assert.equal((await api.json()).error.code, "NOT_FOUND");
    });
  } finally {
    await fs.rm(frontendDist, { recursive: true, force: true });
  }
});
