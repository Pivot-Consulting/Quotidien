const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"),
  fs = require("node:fs");
const { webcrypto } = require("node:crypto");
const { IDBFactory, IDBObjectStore } = require("fake-indexeddb");
const context = vm.createContext({
  Date,
  Set,
  Map,
  Blob,
  Uint8Array,
  TextEncoder,
  crypto: webcrypto,
  btoa,
  atob,
});
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const Q = context.Q;
async function setup() {
  const values = new Map();
  const local = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  const repo = new Q.Durable.Repository(local, new IDBFactory());
  await repo.open();
  await repo.load();
  return repo;
}
async function fixture() {
  const repo = await setup();
  let s = Q.empty();
  await repo.putFile(
    "old",
    new Blob(["ancienne pièce"], { type: "text/plain" }),
  );
  await repo.putFile(
    "new",
    new Blob(["nouvelle pièce"], { type: "text/plain" }),
  );
  s.documents = [
    {
      id: "d",
      title: "Contrat",
      fileId: "old",
      fileSize: 14,
      fileType: "text/plain",
    },
  ];
  s = await repo.commit(s);
  s.documents[0].fileId = "new";
  s = await repo.commit(s);
  return { repo, s };
}
test("complete backup restores current and historical files on a fresh browser", async () => {
  const { repo, s } = await fixture(),
    target = await setup();
  const raw = await Q.FullBackup.create(s, repo);
  const prepared = await Q.FullBackup.prepare(raw);
  assert.equal(prepared.files.length, 2);
  const restored = await target.commit(prepared.state, true, prepared.files);
  assert.equal(
    await (await target.getFile(restored.documents[0].fileId)).text(),
    "nouvelle pièce",
  );
  const prior = Q.Personal.revisions(restored).find(
    (r) => r.before?.fileId,
  )?.before;
  assert.equal(
    await (await target.getFile(prior.fileId)).text(),
    "ancienne pièce",
  );
  assert.equal(restored.documents[0].title, "Contrat");
  repo.close();
  target.close();
});
test("missing, corrupted, duplicate and altered-state archives fail before writes", async () => {
  const { repo, s } = await fixture();
  const archive = JSON.parse(await Q.FullBackup.create(s, repo));
  for (const mutate of [
    (a) => a.files.pop(),
    (a) => a.files.push(a.files[0]),
    (a) => (a.files[0].sha256 = "bad"),
    (a) => (a.state.documents[0].title = "altéré"),
  ]) {
    const a = structuredClone(archive);
    mutate(a);
    await assert.rejects(Q.FullBackup.prepare(JSON.stringify(a)));
  }
  await repo.deleteFile("old");
  await assert.rejects(Q.FullBackup.create(s, repo), /manquant/);
  repo.close();
});
test("restore remaps IDs, preserves checkpoint files and rolls back quota failures atomically", async () => {
  const { repo, s } = await fixture();
  const raw = await Q.FullBackup.create(s, repo);
  const prepared = await Q.FullBackup.prepare(raw);
  const before = await repo.read("current");
  const checkpoint = await repo.read(Q.CHECKPOINT_KEY);
  const original = IDBObjectStore.prototype.add;
  try {
    IDBObjectStore.prototype.add = function (value, key) {
      this.transaction.abort();
      return undefined;
    };
    await assert.rejects(repo.commit(prepared.state, true, prepared.files));
  } finally {
    IDBObjectStore.prototype.add = original;
  }
  assert.equal(await repo.read("current"), before);
  assert.equal(await repo.read(Q.CHECKPOINT_KEY), checkpoint);
  assert.equal(await repo.getFile(prepared.files[0].id), null);
  await repo.commit(prepared.state, true, prepared.files);
  assert.equal(await repo.read(Q.CHECKPOINT_KEY), before);
  assert.equal(await (await repo.getFile("old")).text(), "ancienne pièce");
  assert.equal(await (await repo.getFile("new")).text(), "nouvelle pièce");
  repo.close();
});
test("complete restore refuses stale concurrent writers including their files", async () => {
  const { repo, s } = await fixture();
  const prepared = await Q.FullBackup.prepare(
    await Q.FullBackup.create(s, repo),
  );
  // Simulate another tab updating the persistent current value.
  const db = await new Promise((resolve) => {
    const r = repo.db.transaction("data", "readwrite");
    r.objectStore("data").put(
      JSON.stringify({ ...s, screen: "notes" }),
      "current",
    );
    r.oncomplete = () => resolve();
  });
  await assert.rejects(
    repo.commit(prepared.state, true, prepared.files),
    /autre onglet/,
  );
  assert.equal(await repo.getFile(prepared.files[0].id), null);
  repo.close();
});
