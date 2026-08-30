# Web UI Test Plan

**Scope:** the Next.js application in `web-ui/` — 41 pages and 37 API routes — and the boundary where it gets its data: the MCP server it spawns, the MySQL databases it queries, and the build manifest that decides which client build's files it reads.

**Purpose:** the same two questions the MCP plan asks, in a different setting.

1. **Does the page work?** It renders, handles loading, empty and error states, and does not break on small screens or in dark mode.
2. **Is the data correct?** What it shows matches the MCP server and the databases underneath — and both agree about which client build they are describing.

The second question is the one that bites. A page that renders beautifully while showing an archived build's item levels looks healthy from every angle except the only one that matters.

**Version:** written against active build `12.1.0.69497` (Midnight).

---

## 0. How to run

```bash
cd web-ui
npm run dev            # development server on :3000
npx vitest run         # unit suites (320 tests at time of writing)
npx tsc --noEmit       # type check
```

Record results per test ID as **PASS**, **FAIL**, or **BLOCKED**. For UI tests, a FAIL should include a screenshot or the exact rendered text; for API tests, the response body.

Run the API contract tests (§3) before the page tests (§4): a page failure caused by a broken route is a duplicate finding, not a new one.

---

## 1. Preconditions (P)

| ID | Check | Expected |
|----|-------|----------|
| P1 | `npx tsc --noEmit` | no errors outside `__tests__/` (15 pre-existing test-file errors are known and out of scope) |
| P2 | `npx vitest run` | all suites pass |
| P3 | Dev server starts | ready, no unhandled errors in the console |
| P4 | `/api/health` | reports healthy |
| P5 | `/api/build-info` | `available: true`, active build `12.1.0.69497`, `missingPaths` empty |
| P6 | MCP server reachable | `/api/mcp/tools` lists 155 tools |
| P7 | Databases reachable | `/api/schema` returns tables |

**P5 is new and load-bearing.** The web UI spawns its own MCP child process; if it reads a different build than the server you tested by hand, every data comparison below is meaningless.

---

## 2. Section A — Cross-cutting (every page)

Run these against each of the 41 pages. Automate what you can; the state tests especially are easy to skip by hand and are where regressions hide.

### A1. Rendering states

| ID | Test | Pass criteria |
|----|------|---------------|
| A1.1 | Initial load | renders without a client-side exception |
| A1.2 | Loading state | a visible indicator while data is in flight — not a blank page |
| A1.3 | Empty state | a message explaining *why* it is empty, not a bare empty table |
| A1.4 | Error state | the failure is shown and actionable; never a silent blank |
| A1.5 | Slow response (throttle to 3G) | loading state persists; no flash of "no results" |
| A1.6 | Navigate away mid-load | no state update on an unmounted component, no console warning |

**A1.3 vs A1.4 is the distinction to enforce.** "No results for this filter" and "the server did not answer" must not look identical.

### A2. Presentation

| ID | Test | Pass criteria |
|----|------|---------------|
| A2.1 | Dark mode | readable; no white-on-white or black-on-black |
| A2.2 | Responsive at 375 px | no horizontal page scroll; tables scroll inside their own container |
| A2.3 | Responsive at 1920 px | content does not stretch to unreadable line lengths |
| A2.4 | Long values (a 200-character item name) | wraps or truncates; does not break the layout |
| A2.5 | Keyboard navigation | every interactive control reachable by Tab, with a visible focus ring |
| A2.6 | Screen-reader labels | inputs and buttons have accessible names (WCAG 2.1 AA) |

### A3. Security

| ID | Test | Pass criteria |
|----|------|---------------|
| A3.1 | View page source and client bundles | no database passwords, no absolute filesystem paths beyond what the settings page intends |
| A3.2 | Inject `<script>alert(1)</script>` into any text input | rendered as text, never executed |
| A3.3 | Injection-shaped input into any id field | parameterised; no SQL error surfaced |
| A3.4 | API routes with malformed JSON | 400 with a message, not a stack trace |
| A3.5 | API routes with oversized payloads | rejected cleanly |

---

## 3. Section B — API route contracts (37 routes)

Each route is tested for shape, failure, and — where it serves game data — correctness against the same oracle the MCP plan uses.

### B1. Build and configuration

| ID | Route | Test | Expected |
|----|-------|------|----------|
| B1.1 | `/api/build-info` | GET | `available: true`; active build 12.1.0.69497; six data paths each with an `exists` flag |
| B1.2 | `/api/build-info` | with the manifest renamed away | `available: false` and an explanatory `message`; **no crash** |
| B1.3 | `/api/config` | GET | `dataPaths` equal the active build's paths, not the environment's |
| B1.4 | `/api/config` | with `DB2_PATH` set to a junk directory | still reports the build's path |
| B1.5 | `/api/config/reset` | POST | all five of gt, dbc, db2, vmap, mmap come from the manifest |
| B1.6 | `/api/config/diagnose` | GET | reports genuinely missing paths; does not claim a present path is missing |
| B1.7 | `/api/health` | GET | healthy; includes dependency status |

