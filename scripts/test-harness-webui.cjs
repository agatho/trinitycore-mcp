#!/usr/bin/env node
/**
 * Web UI test-plan harness: page and API sweep.
 *
 * Requests every page route and every API route the application declares, and
 * reports how each answered. This is the coverage the plan's Section A asks for
 * across all 41 pages - a browser can then be pointed at whatever this finds,
 * rather than at all of them one by one.
 *
 * What it can see: HTTP status, server-rendered error markers, and whether a
 * page returned an application shell at all. What it cannot: client-side
 * rendering, dark mode, keyboard traps. Those still need a browser, and the
 * plan says so.
 *
 * Routes that change state are requested with GET only; none of the POST-only
 * endpoints are invoked.
 *
 * Usage: node scripts/test-harness-webui.cjs [--base=http://localhost:3000]
 */

const fs = require("fs");
const path = require("path");

const BASE =
  (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").split("=").slice(1).join("=");

const ROOT = path.join(__dirname, "..");
const APP_DIR = path.join(ROOT, "web-ui", "app");

/** Sample ids for dynamic segments, chosen because they are known to exist. */
const SEGMENT_SAMPLES = {
  itemId: "25",
  spellId: "133",
  creatureId: "299",
  mapId: "0",
  fileDataId: "1",
  method: "GetName",
  filename: "0000.vmtree",
};

/** Walk the app directory for route files, returning URL paths. */
function discoverRoutes(kind) {
  const target = kind === "page" ? "page.tsx" : "route.ts";
  const found = [];

  const walk = (dir, urlPath) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_") || entry.name === "node_modules") continue;
        walk(path.join(dir, entry.name), `${urlPath}/${entry.name}`);
      } else if (entry.name === target) {
        found.push(urlPath || "/");
      }
    }
  };

  walk(APP_DIR, "");
  return found.filter((r) => (kind === "page" ? !r.startsWith("/api") : r.startsWith("/api")));
}

/** Replace [param] segments with a sample value, or null when none is known. */
function fillSegments(route) {
  const missing = [];
  const filled = route.replace(/\[([^\]]+)\]/g, (_, name) => {
    const key = name.replace(/^\.\.\./, "");
    const sample = SEGMENT_SAMPLES[key];
    if (!sample) missing.push(key);
    return sample || `__${key}__`;
  });
  return { filled, missing };
}

async function request(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
    const body = await res.text();
    return { status: res.status, ms: Date.now() - started, body };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, body: String((e && e.message) || e) };
  }
}

/**
 * Markers that mean the server rendered a failure rather than a page.
 *
 * Deliberately excludes Next's "This page could not be found" text: the app is
 * client-rendered, so that string ships inside the HTML shell of every page and
 * matching on it reported all 41 pages as missing. A genuinely absent route
 * answers with HTTP 404, which the status check already catches.
 */
const ERROR_MARKERS = [
  "Application error: a client-side exception",
  "Internal Server Error",
  "Unhandled Runtime Error",
];

async function main() {
  const pages = discoverRoutes("page").sort();
  const apis = discoverRoutes("api").sort();

  process.stdout.write(`Base: ${BASE}\nPages: ${pages.length}   API routes: ${apis.length}\n`);

  const results = [];

  process.stdout.write("\n=== PAGES ===\n");
  for (const route of pages) {
    const { filled, missing } = fillSegments(route);
    if (missing.length) {
      results.push({ kind: "page", route, status: "SKIP", detail: `no sample for [${missing.join(",")}]` });
      process.stdout.write(`SKIP  ${route.padEnd(34)} no sample id\n`);
      continue;
    }
    const r = await request(BASE + filled);
    const marker = ERROR_MARKERS.find((m) => r.body.includes(m));
    const ok = r.status === 200 && !marker;
    results.push({
      kind: "page", route: filled, status: ok ? "PASS" : "FAIL",
      detail: marker || `HTTP ${r.status}`, ms: r.ms,
    });
    process.stdout.write(
      `${ok ? "PASS" : "FAIL"}  ${filled.padEnd(34)} HTTP ${String(r.status).padEnd(4)} ${String(r.ms).padStart(6)}ms${marker ? "  " + marker : ""}\n`
    );
  }

  process.stdout.write("\n=== API ROUTES (GET) ===\n");
  for (const route of apis) {
    const { filled, missing } = fillSegments(route);
    if (missing.length) {
      results.push({ kind: "api", route, status: "SKIP", detail: `no sample for [${missing.join(",")}]` });
      process.stdout.write(`SKIP  ${route.padEnd(34)} no sample id\n`);
      continue;
    }
    const r = await request(BASE + filled);
    // A GET-only sweep will meet POST-only endpoints; 405 is the correct answer
    // there, and 400 is correct for one that needs parameters.
    const ok = [200, 400, 404, 405].includes(r.status);
    results.push({
      kind: "api", route: filled, status: ok ? "PASS" : "FAIL",
      detail: `HTTP ${r.status}`, ms: r.ms,
    });
    process.stdout.write(
      `${ok ? "PASS" : "FAIL"}  ${filled.padEnd(34)} HTTP ${String(r.status).padEnd(4)} ${String(r.ms).padStart(6)}ms\n`
    );
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  process.stdout.write(`\nPASS ${pass}   FAIL ${fail}   SKIP ${skip}\n`);

  if (fail) {
    process.stdout.write("\n=== FAILURES ===\n");
    for (const r of results.filter((x) => x.status === "FAIL")) {
      process.stdout.write(`${r.kind} ${r.route}: ${r.detail}\n`);
    }
  }

  fs.writeFileSync("test-results-webui-sweep.json", JSON.stringify(results, null, 2));
  process.stdout.write("\nfull results: test-results-webui-sweep.json\n");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write("harness error: " + (e && e.stack) + "\n");
  process.exit(1);
});
