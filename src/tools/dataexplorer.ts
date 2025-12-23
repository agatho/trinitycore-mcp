/**
 * Interactive Data Explorer
 * Human Exploration Tool #4
 *
 * Purpose: Natural language to SQL converter for exploring TrinityCore databases.
 * Benefit: Humans can explore data without writing SQL, getting instant insights and visualizations.
 */

import { queryWorld, queryAuth, queryCharacters } from "../database/connection";

/**
 * Query result with metadata
 */
export interface QueryResult {
  rows: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
  sql: string;
  visualization?: VisualizationSuggestion;
}

/**
 * Visualization suggestion
 */
export interface VisualizationSuggestion {
  type: "bar" | "pie" | "line" | "table" | "heatmap" | "scatter";
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  title: string;
  description: string;
}

/**
 * Natural language query intent
 */
export interface QueryIntent {
  action: "count" | "list" | "find" | "compare" | "analyze" | "stats";
  entity:
    | "spells"
    | "items"
    | "creatures"
    | "quests"
    | "players"
    | "characters"
    | "accounts"
    | "zones"
    | "other";
  filters: Array<{ field: string; operator: string; value: any }>;
  sort?: { field: string; direction: "ASC" | "DESC" };
  limit?: number;
  groupBy?: string;
}

/**
 * Related query suggestions
 */
export interface RelatedQuery {
  query: string;
  description: string;
  category: "similar" | "drill_down" | "related" | "trending";
}

/**
 * Parse natural language query to SQL intent
 */
export function parseNaturalLanguageQuery(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase();

  // Detect action
  let action: QueryIntent["action"] = "list";
  if (
    lowerQuery.includes("how many") ||
    lowerQuery.includes("count") ||
    lowerQuery.includes("number of")
  ) {
    action = "count";
  } else if (
    lowerQuery.includes("find") ||
    lowerQuery.includes("search") ||
    lowerQuery.includes("show me")
  ) {
    action = "find";
  } else if (lowerQuery.includes("compare") || lowerQuery.includes("versus")) {
    action = "compare";
  } else if (
    lowerQuery.includes("analyze") ||
    lowerQuery.includes("breakdown") ||
    lowerQuery.includes("distribution")
  ) {
    action = "analyze";
  } else if (
    lowerQuery.includes("stats") ||
    lowerQuery.includes("statistics") ||
    lowerQuery.includes("average")
  ) {
    action = "stats";
  }

  // Detect entity
  let entity: QueryIntent["entity"] = "other";
  if (lowerQuery.includes("spell")) entity = "spells";
  else if (lowerQuery.includes("item")) entity = "items";
  else if (lowerQuery.includes("creature") || lowerQuery.includes("npc"))
    entity = "creatures";
  else if (lowerQuery.includes("quest")) entity = "quests";
  else if (lowerQuery.includes("player")) entity = "players";
  else if (lowerQuery.includes("character")) entity = "characters";
  else if (lowerQuery.includes("account")) entity = "accounts";
  else if (lowerQuery.includes("zone") || lowerQuery.includes("area")) entity = "zones";

  // Extract filters
  const filters: Array<{ field: string; operator: string; value: any }> = [];

  // Level filters
  const levelMatch = lowerQuery.match(/level\s*(\d+)/);
  if (levelMatch) {
    filters.push({ field: "level", operator: "=", value: parseInt(levelMatch[1]) });
  }

  const levelAboveMatch = lowerQuery.match(/(?:above|over|greater than)\s*level\s*(\d+)/);
  if (levelAboveMatch) {
    filters.push({ field: "level", operator: ">", value: parseInt(levelAboveMatch[1]) });
  }

  const levelBelowMatch = lowerQuery.match(/(?:below|under|less than)\s*level\s*(\d+)/);
  if (levelBelowMatch) {
    filters.push({ field: "level", operator: "<", value: parseInt(levelBelowMatch[1]) });
  }

  // Quality filters (for items)
  if (lowerQuery.includes("epic")) {
    filters.push({ field: "Quality", operator: "=", value: 4 });
  } else if (lowerQuery.includes("rare")) {
    filters.push({ field: "Quality", operator: "=", value: 3 });
  } else if (lowerQuery.includes("uncommon")) {
    filters.push({ field: "Quality", operator: "=", value: 2 });
  } else if (lowerQuery.includes("legendary")) {
    filters.push({ field: "Quality", operator: "=", value: 5 });
  }

  // Class filters (for spells/items)
  const classMatch = lowerQuery.match(
    /\b(warrior|paladin|hunter|rogue|priest|death knight|shaman|mage|warlock|monk|druid|demon hunter|evoker)\b/
  );
  if (classMatch) {
    const classMap: Record<string, number> = {
      warrior: 1,
      paladin: 2,
      hunter: 3,
      rogue: 4,
      priest: 5,
      "death knight": 6,
      shaman: 7,
      mage: 8,
      warlock: 9,
      monk: 10,
      druid: 11,
      "demon hunter": 12,
      evoker: 13,
    };
    filters.push({
      field: "AllowableClass",
      operator: "&",
      value: Math.pow(2, classMap[classMatch[1]] - 1),
    });
  }

  // Name filters
  const nameMatch = lowerQuery.match(/named?\s+"([^"]+)"/);
  if (nameMatch) {
    filters.push({ field: "name", operator: "LIKE", value: `%${nameMatch[1]}%` });
  }

  // Sort detection
  let sort: QueryIntent["sort"] | undefined;
  if (lowerQuery.includes("highest") || lowerQuery.includes("top")) {
    sort = { field: "level", direction: "DESC" };
  } else if (lowerQuery.includes("lowest")) {
    sort = { field: "level", direction: "ASC" };
  }

  // Limit detection
  let limit: number | undefined;
  const limitMatch = lowerQuery.match(/(?:top|first|last)\s*(\d+)/);
  if (limitMatch) {
    limit = parseInt(limitMatch[1]);
  } else if (action === "list" && !lowerQuery.includes("all")) {
    limit = 20; // Default limit
  }

  return {
    action,
    entity,
    filters,
    sort,
    limit,
  };
}