**B1.3 and B1.4 are the regression tests** for the defect where the settings page showed the archived build's directories while the tools read the active build's.

### B2. Game data

| ID | Route | Expected | Oracle |
|----|-------|----------|--------|
| B2.1 | `/api/item/25` | Worn Shortsword, COMMON, ilvl 1 | MCP `get-item-info` + game |
| B2.2 | `/api/item/19019` | Thunderfury, LEGENDARY, ilvl 29 | MCP + game |
| B2.3 | `/api/item/999999999` | not-found response, not a 500 | — |
| B2.4 | `/api/spell/133` | Fireball | MCP + game |
| B2.5 | `/api/spell/8326` | Ghost | MCP + game |
| B2.6 | `/api/creature/[id]` for a known NPC | matches the `world` database row | database |
| B2.7 | `/api/zones` | zone list matches the DBC | DBC |
| B2.8 | Every game-data route vs its MCP tool | identical values for the same id | MCP server |

**B2.8 is the cheapest high-value test in this plan.** The web UI and the MCP server must never disagree; if they do, one of them is reading the wrong build or caching stale data.

### B3. Maps and collision

| ID | Route | Expected |
|----|-------|----------|
| B3.1 | `/api/maps/list` | 11 continent-level maps for the minimap viewer, each with an `extracted` flag. This is deliberately not the 1,079 maps `mapextractor` produced: the route serves the viewer's continent list, not the game's map table. |
| B3.2 | `/api/maps/[mapId]` for a valid map | metadata; tiles enumerated |
| B3.3 | `/api/collision-data?type=vmap` | reads the **active build's** vmap directory |
| B3.4 | `/api/collision-data?type=mmap` | reads the active build's mmap directory |
| B3.5 | `/api/collision-data?type=map` | reads `MAP_PATH` (documented: terrain is not in the manifest) |
| B3.6 | `/api/collision-data` with a missing directory | explains which path is missing |
| B3.7 | `/api/minimap/tile/[fileDataId]` | returns the tile or a clean 404 |
| B3.8 | `/api/minimap/tiles/batch` | batch matches N individual requests |

### B4. MCP passthrough

| ID | Route | Expected |
|----|-------|----------|
| B4.1 | `/api/mcp/tools` | 155 tools, matching the server's `ListTools` |
| B4.2 | `/api/mcp/call` with a valid tool | same result as calling the tool directly |
| B4.3 | `/api/mcp/call` with an unknown tool | clean error, not a hang |
| B4.4 | `/api/mcp/call` with invalid arguments | the tool's own validation error is surfaced |
| B4.5 | MCP server killed mid-session | route reports the disconnection; the UI does not spin forever |

**B4.5 matters because the web UI spawns its own MCP child.** If that child dies, the failure must surface rather than presenting as an empty result set.

### B5. Remaining routes

Shape and failure tests for: `/api/docs`, `/api/docs/[method]`, `/api/schema`, `/api/soap`, `/api/workflow`, `/api/profiler`, `/api/replay`, `/api/economy-simulation`, `/api/quest-chains` (+ `/analytics`, `/validate`), `/api/sai/validate`, `/api/sai/collaborate`, `/api/diff-merge`, `/api/cpp-test-gen`, `/api/map-files` (+ `/[filename]`), `/api/maps/extract`, `/api/maps/wow-info`, `/api/wdt/extract`.

For each: valid request returns the documented shape; invalid request returns a 4xx with a message; a backend failure returns 5xx with a message and no stack trace.

---

## 4. Section C — Pages

Grouped by what they depend on, because that determines what "correct" means.

### C1. Game data browsers

`/spells`, `/spells/[spellId]`, `/items`, `/items/[itemId]`, `/creatures`, `/creatures/[creatureId]`, `/quest-chains`

| ID | Test | Expected |
|----|------|----------|
| C1.1 | Browse and open a detail page | detail matches the list row |
| C1.2 | Item 25 detail | Worn Shortsword, COMMON, ilvl 1 — same as `/api/item/25` and the MCP tool |
| C1.3 | Spell 133 detail | Fireball |
| C1.4 | Search with no matches | empty state explains the filter matched nothing |
| C1.5 | Search with a special character | no crash, no injection |
| C1.6 | Pagination | page 2 differs from page 1; last page terminates |
| C1.7 | Direct URL to a non-existent id | not-found page, not a crash |

### C2. Map and spatial

`/map-viewer`, `/map-picker`, `/map-picker-enhanced`, `/3d-viewer`, `/live-inspector`

| ID | Test | Expected |
|----|------|----------|
| C2.1 | Load a map | tiles render; count matches the extraction |
| C2.2 | Minimap tiles | correct tiles for the map, no cross-map bleed |
| C2.3 | Collision overlay | reads the active build's vmaps |
| C2.4 | A map with no extracted tiles | says so; does not render a blank grid silently |
| C2.5 | 3D viewer with a large model | loads or fails visibly; no indefinite spinner |

