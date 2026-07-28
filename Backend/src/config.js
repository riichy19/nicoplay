const path = require("node:path");

function integer(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}`);
  }
  return value;
}

function boolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} debe ser true o false`);
}

function hosts() {
  const raw =
    process.env.ALLOWED_HOSTS || "youtube.com,youtu.be,x.com,twitter.com";
  const values = raw
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error("ALLOWED_HOSTS debe contener al menos un dominio");
  }
  return [...new Set(values)];
}

function loadConfig() {
  return Object.freeze({
    port: integer("PORT", 3000, { min: 1, max: 65535 }),
    trustProxy: boolean("TRUST_PROXY", false),
    ytDlpPath: process.env.YTDLP_PATH || "yt-dlp",
    ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
    tempDir: path.resolve(process.env.TEMP_DIR || "./tmp"),
    allowedHosts: hosts(),
    maxConcurrentDownloads: integer("MAX_CONCURRENT_DOWNLOADS", 1, {
      max: 20,
    }),
    maxDurationSeconds: integer("MAX_DURATION_SECONDS", 14_400, {
      min: 60,
      max: 86_400,
    }),
    maxVideoHeight: integer("MAX_VIDEO_HEIGHT", 1080, {
      min: 144,
      max: 4320,
    }),
    maxFileSizeMb: integer("MAX_FILE_SIZE_MB", 8192, { max: 50_000 }),
    downloadTimeoutMs: integer("DOWNLOAD_TIMEOUT_MS", 14_400_000, {
      min: 1_000,
      max: 43_200_000,
    }),
    rateLimitWindowMs: integer("RATE_LIMIT_WINDOW_MS", 60_000, {
      min: 1_000,
      max: 3_600_000,
    }),
    rateLimitMax: integer("RATE_LIMIT_MAX", 20, { max: 10_000 }),
  });
}

module.exports = { loadConfig };
