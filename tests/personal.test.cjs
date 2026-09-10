const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const context = vm.createContext({ Date, Set, Map });
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const { Q } = context,
  P = Q.Personal;
const ref = (key, id) => ({ key, id });
function seed() {
  const s = Q.empty();
  s.tasks = [
    {
      id: "same",
      title: "Dossier bancaire",
      due: "2026-09-08",
      important: true,
    },
  ];
  s.notes = [{ id: "same", title: "Note banque", body: "Budget électricité" }];
  s.os = [
    {
      id: "p",
      kind: "project",
      title: "Appartement",
      budget: 0,
      spent: 0,
      status: "En cours",
    },
  ];
  return s;
}
function store() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
}
test("additive schema preserves 2.2 records without writes or invented history", () => {
  const s = seed(),
    storage = store();
  storage.setItem(Q.KEY, JSON.stringify(s));
  const raw = storage.getItem(Q.KEY);
  const result = new Q.Repository(storage).load();
  assert.equal(storage.getItem(Q.KEY), raw);
  assert.equal(result.activity, undefined);
  assert.equal(JSON.stringify(result.tasks), JSON.stringify(s.tasks));
});
test("shared links distinguish identical IDs in separate collections and survive removal", () => {
  const s = seed();
  s.connections = [
    {
      id: "c",
      from: ref("tasks", "same"),
      to: ref("notes", "same"),
      type: "related",
    },
  ];
  Q.normalize(s);
  assert.equal(P.related(s, ref("tasks", "same")).length, 1);
  s.notes[0].deleted = true;
  assert.equal(
    P.related(Q.parseBackup(Q.backup(s)), ref("tasks", "same")).length,
    1,
  );
});
test("links reject missing targets, duplicates, self links, cycles and malformed flags", () => {
  const base = seed(),
    link = {
      id: "a",
      from: ref("tasks", "same"),
      to: ref("notes", "same"),
      type: "depends",
    };
  for (const links of [
    [{ ...link, to: ref("notes", "missing") }],
    [{ ...link, to: link.from }],
    [link, { ...link, id: "b" }],
    [link, { ...link, id: "b", from: link.to, to: link.from }],
    [{ ...link, deleted: "true" }],
    [{ ...link, type: "constructor" }],
  ])
    assert.throws(() => Q.normalize({ ...base, connections: links }));
  const symmetric = [
    { ...link, type: "related" },
    { ...link, id: "b", from: link.to, to: link.from, type: "related" },
  ];
  assert.throws(
    () => Q.normalize({ ...base, connections: symmetric }),
    /existe/,
  );
});
test("native OS/project and transaction/account links remain visible without rewriting", () => {
  const s = seed();
  s.tasks[0].osSourceId = "p";
  s.os.push({
    id: "account",
    kind: "account",
    title: "Courant",
    status: "En cours",
  });
  s.finances = [
    { id: "f", label: "Loyer", amount: -500, accountId: "account" },
  ];
  const before = JSON.stringify(s);
  assert.equal(P.graph(s).length, 2);
  assert.equal(P.graph(s)[0].inferred, true);
  assert.equal(JSON.stringify(s), before);
});
test("shared search uses words, accents and tags, excludes metadata and archived by default", () => {
  const s = seed();
  s.tasks[0].personal = {
    tags: ["Immobilier"],
    favorite: true,
    description: "Prêt électricité",
  };
  assert.equal(P.search(s, { query: "electricite pret" }).length, 1);
  assert.equal(P.search(s, { query: "same" }).length, 0);
  assert.equal(
    P.search(s, { tag: "immobilier", favorite: true, key: "tasks" }).length,
    1,
  );
  s.tasks[0].personal.archived = true;
  assert.equal(P.search(s, { key: "tasks" }).length, 0);
  assert.equal(P.search(s, { archive: "archived" }).length, 1);
  assert.equal(P.search(s, { status: "overdue" }, "2026-09-09").length, 0);
  s.tasks[0].personal.archived = false;
  assert.equal(P.search(s, { status: "overdue" }, "2026-09-09").length, 1);
});
test("priority scoring explains urgency and dependency blocking across collections", () => {
  const s = seed();
  s.tasks.push({
    id: "later",
    title: "Lire",
    personal: { priority: 5, duration: 10 },
  });
  s.connections = [
    {
      id: "c",
      from: ref("tasks", "same"),
      to: ref("os", "p"),
      type: "depends",
    },
  ];
  const actions = P.nextActions(s, "2026-09-09");
  assert.equal(actions[0].hit.id, "later");
  assert.equal(actions[1].blocked.length, 1);
  assert.match(actions[1].reasons.join(" "), /retard/);
  s.os[0].deleted = true;
  assert.equal(P.blockers(s, ref("tasks", "same")).length, 1);
  s.os[0].status = "Terminé";
  assert.equal(P.blockers(s, ref("tasks", "same")).length, 0);
});
test("record history stamps edits and undo snapshots but not reads or preferences", () => {
  const st = store(),
    repo = new Q.Repository(st),
    s = repo.load();
  s.tasks.push({ id: "t", title: "Avant" });
  let next = repo.commit(s);
  assert.equal(next.activity.length, 1);
  assert.equal(next.activity[0].before, undefined);
  next.tasks[0].title = "Après";
  next = repo.commit(next);
  assert.equal(next.activity[0].before.title, "Avant");
  assert.equal(next.activity[0].after.title, "Après");
  next.settings.theme = "light";
  next = repo.commit(next);
  assert.equal(next.activity.length, 2);
  next.tasks[0] = Q.clone(next.activity[0].before);
  next = repo.commit(next);
  assert.equal(next.tasks[0].title, "Avant");
  assert.equal(next.activity[0].before.title, "Après");
  assert.equal(Q.parseBackup(Q.backup(next)).activity.length, 3);
});
test("audit bounded retention and quota errors keep committed records intact", () => {
  const st = store(),
    repo = new Q.Repository(st);
  let next = repo.load();
  next.tasks = [{ id: "t", title: "Original" }];
  next = repo.commit(next);
  for (let i = 0; i < 15; i++) {
    next.tasks[0].title = String(i);
    next = repo.commit(next);
  }
  assert.equal(next.activity.length, 10);
  const before = st.getItem(Q.KEY),
    original = st.setItem;
  st.setItem = (k, v) => {
    if (k === Q.KEY) throw new Error("quota");
    original(k, v);
  };
  next.tasks[0].title = "Impossible";
  assert.throws(() => repo.commit(next), /quota/);
  assert.equal(st.getItem(Q.KEY), before);
});
test("shared metadata and history reject malformed imports", () => {
  for (const personal of [
    [],
    { tags: [12] },
    { priority: 6 },
    { duration: -1 },
    { energy: "invalid" },
    { checklist: [{ text: "OK", done: "false" }] },
    { favorite: 1 },
  ]) {
    const s = seed();
    s.tasks[0].personal = personal;
    assert.throws(() => Q.normalize(s));
  }
  assert.throws(() =>
    Q.normalize({
      ...seed(),
      activity: [
        {
          id: "h",
          ref: ref("notes", "same"),
          at: "invalid",
          after: { id: "same" },
        },
      ],
    }),
  );
});
test("duplication clears execution history and preserves original and typed relations", () => {
  const s = seed();
  s.tasks[0] = {
    ...s.tasks[0],
    done: true,
    completedAt: "2026-09-09",
    osSourceId: "p",
    personal: {
      favorite: true,
      archived: true,
      checklist: [{ text: "Joindre", done: true }],
    },
  };
  const copy = P.duplicate(s, ref("tasks", "same"), "copy");
  assert.equal(copy.done, false);
  assert.equal(copy.completedAt, undefined);
  assert.equal(copy.osSourceId, "p");
  assert.equal(copy.personal.checklist[0].done, false);
  assert.equal(s.tasks[0].done, true);
});

test("archived rules and sources do not generate actions, and archived funds remain in accounting", () => {
  const s = Q.empty();
  s.os = [
    {
      id: "r",
      kind: "rule",
      title: "Règle",
      status: "En cours",
      enabled: "Active",
      source: "Échéances OS",
      horizon: 7,
      prefix: "Faire",
    },
    {
      id: "d",
      kind: "document",
      title: "Contrat",
      status: "En cours",
      due: "2026-09-10",
    },
  ];
  assert.equal(Q.OS.proposals(s, "2026-09-09").length, 1);
  s.os[1].personal = { archived: true };
  assert.equal(Q.OS.proposals(s, "2026-09-09").length, 0);
  s.os[1].personal = {};
  s.os[0].personal = { archived: true };
  assert.equal(Q.OS.proposals(s, "2026-09-09").length, 0);
  s.os.push({
    id: "asset",
    kind: "asset",
    title: "Patrimoine",
    amount: 100,
    personal: { archived: true },
  });
  assert.equal(Q.OS.rows(s, "asset").length, 1);
});
