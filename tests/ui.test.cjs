const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const vm = require("node:vm");
const windows = [];
async function settle() {
  for (const w of windows) await w.Q?.pending;
}
async function app(seed, factory, editor) {
  const dom = new JSDOM('<div id="app"></div>', {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  windows.push(w);
  w.scrollTo = () => {};
  if (factory) Object.defineProperty(w, "indexedDB", { value: factory });
  if (editor) w.localStorage.setItem("quotidien-editor-draft", editor);
  if (seed !== undefined)
    w.localStorage.setItem(
      "quotidien-rebuild-2",
      typeof seed === "string" ? seed : JSON.stringify(seed),
    );
  vm.runInContext(
    require("../scripts/sources.cjs")
      .core.map((p) => fs.readFileSync(p, "utf8"))
      .join("\n"),
    dom.getInternalVMContext(),
  );
  vm.runInContext(
    require("../scripts/sources.cjs")
      .ui.map((p) => fs.readFileSync(p, "utf8"))
      .join("\n"),
    dom.getInternalVMContext(),
  );
  await w.Q.ready;
  return {
    dom,
    w,
    doc: w.document,
    async click(selector) {
      await settle();
      const el = w.document.querySelector(selector);
      await settle();
      assert.ok(el, selector);
      el.click();
      await w.Q.pending;
    },
    fill(selector, value) {
      const el = w.document.querySelector(selector);
      assert.ok(el, selector);
      el.value = value;
    },
    async submit(selector) {
      await settle();
      w.document
        .querySelector(selector)
        .dispatchEvent(
          new w.Event("submit", { bubbles: true, cancelable: true }),
        );
      await w.Q.pending;
    },
    saved() {
      return JSON.parse(w.localStorage.getItem("quotidien-rebuild-2"));
    },
  };
}
// Baseline reproduction is a one-time audit command, not a repository dependency.
test("Focus session, notes and checklist persist and finish without completing the task", async () => {
  const a = await app({
    version: 2,
    tasks: [
      {
        id: "t",
        title: "Dossier",
        personal: { checklist: [{ text: "Relire", done: false }] },
      },
    ],
  });
  await a.click('[data-focus="start"]');
  a.fill('#focus-form [name="notes"]', "Avancée conservée");
  a.doc.querySelector('[name="check-0"]').checked = true;
  await a.submit("#focus-form");
  await a.click('[data-focus="pause"]');
  assert.equal(a.saved().focusSession.runningSince, null);
  const b = await app(a.saved());
  await b.click('[data-focus="open"]');
  assert.equal(
    b.doc.querySelector('[name="notes"]').value,
    "Avancée conservée",
  );
  assert.equal(b.doc.querySelector('[name="check-0"]').checked, true);
  await b.click('[data-focus="finish"]');
  assert.equal(b.saved().health.length, 1);
  assert.equal(b.saved().tasks[0].done, undefined);
  a.dom.window.close();
  b.dom.window.close();
});
test("context preferences and review note are saved through Today", async () => {
  const a = await app();
  a.fill('[name="actionContext"]', "Maison");
  a.fill('[name="availableMinutes"]', "15");
  await a.submit("#context-form");
  assert.equal(a.saved().settings.availableMinutes, 15);
  await a.click('[data-focus="review"]');
  await a.submit("#note-form");
  assert.match(a.saved().notes[0].body, /Bilan du soir/);
  a.dom.window.close();
});
test("connected goal form persists an account and dynamic progress", async () => {
  const a = await app({
    version: 2,
    os: [
      {
        id: "account",
        kind: "account",
        status: "En cours",
        title: "Épargne",
        opening: 250,
      },
      {
        id: "project",
        kind: "project",
        status: "En cours",
        title: "Maison",
        budget: 1000,
        spent: 0,
      },
    ],
  });
  await a.click('[data-action="quick"]');
  await a.click('[data-create="goal"]');
  a.fill('[name="title"]', "Apport");
  a.fill('[name="savingsAccountId"]', "account");
  a.fill('[name="savingsTarget"]', "1000");
  a.fill('[name="projectId"]', "project");
  await a.submit("#goal-form");
  assert.equal(a.saved().goals[0].savingsTarget, 1000);
  assert.match(a.doc.body.textContent, /25%/);
  a.dom.window.close();
});
test("IndexedDB edits survive reopening while preserving the legacy copy", async () => {
  const factory = new (require("fake-indexeddb").IDBFactory)();
  const a = await app(undefined, factory);
  await a.click("[data-action=quick]");
  await a.click('[data-create="note"]');
  a.fill('[name="title"]', "Note transactionnelle");
  await a.submit("#note-form");
  const b = await app(undefined, factory);
  await b.click('[data-screen="notes"]');
  assert.match(b.doc.body.textContent, /Note transactionnelle/);
  assert.equal(a.saved(), null);
  a.dom.window.close();
  b.dom.window.close();
});
test("editor draft survives closure and resumes without creating a duplicate", async () => {
  const a = await app();
  await a.click("[data-action=quick]");
  await a.click('[data-create="note"]');
  a.fill('[name="title"]', "Saisie retrouvée");
  a.doc
    .querySelector('[name="title"]')
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  await a.w.Q.draftPending;
  const raw = a.w.localStorage.getItem("quotidien-editor-draft");
  assert.ok(raw);
  const b = await app(undefined, undefined, raw);
  await b.click('[data-action="settings"]');
  await b.click('[data-action="resume-editor"]');
  assert.equal(b.doc.querySelector('[name="title"]').value, "Saisie retrouvée");
  await b.submit("#note-form");
  assert.equal(b.saved().notes.length, 1);
  assert.equal(b.w.localStorage.getItem("quotidien-editor-draft"), null);
  a.dom.window.close();
  b.dom.window.close();
});
test("clicking inside a modal retains the form and writes survive reload", async () => {
  const a = await app();
  await a.click("[data-action=add-event]");
  await a.click("[name=title]");
  await settle();
  assert.ok(a.doc.querySelector("#event-form"));
  a.fill("[name=title]", "Test événement");
  await a.submit("#event-form");
  await settle();
  assert.equal(a.saved().events[0].title, "Test événement");
  const b = await app(a.saved());
  await b.click("[data-screen=plan]");
  await b.click("[data-tab=agenda]");
  await settle();
  assert.match(b.doc.body.textContent, /Test événement/);
  a.dom.window.close();
  b.dom.window.close();
});
test("new note button works; editing preserves id and metadata", async () => {
  const a = await app();
  await a.click("[data-screen=notes]");
  await a.click("[data-action=add-note]");
  a.fill(".modal [name=title]", "Note test");
  a.fill(".modal [name=body]", "Contenu");
  await a.submit(".modal form");
  const id = a.saved().notes[0].id;
  await a.click("[data-edit=notes]");
  a.fill(".modal [name=body]", "Modification");
  await a.submit(".modal form");
  await settle();
  assert.equal(a.saved().notes.length, 1);
  await settle();
  assert.equal(a.saved().notes[0].id, id);
  await settle();
  assert.equal(a.saved().notes[0].body, "Modification");
  a.dom.window.close();
});
test("all six quick-add forms persist actual records", async () => {
  const a = await app();
  for (const [kind, key, values] of [
    ["task", "tasks", { title: "Action" }],
    ["event", "events", { title: "Rendez-vous" }],
    ["finance", "finances", { label: "Achat", amount: "-12.5" }],
    ["note", "notes", { title: "Note", body: "Texte" }],
    ["workout", "workouts", { type: "Tennis" }],
    ["habit", "habits", { name: "Lire" }],
  ]) {
    await a.click("[data-action=quick]");
    await a.click(`[data-create=${kind}]`);
    for (const [name, value] of Object.entries(values))
      a.fill(`.modal [name=${name}]`, value);
    await a.submit(".modal form");
    await settle();
    assert.equal(a.saved()[key].length, 1, key);
  }
  a.dom.window.close();
});
test("Escape closes modal and restores trigger focus", async () => {
  const a = await app();
  const trigger = a.doc.querySelector("[data-action=quick]");
  trigger.focus();
  trigger.click();
  await settle();
  a.doc.dispatchEvent(
    new a.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settle();
  assert.equal(a.doc.querySelector(".modal"), null);
  await settle();
  assert.equal(a.doc.activeElement, trigger);
  await settle();
  assert.equal(a.doc.querySelector(".shell").hasAttribute("inert"), false);
  a.dom.window.close();
});
test("save failures retain form content, expose error, no false success", async () => {
  const a = await app();
  await a.click("[data-action=quick]");
  await a.click("[data-create=note]");
  a.fill(".modal [name=title]", "Must survive");
  a.w.Storage.prototype.setItem = function () {
    throw new Error("QuotaExceededError");
  };
  await a.submit(".modal form");
  await settle();
  assert.equal(
    a.doc.querySelector(".modal [name=title]").value,
    "Must survive",
  );
  await settle();
  assert.match(
    a.doc.querySelector("[role=alert]").textContent,
    /Sauvegarde impossible/,
  );
  await settle();
  assert.equal(a.doc.querySelector(".toast"), null);
  a.dom.window.close();
});
test("invalid stored data yields recovery instead of empty overwrite", async () => {
  const a = await app("{corrupt");
  await settle();
  assert.match(a.doc.body.textContent, /Retrouvons tes données/);
  await settle();
  assert.equal(a.w.localStorage.getItem("quotidien-rebuild-2"), "{corrupt");
  a.dom.window.close();
});
test("search shows actionable records instead of just a count", async () => {
  const a = await app({
    version: 2,
    finances: [
      { id: "x", label: "Électricité", amount: -32, date: "2026-09-01" },
    ],
  });
  await a.click("[data-action=search]");
  a.fill("#global-search", "electricite");
  a.doc
    .querySelector("#global-search")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  await a.click("#search-results [data-edit=finances]");
  await settle();
  assert.equal(a.doc.querySelector(".modal [name=label]").value, "Électricité");
  a.dom.window.close();
});
test("imported IDs, titles and dates cannot inject markup", async () => {
  const a = await app({
    version: 2,
    tasks: [
      {
        id: '\"><img src=x onerror=alert(1)>',
        title: "<svg onload=alert(1)>",
        project: "<script>alert(1)</script>",
      },
    ],
  });
  await settle();
  assert.equal(a.doc.querySelector("img,svg,script"), null);
  await a.click("[data-edit=tasks]");
  await settle();
  assert.equal(
    a.doc.querySelector(".modal [name=title]").value,
    "<svg onload=alert(1)>",
  );
  a.dom.window.close();
});
test("plan tabs switch views instead of opening creation forms", async () => {
  const a = await app();
  await a.click("[data-screen=plan]");
  await a.click("[data-tab=goals]");
  await settle();
  assert.equal(a.doc.querySelector("[data-plan-section=goals]").hidden, false);
  await settle();
  assert.equal(a.doc.querySelector("[data-plan-section=tasks]").hidden, true);
  await settle();
  assert.equal(a.doc.querySelector(".modal"), null);
  a.dom.window.close();
});
test("restore preview does not write until explicit confirmation", async () => {
  const a = await app();
  await a.click("[data-action=quick]");
  await a.click("[data-create=task]");
  a.fill(".modal [name=title]", "First");
  await a.submit(".modal form");
  await a.click("[data-edit=tasks]");
  a.fill(".modal [name=title]", "Second");
  await a.submit(".modal form");
  await a.click("[data-action=settings]");
  await a.click("[data-action=restore]");
  await settle();
  assert.equal(a.saved().tasks[0].title, "Second");
  await a.click("[data-action=confirm-import]");
  await settle();
  assert.equal(a.saved().tasks[0].title, "First");
  a.dom.window.close();
});
test("deleted entries can be restored without replacing other data", async () => {
  const a = await app({
    version: 2,
    tasks: [{ id: "one", title: "Keep" }],
    notes: [{ id: "note", title: "Other" }],
  });
  await a.click("[data-del=tasks]");
  await settle();
  assert.equal(a.saved().tasks[0].deleted, true);
  await a.click("[data-action=settings]");
  await a.click("[data-action=trash]");
  await a.click("[data-restore=tasks]");
  await settle();
  assert.equal(a.saved().tasks[0].deleted, false);
  await settle();
  assert.equal(a.saved().notes[0].title, "Other");
  a.dom.window.close();
});

test("all 20 workspaces create, reopen, edit and restore their specialized records", async () => {
  const a = await app();
  await a.click("[data-screen=life]");
  await settle();
  assert.equal(a.doc.querySelectorAll("[data-os=open]").length, 20);
  const definitions = a.w.Q.OS.domains;
  const errors = [];
  a.w.addEventListener("error", (ev) => errors.push(ev.error));
  for (const d of definitions) {
    await a.click(`[data-os=open][data-domain=${d.id}]`);
    await settle();
    assert.equal(a.doc.querySelector("h1").textContent, d.name);
    for (const m of d.models) {
      await a.click(`[data-os=type][data-type=${m.id}]`);
      await a.click("[data-os=new]");
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
      await a.submit("#os-form");
      await settle();
      assert.equal(
        a.doc.querySelector("[role=alert]"),
        null,
        m.id + ": " + a.doc.querySelector("[role=alert]")?.textContent,
      );
      const record = a.saved().os.find((r) => r.kind === m.id);
      await settle();
      assert.ok(record, m.id);
      await a.click(`[data-os=edit][data-id="${record.id}"]`);
      a.fill("#os-form [name=details]", "Contexte conservé " + m.id);
      await a.submit("#os-form");
      await settle();
      assert.equal(
        a.saved().os.find((r) => r.id === record.id).details,
        "Contexte conservé " + m.id,
      );
      if (m.id === "member")
        await a.click(`[data-os=duplicate][data-id="${record.id}"]`);
    }
    await a.click("[data-os=home]");
  }
  await settle();
  assert.equal(errors.length, 0, errors.map(String).join("\n"));
  const b = await app(a.saved());
  await b.click("[data-screen=life]");
  await b.click("[data-os=open][data-domain=travel]");
  await settle();
  assert.match(b.doc.body.textContent, /Essai trip/);
  a.dom.window.close();
  b.dom.window.close();
});
test("specialized data participates in search, soft deletion and backup roundtrip", async () => {
  const a = await app({
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
  await a.click("[data-action=search]");
  a.fill("#global-search", "elodie");
  a.doc
    .querySelector("#global-search")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  await a.click("[data-edit=os]");
  await settle();
  assert.equal(a.doc.querySelector("#os-form [name=title]").value, "Élodie");
  await a.click("[data-close]");
  await a.click("[data-screen=life]");
  await a.click("[data-os=open][data-domain=household]");
  await a.click("[data-del=os]");
  await settle();
  assert.equal(a.saved().os[0].deleted, true);
  await a.click("[data-action=settings]");
  await a.click("[data-action=trash]");
  await a.click("[data-restore=os]");
  await settle();
  assert.equal(a.saved().os[0].deleted, false);
  await settle();
  assert.equal(
    a.w.Q.parseBackup(a.w.Q.backup(a.saved())).os[0].title,
    "Élodie",
  );
  a.dom.window.close();
});
test("OS quota errors retain edit content and a retry does not duplicate records", async () => {
  const a = await app();
  await a.click("[data-screen=life]");
  await a.click("[data-os=open][data-domain=household]");
  await a.click("[data-os=new]");
  a.fill("#os-form [name=title]", "Membre test");
  const original = a.w.Storage.prototype.setItem;
  a.w.Storage.prototype.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  await a.submit("#os-form");
  await settle();
  assert.equal(
    a.doc.querySelector("#os-form [name=title]").value,
    "Membre test",
  );
  await settle();
  assert.match(
    a.doc.querySelector("[role=alert]").textContent,
    /Sauvegarde impossible/,
  );
  a.w.Storage.prototype.setItem = original;
  await a.submit("#os-form");
  await settle();
  assert.equal(a.saved().os.length, 1);
  a.dom.window.close();
});
test("rules preview does not write, applying twice cannot duplicate generated tasks", async () => {
  const a = await app({
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
  await a.click("[data-screen=life]");
  await a.click("[data-os=open][data-domain=automation]");
  await a.click("[data-os=rules-preview]");
  await settle();
  assert.equal(a.saved().tasks, undefined);
  await a.click("[data-os=rules-apply]");
  await settle();
  assert.equal(a.saved().tasks.length, 1);
  await a.click("[data-os=rules-preview]");
  await settle();
  assert.equal(a.doc.querySelector("[data-os=rules-apply]"), null);
  a.dom.window.close();
});

test("shared properties, relations and checklist survive reload with cross-collection IDs", async () => {
  const a = await app({
    version: 2,
    tasks: [{ id: "same", title: "Dossier" }],
    notes: [{ id: "same", title: "Banque" }],
  });
  await a.click("[data-edit=tasks]");
  a.fill("[name=personal_tags]", "Banque, Urgent");
  a.fill("[name=personal_checklist]", "Joindre pièce\n[x] Vérifier");
  a.fill("[name=personal_priority]", "5");
  await a.submit("#task-form");
  await settle();
  assert.equal(a.saved().tasks[0].personal.priority, 5);
  await settle();
  assert.equal(a.saved().tasks[0].personal.checklist[1].done, true);
  await a.click("[data-edit=tasks]");
  await a.click("[data-personal=detail]");
  a.fill("#relation-target", JSON.stringify(["notes", "same"]));
  await a.submit("#relation-form");
  await settle();
  assert.equal(a.saved().connections.length, 1);
  await settle();
  assert.match(a.doc.querySelector(".modal").textContent, /Banque/);
  await a.click('[data-personal-check="0"]');
  await settle();
  assert.equal(a.saved().tasks[0].personal.checklist[0].done, true);
  const b = await app(a.saved());
  await b.click("[data-edit=tasks]");
  await b.click("[data-personal=detail]");
  await settle();
  assert.match(b.doc.querySelector(".modal").textContent, /Banque/);
  a.dom.window.close();
  b.dom.window.close();
});
test("dirty editors block opening relations until saved, including OS fields", async () => {
  const a = await app({ version: 2, tasks: [{ id: "t", title: "Original" }] });
  await a.click("[data-edit=tasks]");
  a.fill("[name=title]", "Brouillon");
  await a.click("[data-personal=detail]");
  await settle();
  assert.match(a.doc.querySelector("[role=alert]").textContent, /Enregistre/);
  await settle();
  assert.equal(a.doc.querySelector("[name=title]").value, "Brouillon");
  a.dom.window.close();
});
test("archive, saved filters, shared views, duplication and revision restore are usable", async () => {
  const a = await app({ version: 2, tasks: [{ id: "t", title: "Dossier" }] });
  await a.click("[data-edit=tasks]");
  a.fill("[name=title]", "Dossier v2");
  await a.submit("#task-form");
  await a.click("[data-edit=tasks]");
  await a.click("[data-personal=detail]");
  await a.click("[data-personal=archive]");
  await settle();
  assert.equal(a.saved().tasks[0].personal.archived, true);
  await a.click("[data-close]");
  await a.click("[data-action=search]");
  a.fill("[data-personal-filter=archive]", "archived");
  a.doc
    .querySelector("[data-personal-filter=archive]")
    .dispatchEvent(new a.w.Event("change", { bubbles: true }));
  await settle();
  assert.match(
    a.doc.querySelector("#search-results").textContent,
    /Dossier v2/,
  );
  for (const v of ["kanban", "timeline", "list"]) {
    await a.click(`[data-view=${v}]`);
    await settle();
    assert.match(
      a.doc.querySelector("#search-results").textContent,
      /Dossier v2/,
    );
  }
  await a.click("[data-personal=save-search]");
  a.fill("#saved-search-form [name=name]", "Archives");
  await a.submit("#saved-search-form");
  await settle();
  assert.equal(a.saved().settings.searches[0].filter.archive, "archived");
  await a.click("[data-personal=detail]");
  await a.click("[data-personal=revision]");
  await a.click("[data-personal=confirm-revision]");
  await settle();
  assert.equal(a.saved().tasks[0].personal?.archived, undefined);
  await a.click("[data-personal=duplicate]");
  await settle();
  assert.equal(a.saved().tasks.length, 2);
  await settle();
  assert.equal(a.saved().tasks[0].title, "Dossier v2 (copie)");
  a.dom.window.close();
});
test("relationship rejection and save failure preserve selected target for retry", async () => {
  const a = await app({
    version: 2,
    tasks: [{ id: "t", title: "Tâche" }],
    notes: [{ id: "n", title: "Note" }],
  });
  await a.click("[data-edit=tasks]");
  await a.click("[data-personal=detail]");
  a.fill("#relation-target", JSON.stringify(["notes", "n"]));
  const original = a.w.Storage.prototype.setItem;
  a.w.Storage.prototype.setItem = () => {
    throw new Error("Quota");
  };
  await a.submit("#relation-form");
  await settle();
  assert.equal(
    a.doc.querySelector("#relation-target").value,
    JSON.stringify(["notes", "n"]),
  );
  a.w.Storage.prototype.setItem = original;
  await a.submit("#relation-form");
  await settle();
  assert.equal(a.saved().connections.length, 1);
  a.fill("#relation-target", JSON.stringify(["notes", "n"]));
  await a.submit("#relation-form");
  await settle();
  assert.match(a.doc.querySelector("[role=alert]").textContent, /existe déjà/);
  await settle();
  assert.equal(a.saved().connections.length, 1);
  a.dom.window.close();
});

test("OS deep links reset old filters and reject a type from another domain", async () => {
  const a = await app();
  await a.click("[data-screen=life]");
  await a.click("[data-os=open][data-domain=finance]");
  a.fill("[data-os-query]", "Introuvable");
  a.doc
    .querySelector("[data-os-query]")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  a.w.location.hash = "#life/projects/account";
  a.w.dispatchEvent(new a.w.HashChangeEvent("hashchange"));
  await settle();
  assert.equal(a.doc.querySelector("h1").textContent, "Projets de vie");
  await settle();
  assert.equal(a.doc.querySelector("[data-os-query]").value, "");
  await settle();
  assert.equal(
    a.doc.querySelector("[role=tab][aria-selected=true]").dataset.type,
    "project",
  );
  a.dom.window.close();
});
test("search history persists only on submitted search and survives reload", async () => {
  const a = await app();
  await a.click("[data-action=search]");
  a.fill("#global-search", "voyage");
  a.doc
    .querySelector("#global-search")
    .dispatchEvent(new a.w.Event("input", { bubbles: true }));
  await settle();
  assert.equal(a.saved(), null);
  await a.submit("#global-search-form");
  await settle();
  assert.equal(a.saved().settings.searchHistory[0], "voyage");
  const b = await app(a.saved());
  await b.click("[data-action=search]");
  await b.click("[data-personal=recent-search]");
  await settle();
  assert.equal(b.doc.querySelector("#global-search").value, "voyage");
  await b.click("[data-personal=clear-history]");
  await settle();
  assert.equal(b.saved().settings.searchHistory.length, 0);
  a.dom.window.close();
  b.dom.window.close();
});

test("Escape, backdrop and search shortcut preserve dirty drafts until explicit discard", async () => {
  const a = await app();
  await a.click("[data-action=quick]");
  await a.click("[data-create=note]");
  a.fill("[name=title]", "Brouillon précieux");
  a.doc.dispatchEvent(
    new a.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settle();
  assert.equal(a.doc.querySelector("[name=title]").value, "Brouillon précieux");
  await a.click("[data-keep-draft]");
  await settle();
  assert.equal(a.doc.querySelector(".discard-prompt"), null);
  a.doc.dispatchEvent(
    new a.w.KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
    }),
  );
  await settle();
  assert.equal(a.doc.querySelector("[name=title]").value, "Brouillon précieux");
  await a.click(".modal-wrap");
  await a.click("[data-discard-draft]");
  await settle();
  assert.equal(a.doc.querySelector(".modal"), null);
  await settle();
  assert.equal(a.saved(), null);
  a.dom.window.close();
});
test("calendar routes to record details and preserves multi-day trips across month navigation", async () => {
  const a = await app({
    version: 2,
    events: [
      { id: "e", title: "Rendez-vous test", date: "2026-09-09", time: "10:00" },
    ],
  });
  await a.click("[data-screen=plan]");
  await a.click("[data-tab=calendar]");
  a.fill('[data-cockpit-field="month"]', "2026-09");
  a.doc
    .querySelector('[data-cockpit-field="month"]')
    .dispatchEvent(new a.w.Event("change", { bubbles: true }));
  await a.click('[data-day="2026-09-09"]');
  await settle();
  assert.match(
    a.doc.querySelector(".calendar-agenda").textContent,
    /Rendez-vous test/,
  );
  await a.click(".calendar-agenda [data-personal=detail]");
  await settle();
  assert.match(a.doc.querySelector(".modal").textContent, /Rendez-vous test/);
  await a.click("[data-close]");
  await a.click('[data-cockpit="month-next"]');
  await settle();
  assert.equal(
    a.doc.querySelector('[data-cockpit-field="month"]').value,
    "2026-10",
  );
  a.dom.window.close();
});
test("insight acceptance, filtering, reload and quota retry persist one connected follow-up task", async () => {
  const a = await app({
    version: 2,
    os: [
      {
        id: "d",
        kind: "document",
        title: "Renouvellement",
        status: "En cours",
        due: "2020-01-01",
      },
    ],
  });
  await a.click("[data-cockpit=intelligence]");
  const original = a.w.Storage.prototype.setItem;
  a.w.Storage.prototype.setItem = () => {
    throw new Error("Quota");
  };
  await a.click("[data-cockpit=accept]");
  await settle();
  assert.match(
    a.doc.querySelector("[role=alert]").textContent,
    /Sauvegarde impossible/,
  );
  a.w.Storage.prototype.setItem = original;
  await a.click("[data-cockpit=accept]");
  await settle();
  assert.equal(a.saved().tasks.length, 1);
  await settle();
  assert.equal(a.saved().connections.length, 1);
  const b = await app(a.saved());
  await b.click("[data-cockpit=intelligence]");
  b.fill('[data-cockpit-field="disposition"]', "accepted");
  b.doc
    .querySelector('[data-cockpit-field="disposition"]')
    .dispatchEvent(new b.w.Event("change", { bubbles: true }));
  await b.click("[data-cockpit=reactivate]");
  b.fill('[data-cockpit-field="disposition"]', "active");
  b.doc
    .querySelector('[data-cockpit-field="disposition"]')
    .dispatchEvent(new b.w.Event("change", { bubbles: true }));
  await settle();
  const card = Array.from(b.doc.querySelectorAll(".insight-card")).find(
    (x) =>
      x.querySelector("h2").textContent.includes("Renouvellement") &&
      !x.querySelector("h2").textContent.includes("Traiter"),
  );
  card.querySelector("[data-cockpit=accept]").click();
  await settle();
  assert.equal(b.saved().tasks.length, 1);
  a.dom.window.close();
  b.dom.window.close();
});

test("calendar event creation uses the selected day and a clean form can close", async () => {
  const a = await app();
  await a.click("[data-screen=plan]");
  await a.click("[data-tab=calendar]");
  a.fill('[data-cockpit-field="month"]', "2027-02");
  a.doc
    .querySelector('[data-cockpit-field="month"]')
    .dispatchEvent(new a.w.Event("change", { bubbles: true }));
  await a.click('[data-day="2027-02-14"]');
  await a.click('[data-cockpit="create-event"]');
  await settle();
  assert.equal(
    a.doc.querySelector("#event-form [name=date]").value,
    "2027-02-14",
  );
  await a.click("[data-close]");
  await settle();
  assert.equal(a.doc.querySelector(".modal"), null);
  await a.click('[data-cockpit="create-event"]');
  a.fill("#event-form [name=title]", "Événement choisi");
  await a.submit("#event-form");
  await settle();
  assert.equal(a.saved().events[0].date, "2027-02-14");
  a.dom.window.close();
});

test("Today installs, executes and remembers essential routines", async () => {
  const a = await app();
  await a.click('[data-routine="templates"]');
  assert.equal(a.saved().routines.length, 3);
  await a.click('[data-routine="open"]');
  while (a.doc.querySelector("[data-routine-step]:not(:checked)")) {
    const step = a.doc.querySelector("[data-routine-step]:not(:checked)");
    step.checked = true;
    step.dispatchEvent(new a.w.Event("change", { bubbles: true }));
    await a.w.Q.pending;
  }
  await a.click('[data-routine="complete"]');
  assert.ok(a.saved().routineRuns[0].completedAt);
  const b = await app(a.saved());
  assert.match(b.doc.body.textContent, /Terminée/);
  a.dom.window.close();
  b.dom.window.close();
});

test("Today widgets can be simplified and stay configured", async () => {
  const a = await app();
  await a.click('[data-action="today-settings"]');
  a.doc.querySelector('[name="routines"]').checked = false;
  await a.submit("#today-settings-form");
  assert.equal(a.saved().settings.todayWidgets.routines, false);
  assert.equal(a.doc.querySelector('[data-routine="templates"]'), null);
  const b = await app(a.saved());
  assert.equal(b.doc.querySelector('[data-routine="templates"]'), null);
  a.dom.window.close();
  b.dom.window.close();
});

test("Document Vault persists metadata, project links and filters across reload", async () => {
  const seed = {
    version: 2,
    os: [
      {
        id: "project",
        kind: "project",
        title: "Maison",
        status: "En cours",
        budget: 0,
        spent: 0,
      },
    ],
  };
  const a = await app(seed);
  let b;
  try {
    await a.click('[data-screen="wave"]');
    await a.click('[data-screen="vault"]');
    await a.click('[data-vault="new"]');
    a.fill('#vault-form [name="title"]', "Assurance habitation");
    a.fill('#vault-form [name="category"]', "Contrat");
    a.fill('#vault-form [name="company"]', "Mutuelle Exemple");
    a.fill('#vault-form [name="projectId"]', "project");
    await a.submit("#vault-form");
    assert.equal(a.saved().documents[0].projectId, "project");
    b = await app(a.saved());
    await b.click('[data-screen="wave"]');
    await b.click('[data-screen="vault"]');
    b.fill('#vault-search [name="query"]', "mutuelle");
    await b.submit("#vault-search");
    assert.match(b.doc.body.textContent, /Assurance habitation/);
  } finally {
    a.dom.window.close();
    b?.dom.window.close();
  }
});

test("Automation templates create idempotent notices and save quiet hours", async () => {
  const a = await app({
    version: 2,
    finances: [{ id: "expense", label: "Ordinateur", amount: -900 }],
  });
  await a.click('[data-screen="wave"]');
  await a.click('[data-screen="automation"]');
  await a.click(
    '[data-automation="template"][data-trigger="Dépense importante"]',
  );
  await a.submit("#automation-builder");
  assert.equal(a.saved().automations.length, 1);
  assert.equal(a.saved().notifications.length, 1);
  assert.equal(a.saved().automationLogs.length, 1);
  a.fill('#notification-prefs [name="quietStart"]', "21:30");
  a.fill('#notification-prefs [name="quietEnd"]', "06:45");
  await a.submit("#notification-prefs");
  assert.equal(a.saved().settings.notificationQuietStart, "21:30");
  await a.click('[data-automation="run"]');
  assert.equal(a.saved().notifications.length, 1);
  await a.click('[data-automation="notices"]');
  await a.click('[data-automation="snooze"][data-days="1"]');
  assert.equal(a.saved().notifications[0].read, true);
  assert.ok(a.saved().notifications[0].snoozedUntil);
  a.dom.window.close();
});
