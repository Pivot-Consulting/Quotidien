const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = vm.createContext({ Date, Set, Map, URL });
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const Q = context.Q,
  O = Q.OS;
const rec = (id, kind, fields = {}) => ({
  id,
  kind,
  title: id,
  status: "En cours",
  ...fields,
});
test("old 2.x backups gain an empty OS collection and retain original records", () => {
  const old = {
    version: 2,
    life: [{ id: "capture", domain: "Voyages", title: "Rome" }],
    finances: [{ id: "tx", amount: -12 }],
  };
  const s = Q.normalize(old);
  assert.equal(s.life[0].title, "Rome");
  assert.equal(s.finances[0].amount, -12);
  assert.equal(s.os.length, 0);
  assert.equal(old.os, undefined);
});
test("OS validation blocks bad URLs, ranges, types and malformed relational arrays", () => {
  for (const r of [
    rec("x", "unknown"),
    rec("x", "sleep", {
      date: "2026-01-01",
      hours: 25,
      quality: 5,
      awakenings: 0,
    }),
    rec("x", "service", { url: "javascript:alert(1)", mfa: "Activée" }),
    rec("x", "sharedExpense", {
      payerId: "a",
      participants: ["a", "a"],
      cost: 10,
      date: "2026-01-01",
    }),
    rec("x", "decision", { benefitWeight: 0, costWeight: 0, riskWeight: 0 }),
  ])
    assert.throws(() => Q.normalize({ version: 2, os: [r] }));
  assert.equal(O.safeURL("https://example.com/a"), "https://example.com/a");
  assert.equal(O.safeURL("javascript:alert(1)"), "");
});
test("weighted milestones exclude removed items and do not count unfinished work", () => {
  const s = Q.empty();
  s.os = [
    rec("p", "project"),
    rec("a", "milestone", { projectId: "p", weight: 1, status: "Terminé" }),
    rec("b", "milestone", { projectId: "p", weight: 3 }),
    rec("c", "milestone", {
      projectId: "p",
      weight: 100,
      status: "Terminé",
      deleted: true,
    }),
  ];
  assert.equal(O.projectProgress(s, "p"), 25);
});
test("decision ranking honors weights and missing decisions return no ranking", () => {
  const s = Q.empty();
  s.os = [
    rec("d", "decision", { benefitWeight: 2, costWeight: 1, riskWeight: 1 }),
    rec("a", "option", {
      decisionId: "d",
      benefit: 10,
      affordability: 2,
      safety: 6,
    }),
    rec("b", "option", {
      decisionId: "d",
      benefit: 5,
      affordability: 9,
      safety: 9,
    }),
  ];
  assert.equal(O.decisionScores(s, "d")[0].record.id, "a");
  assert.equal(O.decisionScores(s, "d")[0].score, 7);
  assert.equal(O.decisionScores(s, "none").length, 0);
});
test("decreasing indicators, overshoot and zero-range objectives are handled", () => {
  const s = Q.empty(),
    r = rec("i", "indicator", { baseline: 100, targetValue: 80 });
  s.os = [
    r,
    rec("m", "measurement", {
      indicatorId: "i",
      reading: 90,
      date: "2026-01-01",
    }),
  ];
  assert.equal(O.indicatorProgress(s, r).progress, 50);
  s.os.push(
    rec("m2", "measurement", {
      indicatorId: "i",
      reading: 70,
      date: "2026-01-02",
    }),
  );
  assert.equal(O.indicatorProgress(s, r).progress, 100);
  assert.equal(
    O.indicatorProgress(
      s,
      rec("j", "indicator", { baseline: 0, targetValue: 0 }),
    ).progress,
    100,
  );
});
test("shared-expense allocations and settlements conserve cents, even for removed members", () => {
  const s = Q.empty();
  s.os = [
    rec("a", "member"),
    rec("b", "member"),
    rec("c", "member", { deleted: true }),
    rec("x", "sharedExpense", {
      payerId: "a",
      participants: ["a", "b", "c"],
      cost: 10,
    }),
  ];
  const b = O.balances(s);
  assert.equal(
    b.reduce((v, r) => v + r.cents, 0),
    0,
  );
  assert.equal(b.find((r) => r.id === "a").cents, 666);
  assert.equal(
    O.settlements(s).reduce((v, r) => v + r.cents, 0),
    666,
  );
});
test("spaced review advances dates over month boundaries without marking a card complete", () => {
  const a = O.reviewCard(rec("c", "flashcard"), "good", "2026-01-30");
  assert.equal(a.due, "2026-02-02");
  assert.equal(a.status, "En cours");
  const b = O.reviewCard(a, "good", "2026-02-02");
  assert.equal(b.interval, 6);
  assert.equal(O.reviewCard(b, "again", "2026-02-03").interval, 1);
});
test("automation preview is pure, scoped, and idempotent for removed generated tasks", () => {
  const s = Q.empty();
  s.os = [
    rec("r", "rule", {
      source: "Échéances OS",
      enabled: "Active",
      horizon: 7,
      prefix: "Faire",
    }),
    rec("doc", "document", { due: "2026-09-10" }),
    rec("m", "meal", { date: "2026-09-10" }),
    rec("past", "document", { due: "2026-09-01", deleted: true }),
  ];
  const before = JSON.stringify(s),
    p = O.proposals(s, "2026-09-08");
  assert.equal(p.length, 1);
  assert.equal(JSON.stringify(s), before);
  s.tasks.push({ id: "t", automationToken: p[0].token, deleted: true });
  assert.equal(O.proposals(s, "2026-09-08").length, 0);
});
test("daily plan respects capacity, due dates and default duration", () => {
  const s = Q.empty();
  s.os = [
    rec("p", "planning", {
      date: "2026-09-08",
      capacity: 50,
      priority: "Échéances",
    }),
  ];
  s.tasks = [
    { id: "a", due: "2026-09-07", estimate: 30 },
    { id: "b", due: "2026-09-08", estimate: 20 },
    { id: "c", estimate: 25 },
    { id: "d", due: "2026-09-09", estimate: 5 },
    { id: "e", done: true, estimate: 1 },
  ];
  const p = O.dayPlan(s, "2026-09-08");
  assert.equal(p.used, 50);
  assert.equal(p.tasks.map((t) => t.id).join(","), "a,b");
  assert.equal(p.remaining, 1);
});
test("CSV parser handles French decimals, quoted delimiters, linebreaks and rejects corrupt rows", () => {
  const rs = O.parseCSV(
    'date;libelle;montant;categorie\r\n2026-09-08;"Achat; épicerie";"-12,50";Courses\r\n2026-09-09;"Deux\nlignes";10;Divers',
  );
  assert.equal(rs.length, 2);
  assert.equal(rs[0].amount, -12.5);
  assert.equal(rs[1].label, "Deux\nlignes");
  for (const raw of [
    "date;libelle;montant;categorie\n2026-02-30;x;1;x",
    "date;libelle;montant;categorie\n2026-01-01;x;;x",
    'date;libelle;montant;categorie\n"oops',
  ])
    assert.throws(() => O.parseCSV(raw));
  assert.match(O.csv(["Titre"], [["=HYPERLINK(1)"]]), /'=HYPERLINK/);
});
test("subscription annualization preserves period semantics", () => {
  assert.equal(
    O.annual(rec("a", "subscription", { cost: 10, period: "Mensuelle" })),
    120,
  );
  assert.equal(
    O.annual(rec("b", "subscription", { cost: 50, period: "Annuelle" })),
    50,
  );
  assert.equal(
    O.annual(rec("c", "subscription", { cost: 2, period: "Hebdomadaire" })),
    104,
  );
});

test("recorded reimbursements clear balances without changing original expenses", () => {
  const s = Q.empty();
  s.os = [
    rec("a", "member"),
    rec("b", "member"),
    rec("x", "sharedExpense", {
      payerId: "a",
      participants: ["a", "b"],
      cost: 30,
    }),
    rec("paid", "settlement", { fromId: "b", toId: "a", cost: 15 }),
  ];
  assert.equal(O.settlements(s).length, 0);
  assert.equal(s.os[2].cost, 30);
});
test("recurring deadlines and monthly subscriptions advance without invalid calendar days", () => {
  const sub = O.completeRecord(
    rec("s", "subscription", { due: "2026-01-31", period: "Mensuelle" }),
    "2026-01-31",
  );
  assert.equal(sub.due, "2026-02-28");
  assert.equal(sub.status, "En cours");
  const chore = O.completeRecord(
    rec("c", "chore", { due: "2026-09-01", repeatDays: 7 }),
    "2026-09-08",
  );
  assert.equal(chore.due, "2026-09-15");
  assert.equal(chore.completedCount, 1);
});

test("imports reject dangling typed links and preserve references to removed records", () => {
  const expense = rec("x", "sharedExpense", {
    payerId: "a",
    participants: ["a"],
    cost: 12,
    date: "2026-09-08",
  });
  assert.throws(() => Q.normalize({ version: 2, os: [expense] }), /référence/);
  const s = Q.normalize({
    version: 2,
    os: [rec("a", "member", { deleted: true }), expense],
  });
  assert.equal(s.os[1].payerId, "a");
});
