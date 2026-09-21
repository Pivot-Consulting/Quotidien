// Browser regression gate using the Chrome available on the GitHub Ubuntu runner.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "quotidien-browser-"));
const server = spawn(process.execPath, ["scripts/serve.cjs", "--port", "4173"]);
const chrome = spawn(process.env.CHROME_BIN || "google-chrome", [
  "--headless",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--remote-debugging-port=9222",
  `--user-data-dir=${profile}`,
  "about:blank",
]);
let processError;
chrome.on("error", (error) => {
  processError = error;
});
server.on("error", (error) => {
  processError = error;
});
chrome.stderr.on("data", () => {});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function ready(url) {
  for (let n = 0; n < 100; n++) {
    if (processError) throw processError;
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {}
    await pause(100);
  }
  throw Error(`Unavailable: ${url}`);
}
let socket;
(async () => {
  await ready("http://localhost:4173/");
  const targets = await (await ready("http://localhost:9222/json/list")).json();
  socket = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data),
      item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(Error(`Timeout: ${method}`));
      }, 15000);
      pending.set(key, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  }
  async function evaluate(expression) {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  fs.mkdirSync("browser-artifacts", { recursive: true });
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.origin === 'http://localhost:4173' && !localStorage.getItem('quotidien-rebuild-2')) {
      const date = new Date().toISOString().slice(0,10);
      localStorage.setItem('quotidien-rebuild-2', JSON.stringify({version:2,
        tasks:[{id:'qa-task',title:'Préparer la prochaine formation',due:date,priority:'Haute'}],
        events:[{id:'qa-event',title:'Séance de tennis',date,time:'18:00'}],
        habits:[{id:'qa-habit',name:'Lire 10 minutes',days:{}}]
      }));
    }`,
  });
  for (const width of [320, 390, 768, 1280]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url: "http://localhost:4173/#today" });
    for (let n = 0; n < 100; n++) {
      if (
        await evaluate(
          'Boolean(window.Q && document.querySelector(".today-layout"))',
        )
      )
        break;
      await pause(100);
    }
    await evaluate("Q.ready");
    assert.ok(
      await evaluate(
        'document.body.textContent.includes("Préparer la prochaine formation")',
      ),
      "Seeded task must render before measuring layouts",
    );
    const routes = await evaluate(
      'Q.screens.concat(Q.OS.domains.map(d => "life/" + d.id))',
    );
    for (const route of routes) {
      await evaluate(`location.hash = ${JSON.stringify(route)}`);
      await pause(80);
      const metrics = await evaluate(
        `({width: innerWidth, scroll: document.documentElement.scrollWidth, main: !!document.querySelector('main'), errors: [...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})`,
      );
      assert.ok(metrics.main, route);
      assert.ok(
        metrics.scroll <= metrics.width + 1,
        `${width}px #${route}: overflow ${JSON.stringify(metrics)}`,
      );
      assert.equal(metrics.errors.length, 0, `${route}: ${metrics.errors}`);
    }
    await evaluate('location.hash="today"');
    await pause(100);
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      `browser-artifacts/atelier-${width}.png`,
      Buffer.from(screenshot.data, "base64"),
    );
    await evaluate('document.querySelector("[data-action=quick]").click()');
    assert.equal(await evaluate('!!document.querySelector(".modal")'), true);
    assert.ok(
      await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
    );
    await evaluate(
      'document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}))',
    );
    console.log(
      `${width}px: ${routes.length} routes and quick capture verified`,
    );
  }
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    socket?.close();
    chrome.kill();
    server.kill();
    // Chrome owns its temporary profile until process exit; never touch user profiles.
  });