/**
 * Convert query intent to SQL
 */
export function intentToSQL(intent: QueryIntent): { sql: string; params: any[] } {
  const params: any[] = [];

  // Determine table and fields based on entity
  let table: string;
  let fields: string;
  let database: "world" | "auth" | "characters";

  switch (intent.entity) {
    case "spells":
      table = "spell_template";
      fields =
        intent.action === "count"
          ? "COUNT(*) as count"
          : "ID, SpellName, SpellLevel, BaseLevel, MaxLevel";
      database = "world";
      break;

    case "items":
      table = "item_template";
      fields =
        intent.action === "count"
          ? "COUNT(*) as count"
          : "entry, name, Quality, ItemLevel, RequiredLevel, class, subclass";
      database = "world";
      break;

    case "creatures":
      table = "creature_template";
      fields =
        intent.action === "count"
          ? "COUNT(*) as count"
          : "entry, name, minlevel, maxlevel, rank, type, family";
      database = "world";
      break;

    case "quests":
      table = "quest_template qt LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID";
      // TrinityCore 11.2.7: MinLevel removed, now uses ContentTuningID
      fields =
        intent.action === "count"
          ? "COUNT(*) as count"
          : "qt.ID, qt.LogTitle, qta.MaxLevel as QuestLevel, qt.ContentTuningID, qt.QuestInfoID as QuestType";
      database = "world";
      break;

    case "characters":
      table = "characters";
      fields =
        intent.action === "count" ? "COUNT(*) as count" : "guid, name, level, class, race";
      database = "characters";
      break;

    case "accounts":
      table = "account";
      fields =
        intent.action === "count"
          ? "COUNT(*) as count"
          : "id, username, email, joindate, last_login";
      database = "auth";
      break;

    default:
      throw new Error(`Unknown entity type: ${intent.entity}`);
  }

  // Build WHERE clause
  const whereClauses: string[] = [];
  for (const filter of intent.filters) {
    switch (filter.operator) {
      case "=":
        whereClauses.push(`${filter.field} = ?`);
        params.push(filter.value);
        break;
      case ">":
        whereClauses.push(`${filter.field} > ?`);
        params.push(filter.value);
        break;
      case "<":
        whereClauses.push(`${filter.field} < ?`);
        params.push(filter.value);
        break;
      case "LIKE":
        whereClauses.push(`${filter.field} LIKE ?`);
        params.push(filter.value);
        break;
      case "&":
        whereClauses.push(`(${filter.field} & ?) != 0`);
        params.push(filter.value);
        break;
    }
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Build ORDER BY clause
  const orderClause = intent.sort
    ? `ORDER BY ${intent.sort.field} ${intent.sort.direction}`
    : "";

  // Build LIMIT clause
  const limitClause = intent.limit ? `LIMIT ${intent.limit}` : "";

  // Build complete SQL
  const sql = `SELECT ${fields} FROM ${table} ${whereClause} ${orderClause} ${limitClause}`;

  return { sql: sql.trim(), params };
}

/**
 * Execute natural language query
 */
export async function executeNaturalLanguageQuery(query: string): Promise<QueryResult> {
  const startTime = Date.now();

  // Parse query to intent
  const intent = parseNaturalLanguageQuery(query);

  // Convert intent to SQL
  const { sql, params } = intentToSQL(intent);

  // Determine database
  const database =
    intent.entity === "accounts"
      ? "auth"
      : intent.entity === "characters" || intent.entity === "players"
        ? "characters"
        : "world";

  // Execute query
  let rows: any[];
  if (database === "world") {
    rows = await queryWorld(sql, params);
  } else if (database === "auth") {
    rows = await queryAuth(sql, params);
  } else {
    rows = await queryCharacters(sql, params);
  }

  // Extract column names
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  const executionTime = Date.now() - startTime;

  // Generate visualization suggestion
  const visualization = suggestVisualization(intent, rows, columns);

  return {
    rows,
    columns,
    rowCount: rows.length,
    executionTime,
    sql,
    visualization,
  };
}

/**
 * Suggest visualization based on query results
 */
function suggestVisualization(
  intent: QueryIntent,
  rows: any[],
  columns: string[]
): VisualizationSuggestion | undefined {
  if (rows.length === 0) return undefined;

  // Count queries -> Pie chart
  if (intent.action === "count" && columns.includes("count")) {
    return {
      type: "pie",
      title: `Count of ${intent.entity}`,
      description: "Total count distribution",
    };
  }

  // Stats/Analyze queries -> Bar chart
  if (intent.action === "stats" || intent.action === "analyze") {
    const numericColumn = columns.find((c) =>
      ["level", "minlevel", "maxlevel", "Quality", "rank"].includes(c)
    );

    if (numericColumn) {
      return {
        type: "bar",
        xAxis: "name",
        yAxis: numericColumn,
        title: `${intent.entity} by ${numericColumn}`,
        description: `Distribution of ${numericColumn} across ${intent.entity}`,
      };
    }
  }

  // Compare queries -> Bar chart
  if (intent.action === "compare") {
    return {
      type: "bar",
      xAxis: columns[0],
      yAxis: columns[1],
      title: `Comparison of ${intent.entity}`,
      description: "Side-by-side comparison",
    };
  }

  // Default to table for list/find queries
  return {
    type: "table",
    title: `${intent.entity} results`,
    description: "Tabular data view",
  };
}

/**
 * Generate related query suggestions
 */
export function generateRelatedQueries(
  originalQuery: string,
  intent: QueryIntent,
  results: QueryResult
): RelatedQuery[] {
  const related: RelatedQuery[] = [];

  // Similar queries
  if (intent.entity === "spells") {
    related.push({
      query: "Show me items with spell effects",
      description: "Items that cast these spells",
      category: "similar",
    });
  }

  if (intent.entity === "items") {
    related.push({
      query: "Show me creatures that drop these items",
      description: "Loot sources for items",
      category: "similar",
    });
  }

  // Drill-down queries
  if (results.rowCount > 0 && intent.action === "count") {
    related.push({
      query: originalQuery.replace("how many", "show me the"),
      description: "See individual results instead of count",
      category: "drill_down",
    });
  }

  if (results.rowCount > 0 && intent.action === "list") {
    related.push({
      query: `Analyze ${intent.entity} by level`,
      description: "Group results by level",
      category: "drill_down",
    });
  }

  // Related queries
  if (intent.entity === "creatures") {
    related.push({
      query: "Show me quests that involve these creatures",
      description: "Related quest content",
      category: "related",
    });
  }

  if (intent.entity === "quests") {
    related.push({
      query: "Show me quest rewards",
      description: "Items rewarded by quests",
      category: "related",
    });
  }

  // Trending queries (popular searches)
  related.push(
    {
      query: "Show me top 10 legendary items",
      description: "Popular legendary items",
      category: "trending",
    },
    {
      query: "How many raid bosses are there?",
      description: "Count of raid encounters",
      category: "trending",
    },
    {
      query: "Show me level 80 quests",
      description: "Max level quests",
      category: "trending",
    }
  );

  return related.slice(0, 6);
}

/**
 * Validate SQL query for safety
 */
export function validateQuerySafety(sql: string): {
  safe: boolean;
  reason?: string;
} {
  const lowerSQL = sql.toLowerCase();

  // Block dangerous operations
  const dangerousKeywords = [
    "drop",
    "delete",
    "truncate",
    "alter",
    "update",
    "insert",
    "create",
    "grant",
    "revoke",
  ];

  for (const keyword of dangerousKeywords) {
    if (lowerSQL.includes(keyword)) {
      return {
        safe: false,
        reason: `Query contains dangerous keyword: ${keyword}`,
      };
    }
  }

  // Ensure query is SELECT only
  if (!lowerSQL.trim().startsWith("select")) {
    return {
      safe: false,
      reason: "Only SELECT queries are allowed",
    };
  }

  // Block attempts to access system tables
  const systemTables = ["mysql", "information_schema", "performance_schema"];
  for (const sysTable of systemTables) {
    if (lowerSQL.includes(sysTable)) {
      return {
        safe: false,
        reason: `Access to system tables is not allowed: ${sysTable}`,
      };
    }
  }

  return { safe: true };
}

/**
 * Get popular/example queries
 */
export function getPopularQueries(): Array<{
  query: string;
  category: string;
  description: string;
}> {
  return [
    {
      query: "Show me top 10 epic items",
      category: "Items",
      description: "Highest quality items in the database",
    },
    {
      query: "How many spells are there for mages?",
      category: "Spells",
      description: "Count of mage-specific spells",
    },
    {
      query: "Show me raid boss creatures",
      category: "Creatures",
      description: "Elite raid encounter NPCs",
    },
    {
      query: "Find quests above level 70",
      category: "Quests",
      description: "High-level quest content",
    },
    {
      query: "Show me legendary weapons",
      category: "Items",
      description: "Legendary quality weapons",
    },
    {
      query: "How many active characters are there?",
      category: "Characters",
      description: "Player character statistics",
    },
    {
      query: "Show me warrior spells at level 60",
      category: "Spells",
      description: "Class-specific spell progression",
    },
    {
      query: "Find creatures in Icecrown",
      category: "Creatures",
      description: "Zone-specific NPCs",
    },
    {
      query: "Show me quest chains",
      category: "Quests",
      description: "Multi-part quest series",
    },
    {
      query: "Analyze item distribution by quality",
      category: "Items",
      description: "Quality tier breakdown",
    },
  ];
}

/**
 * Export data to different formats
 */
export interface ExportFormat {
  format: "json" | "csv" | "markdown" | "sql";
  content: string;
  filename: string;
}

export function exportQueryResults(
  results: QueryResult,
  format: "json" | "csv" | "markdown" | "sql"
): ExportFormat {
  switch (format) {
    case "json":
      return {
        format: "json",
        content: JSON.stringify(results.rows, null, 2),
        filename: "query_results.json",
      };

    case "csv":
      const csvHeader = results.columns.join(",");
      const csvRows = results.rows
        .map((row) => results.columns.map((col) => `"${row[col] || ""}"`).join(","))
        .join("\n");
      return {
        format: "csv",
        content: `${csvHeader}\n${csvRows}`,
        filename: "query_results.csv",
      };

    case "markdown":
      const mdHeader = `| ${results.columns.join(" | ")} |`;
      const mdSeparator = `| ${results.columns.map(() => "---").join(" | ")} |`;
      const mdRows = results.rows
        .map((row) => `| ${results.columns.map((col) => row[col] || "").join(" | ")} |`)
        .join("\n");
      return {
        format: "markdown",
        content: `${mdHeader}\n${mdSeparator}\n${mdRows}`,
        filename: "query_results.md",
      };

    case "sql":
      if (results.rows.length === 0) {
        return {
          format: "sql",
          content: "-- No results to export",
          filename: "query_results.sql",
        };
      }

      const tableName = "query_results";
      const createTable = `CREATE TABLE ${tableName} (\n${results.columns.map((col) => `  ${col} VARCHAR(255)`).join(",\n")}\n);`;

      const insertStatements = results.rows
        .map((row) => {
          const values = results.columns
            .map((col) => {
              const val = row[col];
              return val === null || val === undefined
                ? "NULL"
                : `'${String(val).replace(/'/g, "''")}'`;
            })
            .join(", ");
          return `INSERT INTO ${tableName} VALUES (${values});`;
        })
        .join("\n");

      return {
        format: "sql",
        content: `${createTable}\n\n${insertStatements}`,
        filename: "query_results.sql",
      };
  }
}

/**
 * Get query history (stored in memory for session)
 */
const queryHistory: Array<{
  query: string;
  timestamp: Date;
  rowCount: number;
  executionTime: number;
}> = [];

export function addToHistory(
  query: string,
  rowCount: number,
  executionTime: number
): void {
  queryHistory.unshift({
    query,
    timestamp: new Date(),
    rowCount,
    executionTime,
  });

  // Keep only last 50 queries
  if (queryHistory.length > 50) {
    queryHistory.pop();
  }
}

export function getQueryHistory(): Array<{
  query: string;
  timestamp: Date;
  rowCount: number;
  executionTime: number;
}> {
  return [...queryHistory];
}

export function clearQueryHistory(): void {
  queryHistory.length = 0;
}
