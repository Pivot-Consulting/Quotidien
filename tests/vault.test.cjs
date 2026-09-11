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
test("vault finds accent-insensitive metadata and reports real expiry groups", () => {
  const s = Q.empty();
  s.documents = [
    {
      id: "a",
      title: "Assurance habitation",
      company: "Crédit Mutuel",
      category: "Contrat",
      expiry: "2026-09-20",
      status: "Valide",
      fileId: "f",
      fileName: "assurance.pdf",
      fileType: "application/pdf",
      fileSize: 2048,
    },
    { id: "b", title: "Diplôme", status: "À traiter", expiry: "2026-01-01" },
    { id: "c", title: "Retiré", deleted: true, expiry: "2026-09-15" },
  ];
  assert.equal(Q.Vault.search(s, "credit").length, 1);
  assert.equal(Q.Vault.search(s, "", "Valide").length, 1);
  const stats = Q.Vault.stats(s, "2026-09-11");
  assert.equal(stats.total, 2);
  assert.equal(stats.attached, 1);
  assert.equal(stats.soon, 1);
  assert.equal(stats.expired, 1);
});
test("vault validates expiry, status, size and project links without losing unknown metadata", () => {
  const s = Q.empty();
  s.os = [
    {
      id: "p",
      kind: "project",
      title: "Maison",
      status: "En cours",
      budget: 1,
      spent: 0,
    },
  ];
  s.documents = [
    {
      id: "d",
      title: "Acte",
      status: "À renouveler",
      expiry: "2026-10-01",
      projectId: "p",
      custom: { ocr: "pending" },
    },
  ];
  const next = Q.normalize(s);
  assert.equal(next.documents[0].custom.ocr, "pending");
  assert.ok(Q.Personal.graph(next).some((x) => x.label === "Projet documenté"));
  s.documents[0].expiry = "2026-02-31";
  assert.throws(() => Q.normalize(s), /expiration/);
  s.documents[0].expiry = "2026-10-01";
  s.documents[0].fileSize = 30 * 1024 * 1024;
  assert.throws(() => Q.normalize(s), /Taille/);
});
