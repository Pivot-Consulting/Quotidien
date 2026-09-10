const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const release = require("../package.json").version;
fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist/assets", { recursive: true });
let html = fs.readFileSync("index.html", "utf8");
for (const [source, name] of [
  [".build/core.js", "core.js"],
  ["app.js", "app.js"],
  ["app.css", "app.css"],
]) {
  const content =
    source === ".build/core.js"
      ? Buffer.from(
          require("./sources.cjs")
            .core.map((p) => fs.readFileSync(p, "utf8"))
            .join("\n"),
        )
      : source === "app.js"
        ? Buffer.from(
            require("./sources.cjs")
              .ui.map((p) => fs.readFileSync(p, "utf8"))
              .join("\n"),
          )
        : fs.readFileSync(source);
  const hash = crypto
    .createHash("sha256")
    .update(content)
    .digest("hex")
    .slice(0, 12);
  const file = name.replace(/\.(js|css)$/, `.${hash}.$1`);
  fs.writeFileSync(`dist/assets/${file}`, content);
  html = html.replace(`./${name}`, `./assets/${file}`);
}
for (const name of ["index.html", "404.html"])
  fs.writeFileSync(`dist/${name}`, html);
fs.cpSync("public", "dist", { recursive: true });
fs.writeFileSync("dist/.nojekyll", "");
fs.writeFileSync(
  "dist/version.json",
  JSON.stringify({
    release,
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
  }),
);
console.log(
  `Quotidien ${release} — dist/ prêt, ressources à empreinte de contenu.`,
);
