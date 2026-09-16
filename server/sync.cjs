/* Private single-process sync service. Run behind an HTTPS reverse proxy. */
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const MAX = 170 * 1024 * 1024;
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const validId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
function validateUsers(users) {
  if (!Array.isArray(users) || !users.length)
    throw new Error("Provision at least one identity.");
  const ids = new Set(),
    tokens = new Set();
  for (const u of users) {
    if (
      !validId(u.id) ||
      !validId(u.space) ||
      !["owner", "writer", "reader"].includes(u.role) ||
      !/^[a-f0-9]{64}$/.test(u.tokenHash) ||
      !Number.isFinite(Date.parse(u.expiresAt)) ||
      ids.has(u.id) ||
      tokens.has(u.tokenHash)
    )
      throw new Error("Invalid or duplicate identity.");
    ids.add(u.id);
    tokens.add(u.tokenHash);
  }
}
function validateArchive(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw) > 160 * 1024 * 1024)
    throw new Error("Archive too large.");
  const a = JSON.parse(raw);
  if (
    a.app !== "quotidien" ||
    a.format !== 2 ||
    !a.state ||
    a.state.version !== 2 ||
    !Array.isArray(a.files) ||
    digest(JSON.stringify(a.state)) !== a.stateSha256
  )
    throw new Error("Invalid archive.");
  let total = 0;
  const ids = new Set();
  for (const f of a.files) {
    if (
      !f ||
      typeof f.id !== "string" ||
      ids.has(f.id) ||
      typeof f.base64 !== "string" ||
      /[^A-Za-z0-9+/=]/.test(f.base64)
    )
      throw new Error("Invalid attachment.");
    const bytes = Buffer.from(f.base64, "base64");
    total += bytes.length;
    ids.add(f.id);
    if (
      bytes.toString("base64") !== f.base64 ||
      bytes.length !== f.size ||
      bytes.length > 25 * 1024 * 1024 ||
      total > 100 * 1024 * 1024 ||
      digest(bytes) !== f.sha256
    )
      throw new Error("Attachment integrity failure.");
  }
}
async function createService({ directory, users, origin }) {
  validateUsers(users);
  if (!origin || new URL(origin).origin !== origin)
    throw new Error("Set one exact frontend origin.");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  // A second process cannot bypass the serial compare-and-swap queue.
  const lockPath = path.join(directory, "service.lock");
  const lock = await fs.open(lockPath, "wx", 0o600);
  await lock.writeFile(String(process.pid));
  const queues = new Map();
  async function serial(space, action) {
    const next = (queues.get(space) || Promise.resolve()).then(action, action);
    queues.set(
      space,
      next.catch(() => {}),
    );
    return next;
  }
  const file = (space, previous = false) =>
    path.join(directory, space, previous ? "previous.json" : "current.json");
  async function read(space) {
    try {
      return JSON.parse(await fs.readFile(file(space), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return { revision: 0, archive: null };
      throw error;
    }
  }
  async function save(space, data, previous = false) {
    await fs.mkdir(path.join(directory, space), {
      recursive: true,
      mode: 0o700,
    });
    const temp = file(space, previous) + "." + crypto.randomUUID() + ".tmp";
    try {
      const handle = await fs.open(temp, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(data));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temp, file(space, previous));
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
  async function body(req) {
    if (Number(req.headers["content-length"] || 0) > MAX) {
      const error = new Error("Too large");
      error.status = 413;
      throw error;
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > MAX) {
        const error = new Error("Too large");
        error.status = 413;
        throw error;
      }
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.origin && req.headers.origin !== origin)
        return send(403, { error: "Origin denied" });
      if (req.headers.origin === origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type",
        );
        return send(204, null);
      }
      const bearer = /^Bearer (\S{32,512})$/.exec(
        req.headers.authorization || "",
      );
      const hash = digest(bearer?.[1] || "");
      const user = users.find((u) =>
        crypto.timingSafeEqual(
          Buffer.from(u.tokenHash, "hex"),
          Buffer.from(hash, "hex"),
        ),
      );
      if (!bearer || !user || Date.parse(user.expiresAt) <= Date.now())
        return send(401, { error: "Unauthorized" });
      if (req.url === "/me" && req.method === "GET")
        return send(200, { user: user.id, role: user.role });
      if (req.url === "/snapshot" && req.method === "GET")
        return send(200, await serial(user.space, () => read(user.space)));
      if (req.url === "/snapshot" && req.method === "PUT") {
        if (user.role === "reader") return send(403, { error: "Read only" });
        if (!String(req.headers["content-type"]).startsWith("application/json"))
          return send(415, { error: "JSON required" });
        const input = await body(req);
        if (!Number.isSafeInteger(input.revision) || input.revision < 0)
          return send(400, { error: "Invalid revision" });
        validateArchive(input.archive);
        const result = await serial(user.space, async () => {
          const old = await read(user.space);
          if (old.revision !== input.revision) return null;
          const current = {
            revision: old.revision + 1,
            archive: input.archive,
            updatedAt: new Date().toISOString(),
            actor: user.id,
          };
          // Keep the previous complete state and attachments before replacement.
          if (old.archive) await save(user.space, old, true);
          await save(user.space, current);
          return current.revision;
        });
        return result === null
          ? send(409, { error: "Revision conflict" })
          : send(200, { revision: result });
      }
      return send(404, { error: "Not found" });
    } catch (error) {
      send(error.status || 400, {
        error: error.status === 413 ? "Archive too large" : "Request rejected",
      });
    }
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 10000;
  server.on("close", () => {
    void lock.close().then(() => fs.rm(lockPath, { force: true }));
  });
  return server;
}
module.exports = { createService, validateArchive };
if (require.main === module) {
  (async () => {
    if (!process.env.QUOTIDIEN_AUTH_FILE || !process.env.QUOTIDIEN_ORIGIN)
      throw new Error("Set QUOTIDIEN_AUTH_FILE and QUOTIDIEN_ORIGIN.");
    const users = JSON.parse(
      await fs.readFile(process.env.QUOTIDIEN_AUTH_FILE, "utf8"),
    );
    const server = await createService({
      directory: process.env.QUOTIDIEN_DATA_DIR || "server-data",
      users,
      origin: process.env.QUOTIDIEN_ORIGIN,
    });
    server.listen(
      Number(process.env.PORT || 8787),
      process.env.HOST || "127.0.0.1",
      () => console.log("QUOTIDIEN sync service ready"),
    );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => server.close(() => (process.exitCode = 0)));
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
