const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const context = vm.createContext({ Date, Set, Map, URL });
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const Q = context.Q,
  E = Q.Evolution,
  C = Q.Commands;
const record = (id, kind, props = {}) => ({
  id,
  kind,
  title: id,
  status: "En cours",
  ...props,
});
let sequence = 0;
const id = () => "id" + ++sequence;
const account = () =>
  record("a", "account", { opening: 1000, accountType: "Courant" });
test("installments preserve cents and calendar month-end", () => {
  const s = Q.empty();
  s.os = [account()];
  E.installments(s, "a", "Assurance", -100, 3, "2026-01-31", id);
  const commitments = s.os.filter((r) => r.kind === "commitment");
  assert.equal(
    commitments.reduce((n, r) => n + Math.round(r.amount * 100), 0),
    -10000,
  );
  assert.deepEqual(
    Array.from(commitments, (r) => r.due),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.doesNotThrow(() => Q.normalize(s));
});
test("subtasks reject missing parents and cycles; shared fields validate their types and contact", () => {
  const s = Q.empty();
  s.tasks = [
    { id: "p", title: "Parent" },
    {
      id: "c",
      title: "Child",
      parentTaskId: "p",
      customFields: [{ name: "Budget", type: "number", value: 20 }],
    },
  ];
  assert.equal(E.children(s, "p").length, 1);
  assert.doesNotThrow(() => Q.normalize(s));
  s.tasks[0].parentTaskId = "c";
  assert.throws(() => Q.normalize(s), /cyclique/);
  delete s.tasks[0].parentTaskId;
  s.tasks[1].customFields[0].value = "20";
  assert.throws(() => Q.normalize(s), /type/);
  s.tasks[1].customFields = [];
  s.tasks[1].assigneeId = "absent";
  assert.throws(() => Q.normalize(s), /responsable/);
});
test("conversion is explicit, reversible, keeps identity and cannot duplicate a source", () => {
  const s = Q.empty();
  s.assets = [{ id: "a", title: "Vélo", value: 350 }];
  E.convert(s, "assets", "a");
  assert.equal(s.os[0].id, "a");
  assert.equal(s.assets[0].personal.archived, true);
  assert.throws(() => E.convert(s, "assets", "a"), /déjà/);
  assert.doesNotThrow(() => Q.normalize(s));
  E.reverse(s, "assets", "a");
  assert.equal(s.assets[0].personal.archived, false);
  assert.equal(s.os[0].personal.archived, true);
  E.convert(s, "assets", "a");
  assert.equal(s.os.length, 1);
  assert.equal(s.os[0].personal.archived, false);
});
test("cashflow removes settled forecasts exactly once and preserves the total; scenarios do not mutate", () => {
  const s = Q.empty();
  s.os = [
    account(),
    record("c", "commitment", {
      accountId: "a",
      amount: -200,
      due: "2026-10-01",
    }),
  ];
  assert.equal(E.forecast(s, "a", "2026-10-01").projected, 800);
  E.settle(s, "c", id, "2026-09-16");
  assert.equal(E.forecast(s, "a", "2026-10-01").projected, 800);
  assert.equal(E.forecast(s, "a", "2026-10-01").expected, 0);
  assert.throws(() => E.settle(s, "c", id), /déjà/);
  assert.doesNotThrow(() => Q.normalize(s));
  const before = JSON.stringify(s);
  E.forecast(s, "a", "2027-01-01");
  assert.equal(JSON.stringify(s), before);
  s.finances.push({ ...s.finances[0], id: "duplicate" });
  assert.throws(() => Q.normalize(s), /double/);
});
test("weighted decision scores require every criterion and reject cross-decision ratings", () => {
  const s = Q.empty();
  s.os = [
    record("d", "decision", { benefitWeight: 1, costWeight: 1, riskWeight: 1 }),
    record("o", "option", {
      decisionId: "d",
      benefit: 5,
      affordability: 5,
      safety: 5,
    }),
    record("c1", "criterion", { decisionId: "d", weight: 1 }),
    record("c2", "criterion", { decisionId: "d", weight: 3 }),
    record("r1", "optionScore", { optionId: "o", criterionId: "c1", score: 4 }),
  ];
  assert.equal(E.decisionScores(s, "d")[0].score, null);
  s.os.push(
    record("r2", "optionScore", { optionId: "o", criterionId: "c2", score: 8 }),
  );
  assert.equal(E.decisionScores(s, "d")[0].score, 7);
  assert.doesNotThrow(() => Q.normalize(s));
  s.os.find((r) => r.id === "c2").decisionId = "other";
  assert.throws(() => E.validate(s), /différentes/);
});
test("menus aggregate identical ingredients, keep units separate and receive/consume once", () => {
  const s = Q.empty();
  s.os = [
    record("r", "recipe", { servings: 1, minutes: 10, calories: 100 }),
    record("i", "ingredient", {
      recipeId: "r",
      item: "Riz",
      unit: "g",
      quantity: 80,
    }),
    record("i2", "ingredient", {
      recipeId: "r",
      item: "riz",
      unit: "g",
      quantity: 20,
    }),
    record("m", "menu", { recipeId: "r", portions: 2, date: "2026-09-16" }),
    record("s", "stock", { item: "riz", unit: "g", quantity: 50 }),
    record("s2", "stock", { item: "riz", unit: "ml", quantity: 300 }),
  ];
  assert.equal(E.shoppingNeeds(s, "2026-09-16", "2026-09-16")[0].quantity, 150);
  const before = JSON.stringify(s);
  assert.throws(() => E.consume(s, "m"), /insuffisant/);
  assert.equal(JSON.stringify(s), before);
  assert.equal(E.makeShopping(s, "2026-09-16", "2026-09-16", id), 1);
  assert.equal(E.makeShopping(s, "2026-09-16", "2026-09-16", id), 0);
  const shopping = s.os.find((r) => r.kind === "shopping");
  E.receive(s, shopping.id, id);
  assert.throws(() => E.receive(s, shopping.id, id), /déjà/);
  E.consume(s, "m");
  assert.equal(s.os.find((r) => r.id === "s").quantity, 0);
  assert.equal(s.os.find((r) => r.id === "s2").quantity, 300);
  assert.throws(() => E.consume(s, "m"), /déjà/);
  assert.doesNotThrow(() => Q.normalize(s));
});
test("monthly recurrence clamps month-end and intervals use their anchor; missing scores stay unknown", () => {
  assert.equal(
    Q.Routines.due(
      { id: "r", schedule: "Mensuel", monthDay: 31 },
      "2026-02-28",
    ),
    true,
  );
  assert.equal(
    Q.Routines.due(
      { id: "r", schedule: "Intervalle", anchor: "2026-09-01", everyDays: 3 },
      "2026-09-07",
    ),
    true,
  );
  const s = Q.empty();
  E.monthlyReview(s, id);
  E.monthlyReview(s, id);
  assert.equal(s.routines.length, 1);
  assert.doesNotThrow(() => Q.normalize(s));
  assert.ok(E.lifeScores(s).every((x) => x.score === null));
  s.os = [
    record("l", "lifeRating", { area: "Santé", score: 0, date: Q.day() }),
  ];
  assert.equal(E.lifeScores(s).find((x) => x.area === "Santé").score, 0);
});
test("commands preview without changes, reject ambiguity, validate dates and undo after repository audit", () => {
  const s = Q.empty(),
    before = JSON.stringify(s),
    i = C.parse(s, "tâche Appeler Paul le 2026-10-01");
  assert.equal(JSON.stringify(s), before);
  const h = C.apply(s, i, id);
  Q.Personal.stamp(Q.empty(), s);
  assert.equal(s.tasks[0].due, "2026-10-01");
  C.undo(s, h.id);
  assert.equal(s.tasks[0].deleted, true);
  assert.throws(() => C.parse(s, "tâche Test le 2026-02-30"), /date/);
  s.tasks = [
    { id: "a", title: "Même" },
    { id: "b", title: "Même" },
  ];
  s.commandHistory = [];
  assert.throws(() => C.parse(s, "planifier Même le 2026-10-01"), /Plusieurs/);
  s.tasks.pop();
  const plan = C.parse(s, "planifier Même le 2026-10-01");
  s.tasks[0].title = "Modifié";
  assert.throws(() => C.apply(s, plan, id), /changé/);
});
test("undo cannot overwrite later edits; agent permissions are checked again at acceptance", () => {
  const s = Q.empty();
  const h = C.apply(s, C.parse(s, "note Idée"), id);
  s.notes[0].body = "Autre";
  assert.throws(() => C.undo(s, h.id), /modifié/);
  s.os = [
    account(),
    record("c", "commitment", { accountId: "a", amount: -20, due: Q.day() }),
  ];
  assert.equal(C.proposals(s, "finance").length, 0);
  s.settings.agents = ["finance"];
  const proposals = C.proposals(s, "finance");
  assert.ok(proposals.length > 0);
  s.settings.agents = [];
  assert.throws(
    () => C.accept(s, "finance", proposals[0].id, id),
    /permission/,
  );
  s.settings.agents = ["finance"];
  C.accept(s, "finance", proposals[0].id, id);
  assert.equal(
    C.proposals(s, "finance").some((f) => f.id === proposals[0].id),
    false,
  );
  assert.doesNotThrow(() => Q.normalize(s));
});
test("parent completion and mixed dependency cycles are blocked", () => {
  const s = Q.empty();
  s.tasks = [
    { id: "p", title: "Parent" },
    { id: "c", title: "Child", parentTaskId: "p" },
  ];
  assert.throws(
    () => Q.Personal.changeStatus(s, { key: "tasks", id: "p" }, "Terminé"),
    /dépendances/,
  );
  s.connections = [
    {
      id: "edge",
      from: { key: "tasks", id: "c" },
      to: { key: "tasks", id: "p" },
      type: "depends",
    },
  ];
  assert.throws(() => Q.normalize(s), /Cycle/);
  s.connections = [];
  s.tasks[1].done = true;
  assert.doesNotThrow(() =>
    Q.Personal.changeStatus(s, { key: "tasks", id: "p" }, "Terminé"),
  );
});
test("agent source identity outlives the bounded command journal", () => {
  const s = Q.empty();
  s.os = [
    account(),
    record("c", "commitment", { accountId: "a", amount: -20, due: Q.day() }),
  ];
  s.settings.agents = ["finance"];
  const proposal = C.proposals(s, "finance")[0];
  C.accept(s, "finance", proposal.id, id);
  s.commandHistory = [];
  assert.equal(
    C.proposals(s, "finance").some((f) => f.id === proposal.id),
    false,
  );
});