### C3. Configuration and monitoring

`/settings`, `/dashboard`, `/world-dashboard`, `/monitoring`, `/live-monitor`, `/profiler`, `/database-manager`, `/schema-explorer`, `/migrations`

| ID | Test | Expected |
|----|------|----------|
| C3.1 | Settings → Data Paths tab | the **Active client build** panel appears first: id, expansion, DB2 format |
| C3.2 | Data path list in that panel | six paths, each with a present/missing mark, matching `/api/build-info` |
| C3.3 | A deliberately missing path | shown as missing, with the count called out |
| C3.4 | Manifest absent | the "No build manifest" notice appears and the editable fields are described as authoritative |
| C3.5 | Editable path fields | described as a fallback used only without a manifest — they must not appear to control the tools |
| C3.6 | Save settings | writes what it claims to; re-reading returns the same values |
| C3.7 | Reset settings | restores the manifest's paths (B1.5) |
| C3.8 | Dashboards with the server down | degrade visibly |

**C3.1–C3.5 are the build-awareness acceptance tests.** They are the visible half of the fix; B1.3–B1.4 are the invisible half.

### C4. Editors and generators

`/sai-editor`, `/sai-editor-enhanced`, `/behavior-tree`, `/world-editor`, `/docs-generator`, `/cpp-test-generator`, `/code-review`, `/workflow`, `/diff-compare`, `/diff-merge`, `/compare`

| ID | Test | Expected |
|----|------|----------|
| C4.1 | Create, edit, save | round-trips; reload shows the saved state |
| C4.2 | Invalid input | validation message; no silent discard |
| C4.3 | Unsaved changes on navigate | warned, or preserved |
| C4.4 | Generated output | syntactically valid for its language |
| C4.5 | Large document (500 nodes) | remains responsive; note the timing |

### C5. Analysis

`/combat-log-analyzer`, `/ai-visualizer`, `/economy-simulation`, `/replay-sessions`, `/test-coverage`, `/live-monitor`

| ID | Test | Expected |
|----|------|----------|
| C5.1 | Upload or select a dataset | parses; totals are internally consistent |
| C5.2 | Malformed input file | rejected with a message naming the problem |
| C5.3 | Empty dataset | empty state, not a zeroed chart presented as real |
| C5.4 | Charts | axes labelled; units stated; no misleading truncated axis |

### C6. Documentation

`/docs`, `/docs/[method]`, `/playground`

| ID | Test | Expected |
|----|------|----------|
| C6.1 | Method list | matches the API surface |
| C6.2 | A method page | parameters match the tool's real `inputSchema` |
| C6.3 | Playground: run a tool | result matches calling it directly |
| C6.4 | Playground: required parameter omitted | the tool's validation error is shown |

---

## 5. Section D — Performance

| ID | Test | Target |
|----|------|--------|
| D1 | First contentful paint, cached | <1 s |
| D2 | Page load, cold | <3 s |
| D3 | API route response | <200 ms warm |
| D4 | Item/spell list with 1,000 rows | scrolls without jank |
| D5 | Map viewer tile load | progressive; no long blocking |
| D6 | Memory after 20 navigations | no unbounded growth (listener/subscription leaks) |
| D7 | Production build | `npm run build` succeeds; bundle size recorded |

---

## 6. Section E — Cross-checks and regressions

| ID | Test | Why |
|----|------|-----|
| E1 | Web UI and MCP agree on 20 ids across items, spells and creatures | they are different code paths onto the same data |
| E2 | Web UI and MCP report the same active build | the UI spawns its own MCP child; drift here is invisible otherwise |
| E3 | Stale `DB2_PATH`/`VMAP_PATH` in `web-ui/.env.local` | the manifest still wins (B1.4, B3.3) |
| E4 | After a build cutover, restart only the web UI | paths, data and the settings panel follow the new build |
| E5 | Manifest deleted while the UI runs | degrades to the environment fallback and says so |
| E6 | A page whose API route 500s | error state, not an infinite spinner |

**E4 is the rehearsal for the next migration.** Run it against the archived build (`11.2.7.65299`) and flip back; it costs minutes and covers the failure that took this session to find.

---

## 7. What this plan does not cover

- **The 15 pre-existing TypeScript errors** in `web-ui/__tests__/sai-unified/*` — test-fixture type mismatches, unrelated to application code.
- **Browser matrix** — written against one browser. Add rows if the project commits to a matrix.
- **Authentication and multi-user** — the UI is assumed to be a local development tool on a trusted network.
- **Visual regression** — no baseline screenshots exist; the presentation tests above are structural, not pixel-exact.
- **`WOW_PATH` and terrain `.map` paths** — not declared in the build manifest, so they remain environment-configured by design.
