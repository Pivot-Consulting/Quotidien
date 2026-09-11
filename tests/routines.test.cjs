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
const routine = (fields = {}) => ({
  id: "r",
  name: "Matin",
  steps: "Eau\nAgenda,Priorité",
  ...fields,
});
test("routine schedules respect local weekdays", () => {
  assert.equal(
    Q.Routines.due(routine({ schedule: "Jours ouvrés" }), "2026-09-11"),
    true,
  );
  assert.equal(
    Q.Routines.due(routine({ schedule: "Jours ouvrés" }), "2026-09-12"),
    false,
  );
  assert.equal(
    Q.Routines.due(routine({ schedule: "Week-end" }), "2026-09-13"),
    true,
  );
  assert.equal(
    Q.Routines.due(
      routine({ schedule: "Jours choisis", weekdays: "1,4" }),
      "2026-09-10",
    ),
    true,
  );
});
test("one daily run tracks independent steps and completes only when ready", () => {
  const s = Q.empty();
  s.routines = [routine()];
  const run = Q.Routines.start(s, "r", "run", "2026-09-11");
  assert.equal(
    JSON.stringify(run.steps.map((x) => x.text)),
    JSON.stringify(["Eau", "Agenda", "Priorité"]),
  );
  assert.equal(Q.Routines.start(s, "r", "other", "2026-09-11").id, "run");
  assert.throws(() => Q.Routines.complete(s, "r", "2026-09-11"), /toutes/);
  for (let i = 0; i < 3; i++) Q.Routines.toggle(s, "r", i, "2026-09-11");
  Q.Routines.complete(s, "r", "2026-09-11");
  assert.ok(run.completedAt);
  assert.throws(() => Q.Routines.toggle(s, "r", 0, "2026-09-11"), /terminée/);
  assert.doesNotThrow(() => Q.normalize(s));
});
test("routine history is sorted and invalid or duplicate imports fail", () => {
  const s = Q.empty();
  s.routines = [routine()];
  for (const date of ["2026-09-10", "2026-09-11"])
    Q.Routines.start(s, "r", date, date);
  assert.equal(
    JSON.stringify(Q.Routines.history(s, "r").map((x) => x.date)),
    JSON.stringify(["2026-09-11", "2026-09-10"]),
  );
  s.routineRuns.push({ ...s.routineRuns[0], id: "duplicate" });
  assert.throws(() => Q.normalize(s), /deux fois/);
  s.routineRuns.pop();
  s.routines[0].schedule = "Jamais";
  assert.throws(() => Q.normalize(s), /Planification/);
});
test("essential routine templates install once without replacing user routines", () => {
  const s = Q.empty();
  s.routines = [{ id: "mine", name: "Ma routine", steps: "Libre" }];
  let id = 0;
  assert.equal(
    Q.Routines.installDefaults(s, () => "t" + ++id),
    3,
  );
  assert.equal(s.routines.length, 4);
  assert.equal(
    Q.Routines.installDefaults(s, () => "x"),
    0,
  );
  assert.equal(s.routines.find((x) => x.id === "mine").name, "Ma routine");
});
