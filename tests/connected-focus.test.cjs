const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
const context = vm.createContext({ Date, Set, Map });
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const Q = context.Q;
test("connected savings drive calendar completion and financial findings consistently", () => {
  const s = Q.empty();
  s.os = [
    {
      id: "a",
      kind: "account",
      title: "Compte",
      status: "En cours",
      opening: 100,
    },
    {
      id: "p",
      kind: "project",
      title: "Projet",
      status: "En cours",
      budget: 10,
      spent: 20,
    },
  ];
  const goal = {
    id: "g",
    title: "Épargne",
    date: "2026-09-11",
    savingsAccountId: "a",
    savingsTarget: 100,
    monthlyContribution: 10,
    progress: 0,
  };
  s.goals = [goal];
  assert.equal(Q.Personal.completed(goal, s), true);
  assert.equal(Q.Planning.entries(s).filter((x) => x.hit.id === "g").length, 0);
  s.os[0].opening = 0;
  goal.progress = 100;
  assert.equal(Q.Personal.completed(goal, s), false);
  assert.equal(Q.Planning.entries(s).filter((x) => x.hit.id === "g").length, 1);
  const findings = Q.Intelligence.analyze(s, "2026-09-10");
  assert.ok(findings.some((f) => f.title.includes("Épargne à ajuster")));
  assert.ok(findings.some((f) => f.title.includes("Budget du projet")));
});
test("project source is explicit and archived transactions still count; removed ones do not", () => {
  const s = Q.empty(),
    p = { id: "p", kind: "project", title: "Maison", spent: 500, budget: 1000 };
  s.os.push(p);
  s.finances = [
    { id: "1", projectId: "p", amount: -100, personal: { archived: true } },
    { id: "2", projectId: "p", amount: 20 },
    { id: "3", projectId: "p", amount: -1000, deleted: true },
  ];
  assert.equal(Q.Connected.projectSpent(s, p), 500);
  p.spendMode = "Transactions";
  assert.equal(Q.Connected.projectSpent(s, p), 80);
  assert.equal(p.spent, 500);
  assert.equal(
    Q.Personal.graph(s).filter((x) => x.label === "Projet financé").length,
    2,
  );
});
test("savings use account balance without altering manual progress, capped at 100", () => {
  const s = Q.empty();
  s.os = [{ id: "a", kind: "account", opening: 200 }];
  s.finances = [
    { id: "t", accountId: "a", amount: 100, personal: { archived: true } },
  ];
  const g = {
    id: "g",
    savingsAccountId: "a",
    savingsTarget: 1000,
    monthlyContribution: 100,
    progress: 10,
  };
  s.goals = [g];
  const value = Q.Connected.savings(s, g);
  assert.equal(value.progress, 30);
  assert.equal(value.months, 7);
  assert.equal(g.progress, 10);
  s.finances.push({ id: "2", accountId: "a", amount: 1000 });
  assert.equal(Q.Connected.progress(s, g), 100);
  delete g.savingsAccountId;
  assert.equal(Q.Connected.progress(s, g), 10);
});
test("savings cannot allocate the same account twice, including through duplication", () => {
  const s = Q.empty();
  s.os = [
    {
      id: "a",
      kind: "account",
      title: "Compte",
      status: "En cours",
      opening: 0,
    },
  ];
  s.goals = [{ id: "g", savingsAccountId: "a", savingsTarget: 100 }];
  const copy = Q.Personal.duplicate(s, { key: "goals", id: "g" }, "copy");
  assert.equal(copy.savingsAccountId, undefined);
  s.goals.push({ ...s.goals[0], id: "g2" });
  assert.throws(() => Q.normalize(s), /déjà/);
  s.goals[1].personal = { archived: true };
  assert.doesNotThrow(() => Q.normalize(s));
  s.goals[0].savingsTarget = -1;
  assert.throws(() => Q.normalize(s), /invalide/);
});
test("missing references cannot enter connected accounting", () => {
  const s = Q.empty();
  s.finances = [{ id: "t", amount: -1, projectId: "missing" }];
  assert.throws(() => Q.normalize(s), /Projet/);
});
test("Focus pause, reload and finish count once, bounded by planned duration", () => {
  let s = Q.empty();
  s.tasks = [{ id: "t", title: "Dossier" }];
  Q.Focus.start(s, "t", "f", 25, 100000);
  Q.Focus.toggle(s, 160000);
  assert.equal(Q.Focus.elapsed(Q.Focus.session(s), 260000), 60);
  s = Q.parseBackup(Q.backup(s));
  Q.Focus.toggle(s, 260000);
  Q.Focus.finish(s, "health", 9999999);
  Q.Focus.finish(s, "again", 9999999);
  assert.equal(s.health.length, 1);
  assert.equal(s.health[0].value, 25);
  assert.equal(s.tasks[0].done, undefined);
});
test("Focus rejects overlapping sessions, invalid imports and clock rollback adds no time", () => {
  const s = Q.empty();
  s.tasks = [{ id: "t" }];
  Q.Focus.start(s, "t", "f", 1, 1000);
  assert.equal(Q.Focus.elapsed(Q.Focus.session(s), 0), 0);
  assert.throws(() => Q.Focus.start(s, "t", "other"), /d’abord/);
  s.focusSession.elapsedSeconds = -1;
  assert.throws(() => Q.normalize(s), /Focus/);
});
test("context changes ranking with reasons, preserving urgent and blocked tasks", () => {
  const s = Q.empty();
  s.tasks = [
    {
      id: "a",
      title: "A",
      personal: { context: "Travail", duration: 60, energy: "high" },
    },
    {
      id: "b",
      title: "B",
      personal: { context: "Maison", duration: 10, energy: "low" },
    },
  ];
  s.settings.actionContext = "Maison";
  s.settings.availableMinutes = 15;
  s.settings.availableEnergy = "low";
  const result = Q.Personal.nextActions(s);
  assert.equal(result[0].hit.id, "b");
  assert.equal(result.length, 2);
  assert.ok(result[0].reasons.some((x) => x.includes("contexte")));
});
test("reviews use real dated completions and financial entries, not a made-up activity count", () => {
  const s = Q.empty();
  s.tasks = [
    { id: "t", title: "Fait", done: true, completedAt: "2026-09-10T12:00:00Z" },
    { id: "old", title: "Sans date", done: true },
    { id: "next", title: "Demain", due: "2026-09-11" },
  ];
  s.finances = [{ id: "x", date: "2026-09-10", amount: -12 }];
  const review = Q.Focus.review(s, false, "2026-09-10");
  assert.match(review, /1 tâche/);
  assert.match(review, /12.00/);
  assert.match(review, /Demain/);
  assert.doesNotMatch(review, /Sans date/);
});
