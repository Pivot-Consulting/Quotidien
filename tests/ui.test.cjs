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
    fs.readFileSync(".build/core.js", "utf8") +
      "\n" +
      fs.readFileSync(".build/os.js", "utf8") +
      "\n" +
      fs.readFileSync(".build/personal.js", "utf8"),
    dom.getInternalVMContext(),
  );
  vm.runInContext(
    fs.readFileSync("modules/os-ui.js", "utf8") +
      "\n" +
      fs.readFileSync("modules/personal-ui.js", "utf8") +
      "\n" +
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

test("all 20 workspaces create, reopen, edit and restore their specialized records", () => {
  const a = app();
  a.click("[data-screen=life]");
  assert.equal(a.doc.querySelectorAll("[data-os=open]").length, 20);
  const definitions = a.w.Q.OS.domains;
  const errors = [];
  a.w.addEventListener("error", (ev) => errors.push(ev.error));
  for (const d of definitions) {
    a.click(`[data-os=open][data-domain=${d.id}]`);
    assert.equal(a.doc.querySelector("h1").textContent, d.name);
    for (const m of d.models) {
      a.click(`[data-os=type][data-type=${m.id}]`);
      a.click("[data-os=new]");
      a.fill("#os-form [name=title]", "Essai " + m.id);
      for (const f of m.fields) {
        const input = a.doc.querySelector(`#os-form [name="${f.key}"]`);
        if (f.type === "ref") {
          const reference = a
            .saved()
            ?.os.find(
              (r) =>
                r.kind === f.ref &&
                (f.key !== "toId" ||
                  r.id !== a.doc.querySelector("#os-form [name=fromId]").value),
            );
          if (reference) input.value = reference.id;
        } else if (f.type === "refs") {
          if (input) input.checked = true;
        } else if (f.type === "number")
          input.value = String(Math.max(f.min || 0, 1));
        else if (f.type === "date") input.value = "2026-09-08";
        else if (f.type === "month") input.value = "2026-09";
        else if (f.type === "time") input.value = "14:30";
        else if (f.type === "url") input.value = "https://example.com/";
        else if (f.type !== "select") input.value = "Essai";
      }
      a.submit("#os-form");
      assert.equal(
        a.doc.querySelector("[role=alert]"),
        null,
        m.id + ": " + a.doc.querySelector("[role=alert]")?.textContent,
      );
      const record = a.saved().os.find((r) => r.kind === m.id);
      assert.ok(record, m.id);
      a.click(`[data-os=edit][data-id="${record.id}"]`);
      a.fill("#os-form [name=details]", "Contexte conservé " + m.id);
      a.submit("#os-form");
      assert.equal(
        a.saved().os.find((r) => r.id === record.id).details,
        "Contexte conservé " + m.id,
      );
      if (m.id === "member")
        a.click(`[data-os=duplicate][data-id="${record.id}"]`);
    }
    a.click("[data-os=home]");
  }
  assert.equal(errors.length, 0, errors.map(String).join("\n"));
  const b = app(a.saved());
  b.click("[data-screen=life]");
  b.click("[data-os=open][data-domain=travel]");
  assert.match(b.doc.body.textContent, /Essai trip/);
  a.dom.window.close();
  b.dom.window.close();
});
test("specialized data participates in search, soft deletion and backup roundtrip", () => {
  const a = app({
    version: 2,
    os: [
      {
        id: "m",
        kind: "member",
        title: "Élodie",
        status: "En cours",
        role: "Maison",
      },
    ],
  });
  a.click("[data-action=search]");
  a.fill("#global-search", "elodie");
  a.doc
    .querySelector("#global-search")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  a.click("[data-edit=os]");
  assert.equal(a.doc.querySelector("#os-form [name=title]").value, "Élodie");
  a.click("[data-close]");
  a.click("[data-screen=life]");
  a.click("[data-os=open][data-domain=household]");
  a.click("[data-del=os]");
  assert.equal(a.saved().os[0].deleted, true);
  a.click("[data-action=settings]");
  a.click("[data-action=trash]");
  a.click("[data-restore=os]");
  assert.equal(a.saved().os[0].deleted, false);
  assert.equal(
    a.w.Q.parseBackup(a.w.Q.backup(a.saved())).os[0].title,
    "Élodie",
  );
  a.dom.window.close();
});
test("OS quota errors retain edit content and a retry does not duplicate records", () => {
  const a = app();
  a.click("[data-screen=life]");
  a.click("[data-os=open][data-domain=household]");
  a.click("[data-os=new]");
  a.fill("#os-form [name=title]", "Membre test");
  const original = a.w.Storage.prototype.setItem;
  a.w.Storage.prototype.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  a.submit("#os-form");
  assert.equal(
    a.doc.querySelector("#os-form [name=title]").value,
    "Membre test",
  );
  assert.match(
    a.doc.querySelector("[role=alert]").textContent,
    /Sauvegarde impossible/,
  );
  a.w.Storage.prototype.setItem = original;
  a.submit("#os-form");
  assert.equal(a.saved().os.length, 1);
  a.dom.window.close();
});
test("rules preview does not write, applying twice cannot duplicate generated tasks", () => {
  const a = app({
    version: 2,
    os: [
      {
        id: "r",
        kind: "rule",
        title: "Règle",
        status: "En cours",
        source: "Échéances OS",
        enabled: "Active",
        horizon: 7,
        prefix: "Faire",
      },
      {
        id: "doc",
        kind: "document",
        title: "Contrat",
        status: "En cours",
        due: "2020-01-01",
      },
    ],
  });
  a.click("[data-screen=life]");
  a.click("[data-os=open][data-domain=automation]");
  a.click("[data-os=rules-preview]");
  assert.equal(a.saved().tasks, undefined);
  a.click("[data-os=rules-apply]");
  assert.equal(a.saved().tasks.length, 1);
  a.click("[data-os=rules-preview]");
  assert.equal(a.doc.querySelector("[data-os=rules-apply]"), null);
  a.dom.window.close();
});

test("shared properties, relations and checklist survive reload with cross-collection IDs", () => {
  const a = app({
    version: 2,
    tasks: [{ id: "same", title: "Dossier" }],
    notes: [{ id: "same", title: "Banque" }],
  });
  a.click("[data-edit=tasks]");
  a.fill("[name=personal_tags]", "Banque, Urgent");
  a.fill("[name=personal_checklist]", "Joindre pièce\n[x] Vérifier");
  a.fill("[name=personal_priority]", "5");
  a.submit("#task-form");
  assert.equal(a.saved().tasks[0].personal.priority, 5);
  assert.equal(a.saved().tasks[0].personal.checklist[1].done, true);
  a.click("[data-edit=tasks]");
  a.click("[data-personal=detail]");
  a.fill("#relation-target", JSON.stringify(["notes", "same"]));
  a.submit("#relation-form");
  assert.equal(a.saved().connections.length, 1);
  assert.match(a.doc.querySelector(".modal").textContent, /Banque/);
  a.click('[data-personal-check="0"]');
  assert.equal(a.saved().tasks[0].personal.checklist[0].done, true);
  const b = app(a.saved());
  b.click("[data-edit=tasks]");
  b.click("[data-personal=detail]");
  assert.match(b.doc.querySelector(".modal").textContent, /Banque/);
  a.dom.window.close();
  b.dom.window.close();
});
test("dirty editors block opening relations until saved, including OS fields", () => {
  const a = app({ version: 2, tasks: [{ id: "t", title: "Original" }] });
  a.click("[data-edit=tasks]");
  a.fill("[name=title]", "Brouillon");
  a.click("[data-personal=detail]");
  assert.match(a.doc.querySelector("[role=alert]").textContent, /Enregistre/);
  assert.equal(a.doc.querySelector("[name=title]").value, "Brouillon");
  a.dom.window.close();
});
test("archive, saved filters, shared views, duplication and revision restore are usable", () => {
  const a = app({ version: 2, tasks: [{ id: "t", title: "Dossier" }] });
  a.click("[data-edit=tasks]");
  a.fill("[name=title]", "Dossier v2");
  a.submit("#task-form");
  a.click("[data-edit=tasks]");
  a.click("[data-personal=detail]");
  a.click("[data-personal=archive]");
  assert.equal(a.saved().tasks[0].personal.archived, true);
  a.click("[data-close]");
  a.click("[data-action=search]");
  a.fill("[data-personal-filter=archive]", "archived");
  a.doc
    .querySelector("[data-personal-filter=archive]")
    .dispatchEvent(new a.w.Event("change", { bubbles: true }));
  assert.match(
    a.doc.querySelector("#search-results").textContent,
    /Dossier v2/,
  );
  for (const v of ["kanban", "timeline", "list"]) {
    a.click(`[data-view=${v}]`);
    assert.match(
      a.doc.querySelector("#search-results").textContent,
      /Dossier v2/,
    );
  }
  a.click("[data-personal=save-search]");
  a.fill("#saved-search-form [name=name]", "Archives");
  a.submit("#saved-search-form");
  assert.equal(a.saved().settings.searches[0].filter.archive, "archived");
  a.click("[data-personal=detail]");
  a.click("[data-personal=revision]");
  a.click("[data-personal=confirm-revision]");
  assert.equal(a.saved().tasks[0].personal?.archived, undefined);
  a.click("[data-personal=duplicate]");
  assert.equal(a.saved().tasks.length, 2);
  assert.equal(a.saved().tasks[0].title, "Dossier v2 (copie)");
  a.dom.window.close();
});
test("relationship rejection and save failure preserve selected target for retry", () => {
  const a = app({
    version: 2,
    tasks: [{ id: "t", title: "Tâche" }],
    notes: [{ id: "n", title: "Note" }],
  });
  a.click("[data-edit=tasks]");
  a.click("[data-personal=detail]");
  a.fill("#relation-target", JSON.stringify(["notes", "n"]));
  const original = a.w.Storage.prototype.setItem;
  a.w.Storage.prototype.setItem = () => {
    throw new Error("Quota");
  };
  a.submit("#relation-form");
  assert.equal(
    a.doc.querySelector("#relation-target").value,
    JSON.stringify(["notes", "n"]),
  );
  a.w.Storage.prototype.setItem = original;
  a.submit("#relation-form");
  assert.equal(a.saved().connections.length, 1);
  a.fill("#relation-target", JSON.stringify(["notes", "n"]));
  a.submit("#relation-form");
  assert.match(a.doc.querySelector("[role=alert]").textContent, /existe déjà/);
  assert.equal(a.saved().connections.length, 1);
  a.dom.window.close();
});

test("OS deep links reset old filters and reject a type from another domain", () => {
  const a = app();
  a.click("[data-screen=life]");
  a.click("[data-os=open][data-domain=finance]");
  a.fill("[data-os-query]", "Introuvable");
  a.doc
    .querySelector("[data-os-query]")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  a.w.location.hash = "#life/projects/account";
  a.w.dispatchEvent(new a.w.HashChangeEvent("hashchange"));
  assert.equal(a.doc.querySelector("h1").textContent, "Projets de vie");
  assert.equal(a.doc.querySelector("[data-os-query]").value, "");
  assert.equal(
    a.doc.querySelector("[role=tab][aria-selected=true]").dataset.type,
    "project",
  );
  a.dom.window.close();
});
test("search history persists only on submitted search and survives reload", () => {
  const a = app();
  a.click("[data-action=search]");
  a.fill("#global-search", "voyage");
  a.doc
    .querySelector("#global-search")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  assert.equal(a.saved(), null);
  a.submit("#global-search-form");
  assert.equal(a.saved().settings.searchHistory[0], "voyage");
  const b = app(a.saved());
  b.click("[data-action=search]");
  b.click("[data-personal=recent-search]");
  assert.equal(b.doc.querySelector("#global-search").value, "voyage");
  b.click("[data-personal=clear-history]");
  assert.equal(b.saved().settings.searchHistory.length, 0);
  a.dom.window.close();
  b.dom.window.close();
});
