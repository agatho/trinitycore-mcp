import { NextRequest, NextResponse } from 'next/server';
import { buildTableSchema, buildSchemaRelationships, searchSchema, generateCreateTableSQL } from '@/lib/schema-parser';
import type { TableSchema } from '@/lib/schema-parser';

/**
 * GET /api/schema - Get database schema information
 * Query params:
 *   - action: 'list' | 'table' | 'relationships' | 'search'
 *   - database: database name (default: 'world')
 *   - table: table name (for action=table)
 *   - query: search query (for action=search)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'list';
    const database = searchParams.get('database') || 'world';
    const tableName = searchParams.get('table');
    const searchQuery = searchParams.get('query');

    // In a real implementation, this would call the MCP server
    // For now, we'll return mock data to demonstrate the structure

    switch (action) {
      case 'list':
        return NextResponse.json(await listTables(database));

      case 'table':
        if (!tableName) {
          return NextResponse.json(
            { error: 'Table name is required' },
            { status: 400 }
          );
        }
        return NextResponse.json(await getTableSchema(database, tableName));

      case 'relationships':
        return NextResponse.json(await getRelationships(database));

      case 'search':
        if (!searchQuery) {
          return NextResponse.json(
            { error: 'Search query is required' },
            { status: 400 }
          );
        }
        return NextResponse.json(await searchTables(database, searchQuery));

      case 'ddl':
        if (!tableName) {
          return NextResponse.json(
            { error: 'Table name is required' },
            { status: 400 }
          );
        }
        return NextResponse.json(await getTableDDL(database, tableName));

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Schema API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schema - Execute schema operations
 * Body:
 *   - action: 'execute' | 'validate'
 *   - sql: SQL query to execute
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sql, database = 'world' } = body;

    if (!sql) {
      return NextResponse.json(
        { error: 'SQL is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'validate':
        return NextResponse.json(await validateSQL(sql));

      case 'execute':
        return NextResponse.json(await executeSQL(database, sql));

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Schema API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * List all tables in database
 */
async function listTables(database: string) {
  // TODO: Call MCP tool to get actual data
  // For now, return mock TrinityCore tables
  return {
    database,
    tables: [
      {
        name: 'creature_template',
        rowCount: 45231,
        dataSize: '12.5 MB',
        comment: 'Creature System',
      },
      {
        name: 'item_template',
        rowCount: 62341,
        dataSize: '18.3 MB',
        comment: 'Item System',
      },
      {
        name: 'gameobject_template',
        rowCount: 12450,
        dataSize: '4.2 MB',
        comment: 'Gameobject System',
      },
      {
        name: 'spell_dbc',
        rowCount: 98234,
        dataSize: '25.7 MB',
        comment: 'Spell DBC Data',
      },
      {
        name: 'quest_template',
        rowCount: 15673,
        dataSize: '8.9 MB',
        comment: 'Quest System',
      },
    ],
  };
}

/**
 * Get detailed schema for a table
 */
