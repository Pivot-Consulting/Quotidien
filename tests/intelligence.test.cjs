const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const context = vm.createContext({ Date, Set, Map, Intl, URL });
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const { Q } = context,
  I = Q.Intelligence,
  P = Q.Personal,
  C = Q.Planning;
const today = "2026-09-09";
const os = (id, kind, data = {}) => ({
  id,
  kind,
  title: id,
  status: "En cours",
  ...data,
});
const type = (findings, kind) =>
  findings.filter((f) => JSON.parse(f.id)[0].startsWith(kind));
test("calendar distinguishes scheduled records from measurements, spans trips and exposes secondary deadlines", () => {
  const s = Q.empty();
  s.finances = [{ id: "f", label: "Achat", amount: -10, date: today }];
  s.health = [{ id: "h", kind: "Sommeil", value: 8, date: today }];
  s.events = [{ id: "e", title: "RDV", date: today, time: "10:00" }];
  s.tasks = [
    { id: "t", title: "Retirée", due: today, deleted: true },
    { id: "a", title: "Archive", due: today, personal: { archived: true } },
    { id: "done", title: "Finie", due: today, done: true },
  ];
  s.os = [
    os("trip", "trip", { date: "2026-08-30", end: "2026-09-12" }),
    os("sub", "subscription", { due: "2026-10-01", cancelBy: today }),
    os("eq", "equipment", { warranty: today }),
  ];
  const before = JSON.stringify(s),
    entries = C.entries(s);
  assert.equal(C.onDay(entries, today).length, 4);
  assert.equal(C.onDay(C.entries(s, true), today).length, 5);
  assert.equal(C.onDay(entries, "2026-09-13").length, 0);
  assert.equal(JSON.stringify(s), before);
  assert.equal(C.monthDays("2024-02").includes("2024-02-29"), true);
  assert.equal(C.monthDays("2026-09")[0], "2026-08-31");
  assert.equal(C.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(C.shiftMonth("2026-01", -1), "2025-12");
  assert.throws(() => C.monthDays("2026-13"), /Mois/);
});
test("analysis is pure, excludes archived work and accounts for archived expenses and exact budget category", () => {
  const s = Q.empty();
  s.os = [
    os("b", "budget", { category: "Restaurant", month: "2026-09", limit: 100 }),
    os("d", "document", { due: "2026-09-08", personal: { archived: true } }),
  ];
  s.finances = [
    {
      id: "f",
      label: "Repas",
      category: "restaurant",
      amount: -120,
      date: today,
      personal: { archived: true },
    },
    {
      id: "g",
      label: "Repas",
      category: "Restaurant",
      amount: -100,
      date: today,
      deleted: true,
    },
  ];
  const before = JSON.stringify(s),
    findings = I.analyze(s, today);
  assert.equal(findings.length, 1);
  assert.match(findings[0].explanation, /120/);
  assert.equal(JSON.stringify(s), before);
  s.os[0].personal = { archived: true };
  assert.equal(I.analyze(s, today).length, 0);
  assert.equal(I.analyze(Q.empty(), today).length, 0);
});
test("contacts respect recorded interactions, cadence, and missing-data boundaries", () => {
  const s = Q.empty();
  s.os = [
    os("c", "contact", { date: "2026-06-01", cadence: 30 }),
    os("x", "interaction", { contactId: "c", date: "2026-09-01" }),
  ];
  assert.equal(type(I.analyze(s, today), "contact").length, 0);
  s.os[1].deleted = true;
  assert.equal(type(I.analyze(s, today), "contact").length, 1);
  delete s.os[0].date;
  assert.equal(type(I.analyze(s, today), "contact").length, 0);
});
test("metadata does not fake project momentum, but a linked completed task does", () => {
  const s = Q.empty();
  s.os = [
    os("p", "project", {
      budget: 0,
      spent: 0,
      createdAt: "2026-07-01T12:00:00Z",
    }),
  ];
  const changed = Q.clone(s);
  changed.os[0].personal = { tags: ["urgent"] };
  P.stamp(s, changed, "2026-09-08T12:00:00Z");
  assert.equal(type(I.analyze(changed, today), "stagnation").length, 1);
  changed.tasks = [
    {
      id: "t",
      title: "Jalon",
      done: true,
      completedAt: "2026-09-08T12:00:00Z",
      osSourceId: "p",
    },
  ];
  assert.equal(type(I.analyze(changed, today), "stagnation").length, 0);
});
test("capacity and real event durations expose overload and overlap without invented times", () => {
  const s = Q.empty();
  s.os = [os("p", "planning", { date: today, capacity: 30 })];
  s.tasks = [{ id: "t", title: "Travail", due: today, estimate: 45 }];
  s.events = [
    {
      id: "a",
      title: "A",
      date: today,
      time: "10:00",
      personal: { duration: 60 },
    },
    {
      id: "b",
      title: "B",
      date: today,
      time: "10:30",
      personal: { duration: 45 },
    },
  ];
  assert.equal(type(I.analyze(s, today), "load").length, 1);
  assert.equal(type(I.analyze(s, today), "conflict").length, 1);
  s.events[0].personal = {};
  assert.equal(type(I.analyze(s, today), "conflict").length, 0);
  s.events[1].time = "10:00";
  assert.equal(type(I.analyze(s, today), "conflict").length, 1);
  s.events[1].time = "11:00";
  s.events[0].personal = { duration: 60 };
  assert.equal(type(I.analyze(s, today), "conflict").length, 0);
});
test("accepting a finding is idempotent across reload, reactivation, deletion and backup", () => {
  let s = Q.empty();
  s.os = [os("d", "document", { due: "2026-09-08" })];
  const f = I.analyze(s, today)[0];
  I.decide(s, f, "accepted", "task", today);
  assert.equal(s.tasks.length, 1);
  assert.equal(s.connections.length, 1);
  s = Q.parseBackup(Q.backup(Q.normalize(s)));
  I.decide(s, f, "accepted", "other", today);
  assert.equal(s.tasks.length, 1);
  s.insightDecisions = [];
  s.tasks[0].deleted = true;
  I.decide(s, f, "accepted", "third", today);
  assert.equal(s.tasks.length, 1);
  assert.equal(s.tasks[0].deleted, true);
  assert.equal(I.decisions(s)[0].taskId, "task");
});
test("existing tasks are followed without duplication, snooze expires and rescheduled deadlines return", () => {
  const s = Q.empty();
  s.tasks = [{ id: "t", title: "Action", due: today }];
  const f = I.analyze(s, today)[0];
  I.decide(s, f, "accepted", "new", today);
  assert.equal(s.tasks.length, 1);
  assert.equal(I.decisions(s)[0].taskId, "t");
  I.decide(s, f, "snoozed", "new", today);
  assert.equal(I.disposition(s, f, "2026-09-15"), "snoozed");
  assert.equal(I.disposition(s, f, "2026-09-16"), "active");
  I.decide(s, f, "ignored", "new", today);
  assert.equal(I.disposition(s, f, today), "ignored");
  s.tasks[0].due = "2026-09-10";
  assert.equal(I.disposition(s, I.analyze(s, today)[0], today), "active");
});
test("malformed recommendation decisions cannot enter persistence", () => {
  for (const entry of [
    null,
    { id: "x", title: "Bad", status: "bogus", at: today },
    {
      id: "x",
      title: "Bad",
      status: "snoozed",
      at: today,
      until: "2026-02-30",
    },
    { id: "x", title: "Bad", status: "accepted", at: today, taskId: "missing" },
  ])
    assert.throws(
      () => Q.normalize({ ...Q.empty(), insightDecisions: [entry] }),
      /recommandation/,
    );
});
test("specialized duplication resets execution consistently while preserving typed references and originals", () => {
  const s = Q.empty();
  s.os = [
    os("r", "flashcard", {
      status: "Terminé",
      courseId: "c",
      reviewStreak: 3,
      interval: 10,
      lastReviewed: today,
      personal: { archived: true, favorite: true },
    }),
  ];
  const copy = P.duplicate(s, { key: "os", id: "r" }, "copy");
  assert.equal(copy.status, "Idée");
  assert.equal(copy.courseId, "c");
  assert.equal(copy.reviewStreak, undefined);
  assert.equal(copy.personal.archived, false);
  assert.equal(s.os[0].reviewStreak, 3);
});
