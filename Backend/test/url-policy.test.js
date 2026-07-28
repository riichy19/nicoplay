const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hostAllowed,
  isPrivateIp,
  validateMediaUrl,
} = require("../src/security/url-policy");

test("permite el dominio exacto y sus subdominios", () => {
  assert.equal(hostAllowed("youtube.com", ["youtube.com"]), true);
  assert.equal(hostAllowed("www.youtube.com", ["youtube.com"]), true);
  assert.equal(hostAllowed("notyoutube.com", ["youtube.com"]), false);
});

test("bloquea direcciones privadas y reservadas", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.1.1",
    "::1",
    "fd00::1",
  ]) {
    assert.equal(isPrivateIp(address), true, address);
  }
  assert.equal(isPrivateIp("8.8.8.8"), false);
  assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
});

test("normaliza una URL pública permitida", async () => {
  const lookup = async () => [{ address: "8.8.8.8", family: 4 }];
  const url = await validateMediaUrl(
    "https://www.youtube.com/watch?v=abc#fragment",
    ["youtube.com"],
    lookup,
  );
  assert.equal(url, "https://www.youtube.com/watch?v=abc");
});

test("rechaza dominios no permitidos antes de resolver DNS", async () => {
  await assert.rejects(
    validateMediaUrl("http://localhost/video", ["youtube.com"], async () => []),
    (error) => error.code === "UNSUPPORTED_HOST",
  );
});

test("rechaza un dominio permitido si resuelve a una red privada", async () => {
  const lookup = async () => [{ address: "127.0.0.1", family: 4 }];
  await assert.rejects(
    validateMediaUrl("https://youtube.com/video", ["youtube.com"], lookup),
    (error) => error.code === "PRIVATE_ADDRESS",
  );
});
