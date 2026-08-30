#!/usr/bin/env node
/**
 * MCP test-plan harness: Section A (cross-cutting invariants).
 *
 * Runs the checks the plan applies to every registered tool - protocol
 * compliance (A1) and input validation (A2.1 to A2.6) - so coverage does not
 * depend on anyone hand-running 155 tools six times each.
 *
 * Side-effecting tools are exercised here too, but only with arguments that
 * must be rejected. That is safe because arguments are validated at dispatch,
 * before a handler runs: a rejected call cannot reach the code that writes,
 * deletes or restores anything. They are never called with valid arguments -
 * that needs fixtures, not a harness.
 *
 * A tool that ignores its schema would defeat that reasoning, which is exactly
 * what A2 exists to find, and every call is bounded so one cannot run away.
 *
 * Usage: node scripts/test-harness-mcp.cjs [--section=a1|a2|all]
 */

require("dotenv").config();

const SECTION = (process.argv.find((a) => a.startsWith("--section=")) || "--section=all").split("=")[1];

/**
 * Tools that change state, move data, or start expensive work.
 *
 * They are still exercised with invalid input; this list marks which results to
 * read as "rejected before it could do anything" rather than as a clean run.
 */
const SIDE_EFFECTING = [
  "backup", "restore", "import-database", "export-database", "config-update",
  "config-reset", "config-export", "health-check-and-fix", "clear-", "mcp-load-tool",
  "mcp-unload-tool", "mcp-switch-profile", "run-load-test", "run-performance-test",
  "generate-tests-directory", "format-code", "migrate-trinity-api", "trigger-",
  "marketplace-", "extract",
];

const isSideEffecting = (name) => SIDE_EFFECTING.some((frag) => name.includes(frag));

/**
 * Tools that must never be called with arguments that could satisfy them.
 *
 * A2.2, A2.5 and A2.6 supply valid values for the required parameters so that
 * only the parameter under test is wrong. For these tools that is enough to
 * start real work - a minimap call with a plausible map id extracts a ~199 MB
 * CASC file, and a backup call with plausible arguments takes a backup - so
 * they get A2.1 only, where every required parameter is missing and the call
 * cannot proceed.
 */
const NEVER_CALL_WITH_VALID_ARGS = (name) =>
  isSideEffecting(name) ||
  /minimap|casc|vmap|mmap|wdt|load-test|scaffold|review-code/.test(name) ||
  // A full health check walks every table; it is correct but slow, and the
  // harness would read its runtime as a missing validation.
  /health-check-full|health-check-quick|analyze-coverage|run-tests/.test(name) ||
  // Generators write files named after their arguments; calling them with
  // satisfiable input left "x.integration.test.ts" and one named after an
  // injection string in the repository.
  /generate-tests|generate-.*component|generate-scaffold|docs-gen/.test(name);

/** How long a single call may run before it is judged unvalidated. */
const CALL_TIMEOUT_MS = 15000;

const results = [];
const record = (id, tool, status, detail) => results.push({ id, tool, status, detail: detail || "" });

/** Call a handler, bounded, reporting how it answered. */
async function attempt(handler, args) {
  try {
    const res = await Promise.race([
      handler(args),
      new Promise((_, rej) => setTimeout(() => rej(new Error("__TIMEOUT__")), CALL_TIMEOUT_MS)),
    ]);
    return { threw: false, text: JSON.stringify(res) };
  } catch (e) {
    const message = String((e && e.message) || e);
    return { threw: true, timedOut: message.includes("__TIMEOUT__"), text: message };
  }
}

const REJECTED = /invalid|required|not provided|must be|expected|missing|error|needs/i;

/** A value of the wrong type for a declared schema type. */
function wrongTypeFor(type) {
  const t = Array.isArray(type) ? type[0] : type;
  switch (t) {
    case "number":
    case "integer":
      return "not-a-number";
    case "string":
      return 12345;
    case "boolean":
      return "yes";
    case "array":
      return { notAn: "array" };
    case "object":
      return ["not", "an", "object"];
    default:
      return null;
  }
}

