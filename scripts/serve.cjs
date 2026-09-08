const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".json": "application/json",
};
http
  .createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (url === "/__qa/mobile") {
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end(
          '<title>Quotidien · test 390 × 844</title><style>body{margin:0;background:#ddd}iframe{display:block;width:390px;height:844px;border:0;margin:16px auto}</style><iframe title="Quotidien mobile" src="/index.html"></iframe>',
        );
      return;
    }
    const file = path.resolve(root, "." + (url === "/" ? "/index.html" : url));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, {
          "Content-Type":
            types[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store",
        })
        .end(data);
    });
  })
  .listen(
    Number(
      process.env.PORT ||
        (process.argv.includes("--port")
          ? process.argv[process.argv.indexOf("--port") + 1]
          : 4173) ||
        4173,
    ),
    "0.0.0.0",
    () => console.log("Quotidien : http://localhost:8001"),
  );
