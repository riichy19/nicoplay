const dns = require("node:dns").promises;
const net = require("node:net");
const { AppError } = require("../errors");

function ipv4ToNumber(address) {
  const parts = address.split(".").map(Number);
  return (
    (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>>
    0
  );
}

function inIpv4Range(address, base, prefix) {
  const value = ipv4ToNumber(address);
  const baseValue = ipv4ToNumber(base);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const blocked = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return blocked.some(([base, prefix]) => inIpv4Range(address, base, prefix));
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }

  return true;
}

function hostAllowed(hostname, allowedHosts) {
  return allowedHosts.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

async function validateMediaUrl(rawUrl, allowedHosts, lookup = dns.lookup) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > 2048) {
    throw new AppError(400, "INVALID_URL", "La URL no es válida");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError(400, "INVALID_URL", "La URL no es válida");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError(400, "INVALID_URL", "Solo se permiten URLs HTTP o HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new AppError(400, "INVALID_URL", "La URL no puede incluir credenciales");
  }
  if (parsed.port && !["80", "443"].includes(parsed.port)) {
    throw new AppError(400, "INVALID_URL", "El puerto indicado no está permitido");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostAllowed(hostname, allowedHosts)) {
    throw new AppError(
      400,
      "UNSUPPORTED_HOST",
      `Plataforma no permitida. Dominios admitidos: ${allowedHosts.join(", ")}`,
    );
  }
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new AppError(400, "PRIVATE_ADDRESS", "La dirección no está permitida");
  }

  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(400, "DNS_ERROR", "No fue posible resolver el dominio");
  }

  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateIp(address))
  ) {
    throw new AppError(400, "PRIVATE_ADDRESS", "La dirección no está permitida");
  }

  parsed.hash = "";
  parsed.searchParams.delete("list");
  parsed.searchParams.delete("index");
  parsed.searchParams.delete("start_radio");
  return parsed.toString();
}

module.exports = { hostAllowed, isPrivateIp, validateMediaUrl };
