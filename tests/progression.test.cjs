const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const context = vm.createContext({ Date, Map, Set, URL });
vm.runInContext(
  require("../scripts/sources.cjs")
    .core.map((p) => fs.readFileSync(p, "utf8"))
    .join("\n"),
  context,
);
const Q = context.Q,
  P = Q.Progression;
const record = (id, kind, props = {}) => ({
  id,
  kind,
  title: id,
  status: "En cours",
  ...props,
});
test("weighted household shares preserve exact cents and legacy equal allocation", () => {
  const expense = { id: "x", participants: ["a", "b", "c"], cost: 10.01 };
  assert.deepEqual(
    Array.from(P.shares(expense), (x) => x.cents),
    [334, 334, 333],
  );
  expense.participants = ["a", "b"];
  expense.shareWeights = [
    { memberId: "a", weight: 2 },
    { memberId: "b", weight: 1 },
  ];
  assert.deepEqual(
    Array.from(P.shares(expense), (x) => x.cents),
    [667, 334],
  );
  for (let cents = 0; cents < 500; cents++) {
    expense.cost = cents / 100;
    assert.equal(
      P.shares(expense).reduce((n, s) => n + s.cents, 0),
      cents,
    );
  }
  const s = Q.empty();
  s.os = [
    record("a", "member"),
    record("b", "member"),
    record("e", "sharedExpense", {
      ...expense,
      id: "e",
      cost: 10.01,
      payerId: "a",
      date: "2026-09-17",
    }),
  ];
  assert.doesNotThrow(() => Q.normalize(s));
  assert.deepEqual(
    Array.from(Q.OS.balances(s), (x) => x.cents),
    [334, -334],
  );
  s.os.push(
    record("r", "settlement", {
      fromId: "b",
      toId: "a",
      cost: 3.34,
      date: "2026-09-17",
    }),
  );
  assert.ok(Q.OS.balances(s).every((x) => x.cents === 0));
});
test("invalid or stale household weights fail closed instead of silently redistributing", () => {
  for (const weights of [
    [{ memberId: "a", weight: 1 }],
    [
      { memberId: "a", weight: 1 },
      { memberId: "a", weight: 2 },
    ],
    [
      { memberId: "a", weight: 1 },
      { memberId: "c", weight: 2 },
    ],
    [
      { memberId: "a", weight: 0 },
      { memberId: "b", weight: 2 },
    ],
    [
      { memberId: "a", weight: Infinity },
      { memberId: "b", weight: 2 },
    ],
  ])
    assert.throws(
      () =>
        P.shares({
          id: "x",
          participants: ["a", "b"],
          cost: 5,
          shareWeights: weights,
        }),
      /poids/,
    );
});
test("exercise sets stay within their program, with unique integer set numbers", () => {
  const s = Q.empty();
  s.os = [
    record("p", "trainingProgram", {
      sport: "Tennis",
      exercises: "Service",
      weeklySessions: 2,
    }),
    record("p2", "trainingProgram", {
      sport: "Tennis",
      exercises: "Retour",
      weeklySessions: 2,
    }),
    record("e", "trainingExercise", {
      programId: "p",
      targetSets: 3,
      targetReps: 10,
      targetLoad: 0,
      restSeconds: 60,
    }),
    record("s", "trainingSession", {
      programId: "p",
      date: "2026-09-17",
      minutes: 30,
      effort: 5,
    }),
    record("set", "exerciseSet", {
      sessionId: "s",
      exerciseId: "e",
      setIndex: 1,
      repetitions: 12,
      load: 0,
      seconds: 60,
    }),
  ];
  assert.doesNotThrow(() => Q.normalize(s));
  assert.equal(P.performance(s, "e")[0].repetitions, 12);
  s.os.push({ ...s.os[4], id: "duplicate" });
  assert.throws(() => Q.normalize(s), /existe déjà/);
  s.os.pop();
  s.os[4].setIndex = 1.5;
  assert.throws(() => Q.normalize(s), /entiers/);
  s.os[4].setIndex = 1;
  s.os[3].programId = "p2";
  assert.throws(() => Q.normalize(s), /même programme/);
});
test("ten scores preserve unknown versus zero, explain coverage and do not mutate state", () => {
  const s = Q.empty(),
    empty = P.scores(s, "2026-09-17");
  assert.equal(empty.length, 10);
  assert.ok(empty.every((x) => x.score === null));
  s.os = [
    record("l", "lifeRating", {
      area: "Finances",
      score: 0,
      date: "2026-09-17",
    }),
  ];
  let score = P.scores(s, "2026-09-17").find((x) => x.id === "finance");
  assert.equal(score.score, 0);
  assert.match(score.coverage, /1\/2/);
  s.os.push(
    record("b", "budget", {
      category: "Courses",
      month: "2026-09",
      limit: 100,
    }),
  );
  s.finances = [
    { id: "t", date: "2026-09-16", amount: -200, category: "courses" },
  ];
  const before = JSON.stringify(s);
  score = P.scores(s, "2026-09-17").find((x) => x.id === "finance");
  assert.equal(score.score, 25);
  assert.match(score.coverage, /2\/2/);
  assert.equal(JSON.stringify(s), before);
  s.finances[0].date = "2026-09-18";
  assert.equal(
    P.scores(s, "2026-09-17").find((x) => x.id === "finance").components[0]
      .score,
    null,
  );
  s.os[0].date = "2026-08-18";
  assert.equal(
    P.scores(s, "2026-09-17").find((x) => x.id === "finance").score,
    null,
  );
});
test("composite scores use declared units and omit unknown MFA and expired observations", () => {
  const s = Q.empty();
  s.os = [
    record("a", "service", { mfa: "À vérifier" }),
    record("b", "service", { mfa: "Activée" }),
    record("g", "impactGoal", { targetValue: 10, unit: "heures" }),
    record("g2", "impactGoal", { targetValue: 100, unit: "kg" }),
    record("c", "contribution", {
      impactGoalId: "g",
      date: "2026-09-16",
      quantity: 5,
    }),
    record("c2", "contribution", {
      impactGoalId: "g2",
      date: "2026-09-16",
      quantity: 100,
    }),
  ];
  assert.equal(
    P.scores(s, "2026-09-17").find((x) => x.id === "digital").score,
    100,
  );
  assert.equal(
    P.scores(s, "2026-09-17").find((x) => x.id === "impact").score,
    75,
  );
  s.os[1].personal = { archived: true };
  assert.equal(
    P.scores(s, "2026-09-17").find((x) => x.id === "digital").score,
    null,
  );
});
