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
let n = 0;
const id = () => "id" + ++n,
  rule = (trigger, actions = ["Notification"]) => ({
    id: "rule",
    title: "Règle",
    engineVersion: 1,
    trigger,
    actions,
    active: true,
    horizon: 7,
    threshold: 500,
    priority: 3,
  });
test("overdue rules execute multiple actions once and keep removed outputs removed", () => {
  n = 0;
  const s = Q.empty();
  s.tasks = [{ id: "late", title: "Dossier", due: "2026-09-01", done: false }];
  s.automations = [
    rule("Tâche en retard", ["Notification", "Créer une tâche"]),
  ];
  assert.equal(Q.Automation.run(s, "2026-09-11", id), 1);
  assert.equal(s.notifications.length, 1);
  assert.equal(s.tasks.length, 2);
  assert.equal(s.automationLogs.length, 1);
  s.tasks[0].deleted = true;
  assert.equal(Q.Automation.run(s, "2026-09-11", id), 0);
  assert.equal(s.tasks.length, 2);
  assert.doesNotThrow(() => Q.normalize(s));
});
test("document, expense, stagnant project, trip and Sunday triggers are deterministic", () => {
  n = 0;
  const s = Q.empty();
  s.documents = [{ id: "d", title: "Assurance", expiry: "2026-09-15" }];
  s.finances = [
    { id: "f", label: "Ordinateur", amount: -900, date: "2026-09-10" },
  ];
  s.os = [
    {
      id: "p",
      kind: "project",
      title: "Projet",
      status: "En cours",
      budget: 1,
      spent: 0,
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "trip",
      kind: "trip",
      title: "Rome",
      status: "En cours",
      date: "2026-10-01",
      end: "2026-10-02",
      budget: 100,
    },
  ];
  s.automations = [
    rule("Document à renouveler"),
    { ...rule("Dépense importante"), id: "expense" },
    { ...rule("Projet stagnant"), id: "project", horizon: 30 },
    { ...rule("Voyage créé", ["Créer une checklist"]), id: "trip-rule" },
    { ...rule("Revue du dimanche"), id: "weekly" },
  ];
  assert.equal(Q.Automation.run(s, "2026-09-13", id), 5);
  assert.equal(s.notifications.length, 4);
  const checklist = s.tasks.find((t) => t.automationRuleId === "trip-rule");
  assert.equal(checklist.personal.checklist.length, 5);
  assert.equal(Q.Automation.run(s, "2026-09-13", id), 0);
});
test("notification read and snooze are persistent, while malformed rules are rejected", () => {
  const s = Q.empty();
  s.notifications = [
    {
      id: "n",
      type: "Alerte",
      title: "Titre",
      message: "Message",
      priority: 2,
      createdAt: "2026-09-11T10:00:00Z",
      read: false,
    },
  ];
  Q.Automation.snooze(s, "n", 7, "2026-09-11");
  assert.equal(Q.Automation.visible(s, "2026-09-12").length, 0);
  assert.equal(Q.Automation.visible(s, "2026-09-18").length, 1);
  s.automations = [rule("Inconnu")];
  assert.throws(() => Q.normalize(s), /invalide/);
});
test("legacy automation ideas remain importable but are not executed", () => {
  const s = Q.empty();
  s.automations = [
    {
      id: "idea",
      title: "Un jour",
      category: "Email",
      details: "Idée historique",
    },
  ];
  assert.doesNotThrow(() => Q.normalize(s));
  assert.equal(Q.Automation.run(s, "2026-09-11", id), 0);
});
