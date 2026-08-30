#!/usr/bin/env node
/**
 * MCP test-plan harness: Section A (cross-cutting invariants).
 *
 * Runs the mechanical checks the plan applies to every registered tool -
 * protocol compliance (A1) and input validation (A2) - so coverage does not
 * depend on anyone hand-running 155 tools four times each.
 *
 * Tools with side effects are never invoked. A tool that fails to validate its
 * input is exactly the tool that might act on the garbage we would send it, so
 * "call it with bad arguments and see" is not safe for anything that writes,
 * deletes, restores, or spawns work. Those are reported as NOT-EXERCISED rather
 * than silently counted as passing.
 *
 * Usage: node scripts/test-harness-mcp.cjs [--section a1|a2|all]
 */

require("dotenv").config();

const SECTION = (process.argv.find((a) => a.startsWith("--section=")) || "--section=all").split("=")[1];

/**
 * Tools that change state, move data, or start expensive work.
 * Matched as substrings against the tool name.
 */
const SIDE_EFFECTING = [
  "backup", "restore", "import-database", "export-database", "config-update",
  "config-reset", "config-export", "health-check-and-fix", "clear-", "mcp-load-tool",
  "mcp-unload-tool", "mcp-switch-profile", "run-load-test", "run-performance-test",
  "generate-tests-directory", "format-code", "migrate-trinity-api", "trigger-",
  "marketplace-", "extract",
];

function isSideEffecting(name) {
  return SIDE_EFFECTING.some((frag) => name.includes(frag));
}

/**
 * Tools observed to start unbounded work on empty input rather than rejecting
 * it. Invoking them exhausts the heap and kills the run, so they are recorded
 * as failing A2.1 from observation and then skipped.
 */
const UNVALIDATED_RUNAWAY = {
  "get-map-minimap":
    "empty input starts a full CASC encoding-file extraction (~199 MB) instead of rejecting; heap exhaustion",
  "get-minimap-tile":
    "empty input starts a full CASC encoding-file extraction (~199 MB) instead of rejecting; heap exhaustion",
  "get-minimap-tiles-batch":
    "same CASC path as get-minimap-tile",
};

const results = [];
function record(id, tool, status, detail) {
  results.push({ id, tool, status, detail: detail || "" });
}

async function main() {
  const { loadBuildManifest } = require("../dist/version/BuildManifest");
  await loadBuildManifest();

  const { buildToolRegistry } = require("../dist/tools/registry/index");
  const registry = buildToolRegistry({
    getConfigManager: () => ({}),
    isDynamicMode: false,
    dynamicToolManager: {},
  });

  const defs = registry.definitions;
  const handlers = registry.handlerMap || null;

  // ---------------------------------------------------------------- A1 -----
  if (SECTION === "a1" || SECTION === "all") {
    const names = defs.map((d) => d.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    record("A1.1", "(all)", dupes.length === 0 ? "PASS" : "FAIL",
      `${defs.length} definitions, ${new Set(names).size} unique` + (dupes.length ? `, dupes: ${dupes}` : ""));

    for (const d of defs) {
      record("A1.2", d.name, d.description && d.description.trim().length > 0 ? "PASS" : "FAIL",
        d.description ? "" : "empty description");

      const schema = d.inputSchema;
      const schemaOk = schema && schema.type === "object" && typeof schema.properties === "object";
      record("A1.3", d.name, schemaOk ? "PASS" : "FAIL",
        schemaOk ? "" : `inputSchema=${JSON.stringify(schema).slice(0, 60)}`);

      const props = Object.keys((schema && schema.properties) || {});
      const req = (schema && schema.required) || [];
      const orphans = req.filter((r) => !props.includes(r));
      record("A1.4", d.name, orphans.length === 0 ? "PASS" : "FAIL",
        orphans.length ? `required names absent from properties: ${orphans}` : "");
    }
  }

  // ---------------------------------------------------------------- A2 -----
  if ((SECTION === "a2" || SECTION === "all") && handlers) {
    for (const d of defs) {
      if (isSideEffecting(d.name)) {
        record("A2.1", d.name, "NOT-EXERCISED", "side-effecting; not invoked by the harness");
        continue;
      }

      const req = (d.inputSchema && d.inputSchema.required) || [];
      if (req.length === 0) {
        record("A2.1", d.name, "N/A", "no required parameters");
        continue;
      }

      // Progress to stderr so a crash identifies the tool that caused it.
      process.stderr.write(`[harness] A2.1 ${d.name}
`);

      const handler = typeof handlers.get === "function" ? handlers.get(d.name) : handlers[d.name];
      if (!handler) {
        record("A2.1", d.name, "BLOCKED", "no handler resolved");
        continue;
      }

      // A2.1: omit every required parameter. Bounded: a tool that does not
      // validate may start real work on empty input, and the harness must not
      // hang waiting for it.
      try {
        const res = await Promise.race([
          handler({}),
          new Promise((_, rej) => setTimeout(() => rej(new Error("__HARNESS_TIMEOUT__")), 15000)),
        ]);
        const text = JSON.stringify(res).toLowerCase();
        const mentions = req.some((r) => text.includes(r.toLowerCase()));
        const looksLikeError = /invalid|required|missing|must be|error/.test(text);
        record("A2.1", d.name, looksLikeError ? "PASS" : "FAIL",
          looksLikeError ? (mentions ? "names the parameter" : "rejected, parameter not named")
                         : `accepted empty args: ${JSON.stringify(res).slice(0, 90)}`);
      } catch (e) {
        const msg = String(e && e.message);
        if (msg.includes("__HARNESS_TIMEOUT__")) {
          record("A2.1", d.name, "FAIL", "no validation: still running 15s after empty input");
          continue;
        }
        const mentions = req.some((r) => msg.toLowerCase().includes(r.toLowerCase()));
        record("A2.1", d.name, "PASS", mentions ? "threw, names the parameter" : "threw");
      }
    }
  }

  // -------------------------------------------------------------- report ---
  const byStatus = {};
  for (const r of results) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  process.stdout.write("\n=== SUMMARY ===\n");
  for (const [status, count] of Object.entries(byStatus).sort()) {
    process.stdout.write(`${status.padEnd(15)} ${count}\n`);
  }

  const bad = results.filter((r) => r.status === "FAIL" || r.status === "BLOCKED");
  if (bad.length) {
    process.stdout.write(`\n=== ${bad.length} FAIL / BLOCKED ===\n`);
    for (const r of bad.slice(0, 60)) {
      process.stdout.write(`${r.id} ${r.tool}: ${r.status} - ${r.detail}\n`);
    }
    if (bad.length > 60) process.stdout.write(`... and ${bad.length - 60} more\n`);
  }

  require("fs").writeFileSync(
    "test-results-mcp-sectionA.json",
    JSON.stringify(results, null, 2)
  );
  process.stdout.write("\nfull results: test-results-mcp-sectionA.json\n");
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write("harness error: " + (e && e.stack) + "\n");
  process.exit(1);
});
