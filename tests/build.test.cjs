const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
test("production entry points reference existing, hashed scripts and styles", () => {
  for (const entry of ["index.html", "404.html"]) {
    const html = fs.readFileSync("dist/" + entry, "utf8");
    for (const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) {
      assert.ok(fs.existsSync(path.join("dist", match[1])), match[1]);
    }
    assert.match(html, /assets\/app\.[a-f0-9]{12}\.js/);
    assert.match(html, /assets\/core\.[a-f0-9]{12}\.js/);
    const scripts = Array.from(
      html.matchAll(/<script src="([^"]+)"/g),
      (m) => m[1],
    );
    assert.match(scripts[0], /core\./);
    assert.match(scripts[1], /app\./);
  }
  for (const file of fs
    .readdirSync("dist/assets")
    .filter((x) => x.endsWith(".js")))
    assert.doesNotThrow(
      () => new vm.Script(fs.readFileSync("dist/assets/" + file, "utf8")),
    );
});
test("only public build output is packaged; manifest works at a subpath", () => {
  assert.equal(fs.existsSync("dist/legacy"), false);
  assert.equal(fs.existsSync("dist/src"), false);
  assert.equal(fs.existsSync("dist/package.json"), false);
  const manifest = JSON.parse(fs.readFileSync("dist/manifest.webmanifest"));
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./#today");
  for (const icon of manifest.icons)
    assert.ok(fs.existsSync(path.join("dist", icon.src)));
  assert.equal(
    JSON.parse(fs.readFileSync("dist/version.json")).release,
    require("../package.json").version,
  );
});
test("retirement worker touches only historical Quotidien caches", async () => {
  const callbacks = {},
    deleted = [];
  let unregistered = false;
  const ctx = vm.createContext({
    self: {
      addEventListener: (event, fn) => (callbacks[event] = fn),
      skipWaiting: async () => {},
      registration: {
        unregister: async () => {
          unregistered = true;
        },
      },
    },
    caches: {
      keys: async () => [
        "quotidien-v6.1.0",
        "quotidien-v7.1.3",
        "other-app",
        "quotidien-unknown",
      ],
      delete: async (key) => deleted.push(key),
    },
  });
  vm.runInContext(fs.readFileSync("public/sw.js", "utf8"), ctx);
  let work;
  callbacks.activate({ waitUntil: (p) => (work = p) });
  await work;
  assert.deepEqual(deleted, ["quotidien-v6.1.0", "quotidien-v7.1.3"]);
  assert.equal(unregistered, true);
});
