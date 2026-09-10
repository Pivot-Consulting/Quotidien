const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { IDBFactory } = require("fake-indexeddb");
const context = vm.createContext({ Date, Set, Map });
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const Q = context.Q;
test("aborted final write rolls back both primary and previous snapshot", async () => {
  const a = await setup(),
    before = await a.repo.read("current"),
    previous = await a.repo.read(Q.BACKUP_KEY);
  const { IDBObjectStore } = require("fake-indexeddb"),
    original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "current") {
        this.transaction.abort();
        return;
      }
      return original.call(this, value, key);
    };
    a.state.tasks[0].title = "Ne doit pas passer";
    await assert.rejects(a.repo.commit(a.state));
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.equal(await a.repo.read("current"), before);
  assert.equal(await a.repo.read(Q.BACKUP_KEY), previous);
  await a.repo.commit(a.state);
  assert.equal((await a.repo.load()).tasks[0].title, "Ne doit pas passer");
  a.repo.close();
});
function storage() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
}
async function setup() {
  const local = storage(),
    factory = new IDBFactory();
  const seed = Q.empty();
  seed.tasks.push({
    id: "task",
    title: "Avant migration",
    custom: { preserve: true },
  });
  const raw = JSON.stringify(seed);
  local.setItem(Q.KEY, raw);
  const repo = new Q.Durable.Repository(local, factory);
  await repo.open();
  return { local, factory, repo, raw, state: await repo.load() };
}
test("migration preserves original data, unknown fields and an independent snapshot", async () => {
  const a = await setup();
  a.state.tasks[0].title = "Après migration";
  await a.repo.commit(a.state);
  assert.equal(a.local.getItem(Q.KEY), a.raw);
  assert.equal(
    JSON.parse(await a.repo.read("migration")).tasks[0].title,
    "Avant migration",
  );
  const reopened = new Q.Durable.Repository(a.local, a.factory);
  await reopened.open();
  const state = await reopened.load();
  assert.equal(state.tasks[0].title, "Après migration");
  assert.equal(state.tasks[0].custom.preserve, true);
  a.repo.close();
  reopened.close();
});
test("competing tabs cannot overwrite a newer transaction", async () => {
  const a = await setup(),
    b = new Q.Durable.Repository(a.local, a.factory);
  await b.open();
  const stale = await b.load();
  a.state.tasks[0].title = "Premier";
  await a.repo.commit(a.state);
  stale.tasks[0].title = "Périmé";
  await assert.rejects(b.commit(stale), /autre onglet/);
  assert.equal((await b.load()).tasks[0].title, "Premier");
  a.repo.close();
  b.close();
});
test("checkpoint and previous snapshot commit atomically; invalid input changes neither", async () => {
  const a = await setup();
  const before = await a.repo.read("current");
  a.state.tasks[0].title = "Importé";
  await a.repo.commit(a.state, true);
  assert.equal(await a.repo.read(Q.CHECKPOINT_KEY), before);
  assert.equal(await a.repo.read(Q.BACKUP_KEY), before);
  const current = await a.repo.read("current");
  await assert.rejects(a.repo.commit({ version: 2, tasks: null }));
  assert.equal(await a.repo.read("current"), current);
  assert.equal(await a.repo.read(Q.BACKUP_KEY), before);
  a.repo.close();
});
test("old app writes are detected without deleting either copy", async () => {
  const a = await setup();
  const newer = Q.clone(a.state);
  newer.tasks[0].title = "Ancienne application";
  a.local.setItem(Q.KEY, JSON.stringify(newer));
  await assert.rejects(a.repo.commit(a.state), /ancienne version/);
  await assert.rejects(a.repo.load(), /ancienne version/);
  assert.equal(
    JSON.parse(await a.repo.read("current")).tasks[0].title,
    "Avant migration",
  );
  a.repo.close();
});
test("missing database or unavailable IndexedDB never silently resurrects stale localStorage", async () => {
  const a = await setup();
  a.repo.close();
  await new Promise((resolve, reject) => {
    const r = a.factory.deleteDatabase(Q.Durable.DB);
    r.onsuccess = resolve;
    r.onerror = reject;
  });
  const missing = new Q.Durable.Repository(a.local, a.factory);
  await assert.rejects(missing.open(), /manquante/);
  missing.close();
  await assert.rejects(
    new Q.Durable.Repository(a.local).open(),
    /indisponible/,
  );
  assert.equal(a.local.getItem(Q.KEY), a.raw);
});
test("auxiliary drafts persist independently and can be removed", async () => {
  const a = await setup();
  await a.repo.auxiliary("draft", "saisie");
  const b = new Q.Durable.Repository(a.local, a.factory);
  await b.open();
  assert.equal(await b.read("draft", "drafts"), "saisie");
  await b.auxiliary("draft", null);
  assert.equal(await a.repo.read("draft", "drafts"), null);
  a.repo.close();
  b.close();
});
test("invalid legacy data and blocked migration marker preserve the original", async () => {
  const local = storage(),
    factory = new IDBFactory();
  local.setItem(Q.KEY, "{broken");
  const bad = new Q.Durable.Repository(local, factory);
  await assert.rejects(bad.open());
  bad.close();
  assert.equal(local.getItem(Q.KEY), "{broken");
  assert.equal(local.getItem(Q.Durable.MARKER), null);
  local.setItem(Q.KEY, JSON.stringify(Q.empty()));
  const original = local.setItem;
  local.setItem = (k, v) => {
    if (k === Q.Durable.MARKER) throw new Error("Quota");
    return original(k, v);
  };
  const quota = new Q.Durable.Repository(local, factory);
  await assert.rejects(quota.open(), /Quota/);
  assert.equal(await quota.read("current"), null);
  quota.close();
});
