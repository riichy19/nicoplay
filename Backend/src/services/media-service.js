const { spawn } = require("node:child_process");
const fs = require("node:fs").promises;
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { AppError } = require("../errors");
const { Semaphore } = require("./semaphore");

const MAX_PROCESS_OUTPUT = 2 * 1024 * 1024;

function runProcess(command, args, { timeoutMs, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(result);
    };

    const abort = () => {
      child.kill();
      finish(new AppError(499, "CLIENT_CLOSED", "La solicitud fue cancelada"));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });

    timer = setTimeout(() => {
      child.kill();
      finish(
        new AppError(504, "DOWNLOAD_TIMEOUT", "La operación excedió el tiempo límite"),
      );
    }, timeoutMs);
    timer.unref();

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > MAX_PROCESS_OUTPUT) {
        child.kill();
        finish(new AppError(502, "TOOL_OUTPUT_LIMIT", "Respuesta externa demasiado grande"));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > MAX_PROCESS_OUTPUT) stderr = stderr.slice(-MAX_PROCESS_OUTPUT);
    });
    child.on("error", (error) => {
      const missing = error.code === "ENOENT";
      finish(
        new AppError(
          503,
          missing ? "TOOL_NOT_INSTALLED" : "TOOL_ERROR",
          missing
            ? `No se encontró la herramienta requerida: ${command}`
            : "No fue posible iniciar la herramienta de descarga",
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) return finish(null, { stdout, stderr });
      finish(
        new AppError(
          422,
          "MEDIA_PROCESSING_FAILED",
          "No fue posible procesar el contenido solicitado",
          process.env.NODE_ENV === "development" ? stderr.slice(-1000) : undefined,
        ),
      );
    });
  });
}

function safeDownloadName(value, fallback) {
  const cleaned = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return cleaned || fallback;
}

class MediaService {
  constructor(config) {
    this.config = config;
    this.semaphore = new Semaphore(config.maxConcurrentDownloads);
  }

  commonArgs() {
    const args = [
      "--no-playlist",
      "--no-warnings",
      "--no-call-home",
      "--socket-timeout",
      "20",
      "--js-runtimes",
      "node",
    ];
    if (this.config.ffmpegPath !== "ffmpeg") {
      args.push("--ffmpeg-location", this.config.ffmpegPath);
    }
    return args;
  }

  async info(url, signal) {
    const { stdout } = await runProcess(
      this.config.ytDlpPath,
      [...this.commonArgs(), "--dump-single-json", "--skip-download", url],
      { timeoutMs: Math.min(this.config.downloadTimeoutMs, 60_000), signal },
    );

    let data;
    try {
      data = JSON.parse(stdout);
    } catch {
      throw new AppError(502, "INVALID_TOOL_RESPONSE", "La plataforma devolvió datos inválidos");
    }

    return {
      id: data.id ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      duration: data.duration ?? null,
      uploader: data.uploader ?? data.channel ?? null,
      uploadDate: data.upload_date ?? null,
      thumbnail: data.thumbnail ?? null,
      webpageUrl: data.webpage_url ?? url,
      extractor: data.extractor_key ?? data.extractor ?? null,
      formats: ["mp3", "mp4"],
    };
  }

  async download(url, format, signal) {
    const release = await this.semaphore.acquire();
    const jobDir = path.join(this.config.tempDir, randomUUID());
    await fs.mkdir(jobDir, { recursive: true });

    try {
      const outputTemplate = path.join(jobDir, "%(title).140B-[%(id)s].%(ext)s");
      const formatArgs =
        format === "mp3"
          ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"]
          : [
              "--format",
              `bv*[height<=${this.config.maxVideoHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${this.config.maxVideoHeight}][ext=mp4]/bv*[height<=${this.config.maxVideoHeight}]+ba/b[height<=${this.config.maxVideoHeight}]`,
              "--merge-output-format",
              "mp4",
            ];

      const { stdout } = await runProcess(
        this.config.ytDlpPath,
        [
          ...this.commonArgs(),
          "--max-filesize",
          `${this.config.maxFileSizeMb}M`,
          "--match-filter",
          `!is_live & duration <= ${this.config.maxDurationSeconds}`,
          ...formatArgs,
          "--output",
          outputTemplate,
          "--print",
          "after_move:filepath",
          url,
        ],
        { timeoutMs: this.config.downloadTimeoutMs, signal },
      );

      const reportedPath = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
      const resolvedPath = reportedPath ? path.resolve(reportedPath) : "";
      const resolvedJobDir = `${path.resolve(jobDir)}${path.sep}`;
      if (!resolvedPath.startsWith(resolvedJobDir)) {
        throw new AppError(502, "INVALID_OUTPUT_PATH", "Ruta de salida no válida");
      }

      const stat = await fs.stat(resolvedPath).catch(() => null);
      if (!stat?.isFile()) {
        throw new AppError(502, "OUTPUT_NOT_FOUND", "No se generó el archivo esperado");
      }
      if (stat.size > this.config.maxFileSizeMb * 1024 * 1024) {
        throw new AppError(413, "FILE_TOO_LARGE", "El archivo supera el tamaño permitido");
      }

      const extension = format === "mp3" ? ".mp3" : ".mp4";
      return {
        path: resolvedPath,
        filename: `${safeDownloadName(path.basename(resolvedPath, path.extname(resolvedPath)), "media")}${extension}`,
        cleanup: () => fs.rm(jobDir, { recursive: true, force: true }),
      };
    } catch (error) {
      await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    } finally {
      release();
    }
  }

  async checkDependencies() {
    const timeoutMs = 10_000;
    const [ytDlp, ffmpeg] = await Promise.allSettled([
      runProcess(this.config.ytDlpPath, ["--version"], { timeoutMs }),
      runProcess(this.config.ffmpegPath, ["-version"], { timeoutMs }),
    ]);
    return {
      ytDlp: ytDlp.status === "fulfilled",
      ffmpeg: ffmpeg.status === "fulfilled",
    };
  }
}

module.exports = { MediaService, runProcess, safeDownloadName };
