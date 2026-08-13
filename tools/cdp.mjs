/* Shared headless-Chrome harness for the two browser suites.

   Two CDP gotchas, both guarded here: filter targets to type === "page" or you
   attach to an extension background page and measure an empty document; and run
   width checks with mobile emulation OFF, or Chrome widens the layout viewport
   to fit overflow and the assertion passes on a page that visibly overflows. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SHOTS = join(ROOT, "tools", "shots");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
].find(existsSync);

export class Client {
  constructor(ws) { this.ws = ws; this.id = 0; this.waits = new Map(); this.logs = []; this.failed = []; }
  static async open(url) {
    const ws = new WebSocket(url);
    const c = new Client(ws);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.waits.has(m.id)) {
        const { res, rej } = c.waits.get(m.id);
        c.waits.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
        c.logs.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
      if (m.method === "Runtime.exceptionThrown")
        c.logs.push(m.params.exceptionDetails.text + " " +
                    (m.params.exceptionDetails.exception?.description || ""));
      if (m.method === "Network.loadingFailed")
        c.failed.push((m.params.errorText || "failed") + " " + (c.lastUrl || ""));
      if (m.method === "Network.responseReceived" && m.params.response.status >= 400)
        c.failed.push(m.params.response.status + " " + m.params.response.url);
    };
    await c.send("Runtime.enable");
    await c.send("Network.enable");
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.waits.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " + expression.slice(0, 90));
    return r.result.value;
  }
  async go(url, { width = 1280, height = 900, settle = 600 } = {}) {
    /* mobile:false is deliberate — see the header note */
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    this.logs = []; this.failed = []; this.lastUrl = url;
    await this.send("Page.navigate", { url });
    await sleep(settle);
  }
  async shot(name) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(SHOTS, name + ".png"), Buffer.from(r.data, "base64"));
  }
}

/* Starts the static server and Chrome, hands back a connected client and the
   teardown the caller must run in a finally block. */
export async function launch({ port, debugPort, profile }) {
  if (!CHROME) { console.error("Chrome not found"); process.exit(1); }
  mkdirSync(SHOTS, { recursive: true });
  const server = spawn(process.execPath, [join(ROOT, "tools", "serve.js"), String(port)], { stdio: "ignore" });
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    /* Without this the fetch-to-blob audio player never advances and a
       listening page looks like a real failure. */
    "--autoplay-policy=no-user-gesture-required",
    "--user-data-dir=" + join(ROOT, "tools", profile),
    "--remote-debugging-port=" + debugPort, "about:blank"
  ], { stdio: "ignore" });

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = list.find((t) => t.type === "page");   /* must be "page" */
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) { chrome.kill(); server.kill(); throw new Error("no CDP page target"); }

  await sleep(400);
  const c = await Client.open(wsUrl);
  await c.send("Page.enable");
  return { c, base: "http://localhost:" + port, stop: () => { chrome.kill(); server.kill(); } };
}
