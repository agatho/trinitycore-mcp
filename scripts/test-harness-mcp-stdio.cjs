#!/usr/bin/env node
/**
 * MCP test-plan harness: Section A4 (stdout hygiene).
 *
 * Starts the server the way a client does - as a child speaking JSON-RPC over
 * stdio - and asserts that stdout carries protocol traffic and nothing else. A
 * single log line there corrupts the client's message stream, so this is tested
 * against the real transport rather than by reading the logging code.
 *
 * Usage: node scripts/test-harness-mcp-stdio.cjs
 */

const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/** Requests to send after initialisation, chosen to exercise varied subsystems. */
const CALLS = [
  { name: "list-builds", args: {} },
  { name: "get-spell-info", args: { spellId: 133 } },
  { name: "get-item-info", args: { itemId: 25 } },
  { name: "list-gametables", args: {} },
  { name: "get-opcode-info", args: { opcode: "CMSG_MOVE_JUMP" } },
  { name: "validate-build-schemas", args: {} },
  { name: "list-vmap-files", args: {} },
  { name: "list-mmap-files", args: {} },
  // Exercises the CASC layer, which logs with console.log.
  { name: "get-minimap-tile", args: { mapName: "Azeroth", tileX: 32, tileY: 32 } },
];

function main() {
  const child = spawn(process.execPath, [path.join(ROOT, "dist", "index.js")], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
  child.stderr.on("data", (c) => (stderr += c.toString("utf8")));

  const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");

  let id = 1;
  send({
    jsonrpc: "2.0", id: id++, method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-harness", version: "1.0" },
    },
  });

  setTimeout(() => {
    send({ jsonrpc: "2.0", id: id++, method: "tools/list", params: {} });
    for (const c of CALLS) {
      send({
        jsonrpc: "2.0", id: id++, method: "tools/call",
        params: { name: c.name, arguments: c.args },
      });
    }
  }, 2500);

  setTimeout(() => {
    child.kill();

    const lines = stdout.split("\n").filter((l) => l.trim());
    const nonJson = [];
    let responses = 0;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.jsonrpc === "2.0") responses++;
        else nonJson.push(line);
      } catch {
        nonJson.push(line);
      }
    }

    const out = [];
    out.push("=== A4 STDOUT HYGIENE ===");
    out.push(`stdout bytes           : ${stdout.length}`);
    out.push(`stdout lines           : ${lines.length}`);
    out.push(`JSON-RPC responses     : ${responses}`);
    out.push(`non-protocol lines     : ${nonJson.length}`);
    out.push(`stderr bytes (expected): ${stderr.length}`);
    out.push("");
    out.push(`A4.1 startup stdout clean : ${responses > 0 || lines.length === 0 ? "see A4.2" : "?"}`);
    out.push(`A4.2 no stray stdout      : ${nonJson.length === 0 ? "PASS" : "FAIL"}`);
    if (nonJson.length) {
      out.push("  first stray lines:");
      for (const l of nonJson.slice(0, 8)) out.push("    " + l.slice(0, 120));
    }
    out.push(`A4.3 responses received   : ${responses > 0 ? "PASS (" + responses + ")" : "FAIL (none)"}`);

    process.stdout.write(out.join("\n") + "\n");
    process.exit(nonJson.length === 0 && responses > 0 ? 0 : 1);
  }, 25000);
}

main();
