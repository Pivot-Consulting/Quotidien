const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const context = vm.createContext({ Date, Set, Map });
vm.runInContext(fs.readFileSync(".build/core.js", "utf8"), context);
const Q = context.Q;
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
test("fresh states do not share arrays", () => {
  const a = Q.empty(),
    b = Q.empty();
  a.tasks.push({ id: "one" });
  assert.equal(b.tasks.length, 0);
});
test("local calendar day follows Europe/Paris, including near midnight", () => {
  const old = process.env.TZ;
  process.env.TZ = "Europe/Paris";
  assert.equal(Q.day(new Date("2026-09-07T22:30:00Z")), "2026-09-08");
  assert.equal(Q.day(new Date("2026-01-07T23:30:00Z")), "2026-01-08");
  process.env.TZ = old;
});
test("round-trip current 2.0 and envelope exports preserve unknown fields", () => {
  const s = Q.empty();
  s.tasks = [
    { id: "1", title: "Action", details: "Conserver", custom: { value: 12 } },
  ];
  const next = Q.parseBackup(Q.backup(s));
  assert.equal(JSON.stringify(next), JSON.stringify(s));
  assert.equal(Q.parseBackup(JSON.stringify(s)).tasks.length, 1);
});
test("incompatible or malformed imports fail before state mutation", () => {
  for (const input of [
    null,
    [],
    {},
    { schemaVersion: 6, tasks: [] },
    { version: 2, tasks: null },
    { version: 2, tasks: [null] },
    { version: 2, tasks: [{ id: "x" }, { id: "x" }] },
    { version: 2, tasks: [{ id: "1", title: {} }] },
    { version: 2, tasks: [], settings: null },
  ])
    assert.throws(() => Q.normalize(input));
  assert.throws(() => Q.parseBackup("{"));
  assert.throws(() =>
    Q.parseBackup('{"version":2,"tasks":[],"__proto__":{"polluted":true}}'),
  );
});
test("invalid dates, numbers and history are rejected", () => {
  for (const record of [
    { id: "1", due: "2026-02-30" },
    { id: "1", amount: "NaN" },
    { id: "1", progress: 101 },
    { id: "1", done: "false" },
  ]) {
    const s = Q.empty();
    s.tasks = [record];
    assert.throws(() => Q.normalize(s));
  }
  const s = Q.empty();
  s.habits = [{ id: "1", days: ["monday"] }];
  assert.throws(() => Q.normalize(s));
});
test("successful writes retain the previous state", () => {
  const st = storage(),
    repo = new Q.Repository(st),
    s = repo.load();
  repo.commit(s);
  s.tasks.push({ id: "t", title: "New" });
  repo.commit(s);
  assert.equal(JSON.parse(st.getItem(Q.BACKUP_KEY)).tasks.length, 0);
  assert.equal(repo.load().tasks.length, 1);
});
test("quota error does not overwrite primary state", () => {
  const st = storage(),
    repo = new Q.Repository(st),
    s = repo.load();
  repo.commit(s);
  const old = st.getItem(Q.KEY),
    set = st.setItem;
  st.setItem = (key, value) => {
    if (key === Q.KEY) throw new Error("quota");
    return set(key, value);
  };
  s.tasks.push({ id: "t" });
  assert.throws(() => repo.commit(s), /quota/);
  assert.equal(st.getItem(Q.KEY), old);
});
test("corrupt stored data is not silently replaced", () => {
  const st = storage();
  st.setItem(Q.KEY, "{broken");
  const repo = new Q.Repository(st);
  assert.throws(() => repo.load());
  assert.throws(() => repo.commit(Q.empty()));
  assert.equal(st.getItem(Q.KEY), "{broken");
});
test("stale tab cannot overwrite newer data", () => {
  const st = storage(),
    a = new Q.Repository(st),
    b = new Q.Repository(st),
    sa = a.load(),
    sb = b.load();
  sa.tasks.push({ id: "new" });
  a.commit(sa);
  assert.throws(() => b.commit(sb), /autre onglet/);
  assert.equal(a.load().tasks.length, 1);
});
test("restore keeps a dedicated checkpoint after later ordinary edits", () => {
  const st = storage(),
    repo = new Q.Repository(st),
    s = repo.load();
  s.tasks.push({ id: "original" });
  repo.commit(s);
  repo.commit(Q.empty(), true);
  const next = repo.load();
  next.notes.push({ id: "later" });
  repo.commit(next);
  assert.equal(
    JSON.parse(st.getItem(Q.CHECKPOINT_KEY)).tasks[0].id,
    "original",
  );
});
test("focus includes capitalized entries and excludes deleted ones", () => {
  const s = Q.empty();
  s.health = [
    { id: "a", kind: "Focus", value: 25 },
    { id: "b", kind: "focus", value: 10 },
    { id: "c", kind: "Focus", value: 99, deleted: true },
  ];
  assert.equal(Q.focusMinutes(s), 35);
});
test("global search is accent insensitive and includes financial entries", () => {
  const s = Q.empty();
  s.finances = [{ id: "a", label: "Électricité", amount: -30 }];
  s.notes = [{ id: "b", title: "Electricité", deleted: true }];
  assert.equal(Q.matches(s, "electricite").length, 1);
  assert.equal(Q.matches(s, "electricite")[0].key, "finances");
});