async function getTableSchema(database: string, tableName: string): Promise<{ table: TableSchema }> {
  // TODO: Call MCP tool to get actual data
  // For now, return mock schema for creature_template

  if (tableName === 'creature_template') {
    const mockColumns = [
      {
        COLUMN_NAME: 'entry',
        COLUMN_TYPE: 'int(10) unsigned',
        IS_NULLABLE: 'NO',
        COLUMN_KEY: 'PRI',
        COLUMN_DEFAULT: null,
        EXTRA: '',
        COLUMN_COMMENT: 'Creature template entry',
      },
      {
        COLUMN_NAME: 'name',
        COLUMN_TYPE: 'varchar(100)',
        IS_NULLABLE: 'NO',
        COLUMN_KEY: '',
        COLUMN_DEFAULT: '',
        EXTRA: '',
        COLUMN_COMMENT: 'Creature name',
      },
      {
        COLUMN_NAME: 'subname',
        COLUMN_TYPE: 'varchar(100)',
        IS_NULLABLE: 'YES',
        COLUMN_KEY: '',
        COLUMN_DEFAULT: null,
        EXTRA: '',
        COLUMN_COMMENT: 'Creature subname',
      },
      {
        COLUMN_NAME: 'minlevel',
        COLUMN_TYPE: 'tinyint(3) unsigned',
        IS_NULLABLE: 'NO',
        COLUMN_KEY: '',
        COLUMN_DEFAULT: '1',
        EXTRA: '',
        COLUMN_COMMENT: 'Minimum level',
      },
      {
        COLUMN_NAME: 'maxlevel',
        COLUMN_TYPE: 'tinyint(3) unsigned',
        IS_NULLABLE: 'NO',
        COLUMN_KEY: '',
        COLUMN_DEFAULT: '1',
        EXTRA: '',
        COLUMN_COMMENT: 'Maximum level',
      },
      {
        COLUMN_NAME: 'faction',
        COLUMN_TYPE: 'smallint(5) unsigned',
        IS_NULLABLE: 'NO',
        COLUMN_KEY: '',
        COLUMN_DEFAULT: '0',
        EXTRA: '',
        COLUMN_COMMENT: 'Faction template id',
      },
    ];

    const mockForeignKeys: any[] = [];
    const mockIndexes = [
      {
        INDEX_NAME: 'PRIMARY',
        COLUMN_NAME: 'entry',
        NON_UNIQUE: 0,
        INDEX_TYPE: 'BTREE',
      },
      {
        INDEX_NAME: 'idx_name',
        COLUMN_NAME: 'name',
        NON_UNIQUE: 1,
        INDEX_TYPE: 'BTREE',
      },
    ];

    const mockTableInfo = {
      ENGINE: 'InnoDB',
      TABLE_COLLATION: 'utf8mb4_unicode_ci',
      TABLE_ROWS: 45231,
      DATA_LENGTH: 13107200,
      TABLE_COMMENT: 'Creature System',
    };

    const table = buildTableSchema(
      tableName,
      mockColumns,
      mockForeignKeys,
      mockIndexes,
      mockTableInfo
    );

    return { table };
  }

  // Return empty schema for unknown tables
  return {
    table: {
      name: tableName,
      columns: [],
      primaryKeys: [],
      foreignKeys: [],
      indexes: [],
    },
  };
}

/**
 * Get relationships between tables
 */
async function getRelationships(database: string) {
  // TODO: Call MCP tool to get actual data
  return {
    database,
    relationships: [
      {
        from: 'creature',
        to: 'creature_template',
        fromColumn: 'id',
        toColumn: 'entry',
        type: 'many-to-one',
      },
      {
        from: 'quest_template',
        to: 'creature_template',
        fromColumn: 'RequiredNpcOrGo1',
        toColumn: 'entry',
        type: 'many-to-one',
      },
    ],
  };
}

/**
 * Search tables by name or column
 */
async function searchTables(database: string, query: string) {
  // TODO: Call MCP tool to get actual data
  return {
    database,
    query,
    results: [
      {
        table: 'creature_template',
        matches: ['Table: creature_template', 'Column: entry (int)', 'Column: name (varchar)'],
      },
      {
        table: 'item_template',
        matches: ['Table: item_template', 'Column: entry (int)', 'Column: name (varchar)'],
      },
    ],
  };
}

/**
 * Get DDL for table
 */
async function getTableDDL(database: string, tableName: string) {
  const { table } = await getTableSchema(database, tableName);
  const ddl = generateCreateTableSQL(table);

  return {
    table: tableName,
    ddl,
  };
}

/**
 * Validate SQL query
 */
async function validateSQL(sql: string) {
  // Basic validation - check for dangerous operations
  const dangerous = ['DROP', 'TRUNCATE', 'DELETE FROM', 'UPDATE'];
  const upperSQL = sql.toUpperCase();

  for (const keyword of dangerous) {
    if (upperSQL.includes(keyword)) {
      return {
        valid: false,
        error: `Dangerous operation detected: ${keyword}`,
      };
    }
  }

  return {
    valid: true,
    message: 'Query appears safe',
  };
}

/**
 * Execute SQL query
 */
async function executeSQL(database: string, sql: string) {
  // TODO: Call MCP tool to execute query
  // For now, return mock result
  return {
    success: true,
    message: 'Query executed successfully (mock)',
    rowsAffected: 0,
  };
}
