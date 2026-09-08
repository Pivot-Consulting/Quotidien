const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const vm = require("node:vm");
function app(seed) {
  const dom = new JSDOM('<div id="app"></div>', {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.scrollTo = () => {};
  if (seed !== undefined)
    w.localStorage.setItem(
      "quotidien-rebuild-2",
      typeof seed === "string" ? seed : JSON.stringify(seed),
    );
  vm.runInContext(
    fs.readFileSync(".build/core.js", "utf8"),
    dom.getInternalVMContext(),
  );
  vm.runInContext(
    fs.readFileSync("app.js", "utf8"),
    dom.getInternalVMContext(),
  );
  return {
    dom,
    w,
    doc: w.document,
    click(selector) {
      const el = w.document.querySelector(selector);
      assert.ok(el, selector);
      el.click();
    },
    fill(selector, value) {
      const el = w.document.querySelector(selector);
      assert.ok(el, selector);
      el.value = value;
    },
    submit(selector) {
      w.document
        .querySelector(selector)
        .dispatchEvent(
          new w.Event("submit", { bubbles: true, cancelable: true }),
        );
    },
    saved() {
      return JSON.parse(w.localStorage.getItem("quotidien-rebuild-2"));
    },
  };
}
// Baseline reproduction is a one-time audit command, not a repository dependency.
test("clicking inside a modal retains the form and writes survive reload", () => {
  const a = app();
  a.click("[data-action=add-event]");
  a.click("[name=title]");
  assert.ok(a.doc.querySelector("#event-form"));
  a.fill("[name=title]", "Test événement");
  a.submit("#event-form");
  assert.equal(a.saved().events[0].title, "Test événement");
  const b = app(a.saved());
  b.click("[data-screen=plan]");
  b.click("[data-tab=agenda]");
  assert.match(b.doc.body.textContent, /Test événement/);
  a.dom.window.close();
  b.dom.window.close();
});
test("new note button works; editing preserves id and metadata", () => {
  const a = app();
  a.click("[data-screen=notes]");
  a.click("[data-action=add-note]");
  a.fill(".modal [name=title]", "Note test");
  a.fill(".modal [name=body]", "Contenu");
  a.submit(".modal form");
  const id = a.saved().notes[0].id;
  a.click("[data-edit=notes]");
  a.fill(".modal [name=body]", "Modification");
  a.submit(".modal form");
  assert.equal(a.saved().notes.length, 1);
  assert.equal(a.saved().notes[0].id, id);
  assert.equal(a.saved().notes[0].body, "Modification");
  a.dom.window.close();
});
test("all six quick-add forms persist actual records", () => {
  const a = app();
  for (const [kind, key, values] of [
    ["task", "tasks", { title: "Action" }],
    ["event", "events", { title: "Rendez-vous" }],
    ["finance", "finances", { label: "Achat", amount: "-12.5" }],
    ["note", "notes", { title: "Note", body: "Texte" }],
    ["workout", "workouts", { type: "Tennis" }],
    ["habit", "habits", { name: "Lire" }],
  ]) {
    a.click("[data-action=quick]");
    a.click(`[data-create=${kind}]`);
    for (const [name, value] of Object.entries(values))
      a.fill(`.modal [name=${name}]`, value);
    a.submit(".modal form");
    assert.equal(a.saved()[key].length, 1, key);
  }
  a.dom.window.close();
});
test("Escape closes modal and restores trigger focus", () => {
  const a = app();
  const trigger = a.doc.querySelector("[data-action=quick]");
  trigger.focus();
  trigger.click();
  a.doc.dispatchEvent(
    new a.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal(a.doc.querySelector(".modal"), null);
  assert.equal(a.doc.activeElement, trigger);
  assert.equal(a.doc.querySelector(".shell").hasAttribute("inert"), false);
  a.dom.window.close();
});
test("save failures retain form content, expose error, no false success", () => {
  const a = app();
  a.click("[data-action=quick]");
  a.click("[data-create=note]");
  a.fill(".modal [name=title]", "Must survive");
  a.w.Storage.prototype.setItem = function () {
    throw new Error("QuotaExceededError");
  };
  a.submit(".modal form");
  assert.equal(
    a.doc.querySelector(".modal [name=title]").value,
    "Must survive",
  );
  assert.match(
    a.doc.querySelector("[role=alert]").textContent,
    /Sauvegarde impossible/,
  );
  assert.equal(a.doc.querySelector(".toast"), null);
  a.dom.window.close();
});
test("invalid stored data yields recovery instead of empty overwrite", () => {
  const a = app("{corrupt");
  assert.match(a.doc.body.textContent, /Retrouvons tes données/);
  assert.equal(a.w.localStorage.getItem("quotidien-rebuild-2"), "{corrupt");
  a.dom.window.close();
});
test("search shows actionable records instead of just a count", () => {
  const a = app({
    version: 2,
    finances: [
      { id: "x", label: "Électricité", amount: -32, date: "2026-09-01" },
    ],
  });
  a.click("[data-action=search]");
  a.fill("#global-search", "electricite");
  a.doc
    .querySelector("#global-search")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  a.click("#search-results [data-edit=finances]");
  assert.equal(a.doc.querySelector(".modal [name=label]").value, "Électricité");
  a.dom.window.close();
});
test("imported IDs, titles and dates cannot inject markup", () => {
  const a = app({
    version: 2,
    tasks: [
      {
        id: '\"><img src=x onerror=alert(1)>',
        title: "<svg onload=alert(1)>",
        project: "<script>alert(1)</script>",
      },
    ],
  });
  assert.equal(a.doc.querySelector("img,svg,script"), null);
  a.click("[data-edit=tasks]");
  assert.equal(
    a.doc.querySelector(".modal [name=title]").value,
    "<svg onload=alert(1)>",
  );
  a.dom.window.close();
});
test("plan tabs switch views instead of opening creation forms", () => {
  const a = app();
  a.click("[data-screen=plan]");
  a.click("[data-tab=goals]");
  assert.equal(a.doc.querySelector("[data-plan-section=goals]").hidden, false);
  assert.equal(a.doc.querySelector("[data-plan-section=tasks]").hidden, true);
  assert.equal(a.doc.querySelector(".modal"), null);
  a.dom.window.close();
});
test("restore preview does not write until explicit confirmation", () => {
  const a = app();
  a.click("[data-action=quick]");
  a.click("[data-create=task]");
  a.fill(".modal [name=title]", "First");
  a.submit(".modal form");
  a.click("[data-edit=tasks]");
  a.fill(".modal [name=title]", "Second");
  a.submit(".modal form");
  a.click("[data-action=settings]");
  a.click("[data-action=restore]");
  assert.equal(a.saved().tasks[0].title, "Second");
  a.click("[data-action=confirm-import]");
  assert.equal(a.saved().tasks[0].title, "First");
  a.dom.window.close();
});
test("deleted entries can be restored without replacing other data", () => {
  const a = app({
    version: 2,
    tasks: [{ id: "one", title: "Keep" }],
    notes: [{ id: "note", title: "Other" }],
  });
  a.click("[data-del=tasks]");
  assert.equal(a.saved().tasks[0].deleted, true);
  a.click("[data-action=settings]");
  a.click("[data-action=trash]");
  a.click("[data-restore=tasks]");
  assert.equal(a.saved().tasks[0].deleted, false);
  assert.equal(a.saved().notes[0].title, "Other");
  a.dom.window.close();
});
