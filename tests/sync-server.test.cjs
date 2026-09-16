const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { createService } = require("../server/sync.cjs");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
test("sync isolates identities, enforces roles and serial CAS, and verifies attachments", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "quotidien-sync-"));
  const tokens = {
    owner: "a".repeat(43),
    writer: "b".repeat(43),
    reader: "c".repeat(43),
    other: "d".repeat(43),
    expired: "e".repeat(43),
  };
  const users = Object.entries(tokens).map(([id, token]) => ({
    id,
    space: id === "other" ? "private" : "shared",
    role: ["writer", "reader"].includes(id) ? id : "owner",
    tokenHash: hash(token),
    expiresAt: id === "expired" ? "2020-01-01" : "2099-01-01",
  }));
  const server = await createService({
    directory,
    users,
    origin: "https://example.com",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const url = "http://127.0.0.1:" + server.address().port;
  const request = (
    user,
    route,
    method = "GET",
    data,
    origin = "https://example.com",
  ) =>
    fetch(url + route, {
      method,
      headers: {
        Authorization: "Bearer " + tokens[user],
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  assert.equal((await request("expired", "/me")).status, 401);
  assert.equal(
    (
      await request(
        "owner",
        "/me",
        "GET",
        undefined,
        "https://example.com.evil.test",
      )
    ).status,
    403,
  );
  assert.equal((await request("owner", "/me")).status, 200);
  const state = { version: 2, tasks: [] },
    bytes = Buffer.from("facture"),
    attachment = {
      id: "f",
      size: bytes.length,
      type: "text/plain",
      sha256: hash(bytes),
      base64: bytes.toString("base64"),
    };
  const archive = JSON.stringify({
    app: "quotidien",
    format: 2,
    state,
    stateSha256: hash(JSON.stringify(state)),
    files: [attachment],
  });
  assert.equal(
    (await request("reader", "/snapshot", "PUT", { revision: 0, archive }))
      .status,
    403,
  );
  const results = await Promise.all([
    request("owner", "/snapshot", "PUT", { revision: 0, archive }),
    request("writer", "/snapshot", "PUT", { revision: 0, archive }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await (await request("reader", "/snapshot")).json()).revision,
    1,
  );
  assert.equal(
    (await (await request("other", "/snapshot")).json()).archive,
    null,
  );
  const bad = JSON.parse(archive);
  bad.files[0].sha256 = "0".repeat(64);
  assert.equal(
    (
      await request("owner", "/snapshot", "PUT", {
        revision: 1,
        archive: JSON.stringify(bad),
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("writer", "/snapshot", "PUT", { revision: 1, archive }))
      .status,
    200,
  );
  const previous = JSON.parse(
    await fs.readFile(path.join(directory, "shared", "previous.json"), "utf8"),
  );
  assert.equal(previous.revision, 1);
  assert.equal(previous.archive, archive);
  await assert.rejects(
    () => createService({ directory, users, origin: "https://example.com" }),
    /EEXIST/,
  );
});