/** A plausible in-range value, used to isolate the parameter under test. */
function validFor(type) {
  const t = Array.isArray(type) ? type[0] : type;
  switch (t) {
    case "number":
    case "integer":
      return 1;
    case "string":
      return "x";
    case "boolean":
      return true;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return 1;
  }
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
  const handlers = registry.handlerMap;

  // ---------------------------------------------------------------- A1 -----
  if (SECTION === "a1" || SECTION === "all") {
    const names = defs.map((d) => d.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    record("A1.1", "(all)", dupes.length === 0 ? "PASS" : "FAIL",
      `${defs.length} definitions, ${new Set(names).size} unique`);

    for (const d of defs) {
      record("A1.2", d.name, d.description && d.description.trim() ? "PASS" : "FAIL", "");
      const schema = d.inputSchema;
      const ok = schema && schema.type === "object" && typeof schema.properties === "object";
      record("A1.3", d.name, ok ? "PASS" : "FAIL", ok ? "" : "malformed inputSchema");
      const props = Object.keys((schema && schema.properties) || {});
      const orphans = ((schema && schema.required) || []).filter((r) => !props.includes(r));
      record("A1.4", d.name, orphans.length === 0 ? "PASS" : "FAIL",
        orphans.length ? `required not in properties: ${orphans}` : "");
    }
  }

  // ---------------------------------------------------------------- A2 -----
  if (SECTION === "a2" || SECTION === "all") {
    for (const d of defs) {
      const handler = handlers.get(d.name);
      if (!handler) {
        record("A2", d.name, "BLOCKED", "no handler resolved");
        continue;
      }

      process.stderr.write(`[harness] ${d.name}
`);

      const schema = d.inputSchema || {};
      const properties = schema.properties || {};
      const required = schema.required || [];
      const note = isSideEffecting(d.name) ? "side-effecting; rejected before running" : "";

      // A2.1 - omit every required parameter.
      if (required.length === 0) {
        record("A2.1", d.name, "N/A", "no required parameters");
      } else {
        const r = await attempt(handler, {});
        if (r.timedOut) {
          record("A2.1", d.name, "FAIL", "no validation: still running after 15s on empty input");
        } else if (r.threw || REJECTED.test(r.text)) {
          record("A2.1", d.name, "PASS", note);
        } else {
          record("A2.1", d.name, "FAIL", `accepted empty args: ${r.text.slice(0, 80)}`);
        }
      }

      const unsafeToSatisfy = NEVER_CALL_WITH_VALID_ARGS(d.name);
      if (unsafeToSatisfy) {
        record("A2.2", d.name, "N/A", "not called with satisfiable arguments; A2.1 covers it");
        record("A2.5", d.name, "N/A", "not called with satisfiable arguments");
        record("A2.6", d.name, "N/A", "not called with satisfiable arguments");
        continue;
      }

      // A2.2 - wrong type for each declared parameter, one at a time.
      let typeChecked = 0;
      const typeFailures = [];
      for (const [name, prop] of Object.entries(properties)) {
        const bad = wrongTypeFor(prop.type);
        if (bad === null) continue;
        const args = {};
        for (const req of required) args[req] = validFor((properties[req] || {}).type);
        args[name] = bad;
        const r = await attempt(handler, args);
        typeChecked++;
        if (!r.threw && !REJECTED.test(r.text)) typeFailures.push(name);
      }
      record("A2.2", d.name, typeFailures.length === 0 ? "PASS" : "FAIL",
        typeFailures.length
          ? `wrong type accepted for: ${typeFailures.join(", ")}`
          : `${typeChecked} parameters checked`);

      // A2.5 - an undeclared extra parameter must not break the call.
      if (required.length > 0) {
        const args = {};
        for (const req of required) args[req] = validFor((properties[req] || {}).type);
        args.__unexpected_extra__ = "ignored";
        const r = await attempt(handler, args);
        record("A2.5", d.name, r.timedOut ? "FAIL" : "PASS",
          r.timedOut ? "hung on an extra parameter" : note);
      } else {
        record("A2.5", d.name, "N/A", "no required parameters to accompany the extra");
      }

      // A2.6 - an injection-shaped string must not produce a SQL error.
      const stringParams = Object.entries(properties).filter(
        ([, p]) => p.type === "string" || (Array.isArray(p.type) && p.type.includes("string"))
      );
      if (stringParams.length === 0) {
        record("A2.6", d.name, "N/A", "no string parameters");
      } else {
        const args = {};
        for (const req of required) args[req] = validFor((properties[req] || {}).type);
        args[stringParams[0][0]] = "'; DROP TABLE test; --";
        const r = await attempt(handler, args);
        const sqlLeak = /SQL syntax|ER_PARSE_ERROR|ER_BAD|sqlMessage/i.test(r.text);
        record("A2.6", d.name, sqlLeak ? "FAIL" : "PASS",
          sqlLeak ? `SQL error surfaced: ${r.text.slice(0, 90)}` : note);
      }
    }
  }

  // -------------------------------------------------------------- report ---
  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  process.stdout.write("\n=== SUMMARY ===\n");
  for (const [status, count] of Object.entries(byStatus).sort()) {
    process.stdout.write(`${status.padEnd(12)} ${count}\n`);
  }

  const byId = {};
  for (const r of results) {
    byId[r.id] = byId[r.id] || { PASS: 0, FAIL: 0, "N/A": 0, BLOCKED: 0 };
    byId[r.id][r.status] = (byId[r.id][r.status] || 0) + 1;
  }
  process.stdout.write("\n=== BY CHECK ===\n");
  for (const [id, counts] of Object.entries(byId).sort()) {
    process.stdout.write(
      `${id.padEnd(6)} PASS ${String(counts.PASS).padStart(4)}  FAIL ${String(counts.FAIL).padStart(3)}  N/A ${String(counts["N/A"]).padStart(4)}\n`
    );
  }

  const bad = results.filter((r) => r.status === "FAIL" || r.status === "BLOCKED");
  if (bad.length) {
    process.stdout.write(`\n=== ${bad.length} FAIL / BLOCKED ===\n`);
    for (const r of bad.slice(0, 50)) {
      process.stdout.write(`${r.id} ${r.tool}: ${r.status} - ${r.detail}\n`);
    }
    if (bad.length > 50) process.stdout.write(`... and ${bad.length - 50} more\n`);
  }

  require("fs").writeFileSync("test-results-mcp-sectionA.json", JSON.stringify(results, null, 2));
  process.stdout.write("\nfull results: test-results-mcp-sectionA.json\n");
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write("harness error: " + (e && e.stack) + "\n");
  process.exit(1);
});
