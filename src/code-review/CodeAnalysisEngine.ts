/**
 * Code Analysis Engine with Serena MCP Integration
 * Priority #4: Component #12 - Core Analysis Infrastructure
 *
 * Bridges Serena's C++ code analysis with TrinityCore Rule Engine
 * Converts Serena MCP output → AST format → Rule engine input
 *
 * Performance targets:
 * - <500ms file analysis for typical TrinityCore source files
 * - <5s full project scan with caching
 * - Support incremental analysis for IDE integration
 */

import * as fs from 'fs/promises';
import type {
  AST,
  ASTNode,
  ClassSymbol,
  FunctionSymbol,
  MethodSymbol,
  VariableSymbol,
  TypedefSymbol,
  IncludeDirective,
  ParameterInfo,
  SymbolTable,
  Language,
  SymbolInfo,
} from './types';
import { logger } from '../utils/logger';

// ============================================================================
// SERENA MCP INTEGRATION TYPES
// ============================================================================

/**
 * Serena MCP Symbol response format
 * Maps to mcp__serena__find_symbol output
 */
interface SerenaSymbol {
  name: string;
  name_path: string;
  relative_path: string;
  kind: number; // LSP SymbolKind
  line: number;
  column: number;
  end_line?: number;
  end_column?: number;
  body?: string;
  signature?: string;
  documentation?: string;
  children?: SerenaSymbol[];
  modifiers?: string[];
}

/**
 * Serena MCP file overview response
 * Maps to mcp__serena__get_symbols_overview output
 */
interface SerenaFileOverview {
  file: string;
  symbols: SerenaSymbol[];
  total_symbols: number;
  top_level_symbols: number;
}

/**
 * LSP Symbol Kinds (from Language Server Protocol)
 * Used by Serena to classify symbols
 */
enum LSPSymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

// ============================================================================
// CACHE SYSTEM
// ============================================================================

interface CacheEntry {
  ast: AST;
  timestamp: number;
  fileHash: string;
}

interface AnalysisStats {
  filesAnalyzed: number;
  cacheHits: number;
  cacheMisses: number;
  totalAnalysisTime: number;
  averageFileTime: number;
}

// ============================================================================
// CODE ANALYSIS ENGINE
// ============================================================================

export class CodeAnalysisEngine {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: AnalysisStats = {
    filesAnalyzed: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalAnalysisTime: 0,
    averageFileTime: 0,
  };

  // Serena MCP tool functions (injected via constructor for testability)
  private serenaTool: {
    getSymbolsOverview: (filepath: string) => Promise<SerenaFileOverview>;
    findSymbol: (name_path: string, filepath: string, depth: number, includeBody: boolean) => Promise<SerenaSymbol[]>;
    searchPattern: (pattern: string, filepath: string) => Promise<{ [file: string]: string[] }>;
  };

  /**
   * Initialize Code Analysis Engine with Serena MCP integration
   *
   * @param serenaTool - Serena MCP tool interface (from MCP client)
   */
  constructor(serenaTool: any) {
    this.serenaTool = serenaTool;
  }

  /**
   * Analyze a single C++ source file
   * Main entry point for file analysis
   *
   * @param filepath - Absolute path to source file
   * @param options - Analysis options
   * @returns Complete AST for the file
   */
  async analyzeFile(
    filepath: string,
    options: {
      useCache?: boolean;
      includeBody?: boolean;
      depth?: number;
    } = {}
  ): Promise<AST> {
    const startTime = Date.now();
    const { useCache = true, includeBody = true, depth = 2 } = options;

    // Check cache first
    if (useCache) {
      const cached = await this.getCached(filepath);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
    }

    this.stats.cacheMisses++;

    // Get file overview from Serena
    const overview = await this.serenaTool.getSymbolsOverview(filepath);

    // Build AST from Serena symbols
    const ast = await this.buildAST(filepath, overview, includeBody, depth);

    // Cache result
    if (useCache) {
      await this.setCached(filepath, ast);
    }

    // Update stats
    const analysisTime = Date.now() - startTime;
    this.stats.filesAnalyzed++;
    this.stats.totalAnalysisTime += analysisTime;
    this.stats.averageFileTime = this.stats.totalAnalysisTime / this.stats.filesAnalyzed;

    return ast;
  }

  /**
   * Analyze multiple files in batch
   * Optimized for parallel processing
   *
   * @param filepaths - Array of absolute file paths
   * @param options - Analysis options
   * @returns Array of ASTs
   */
  async analyzeFiles(
    filepaths: string[],
    options: {
      useCache?: boolean;
      includeBody?: boolean;
      depth?: number;
      parallelism?: number;
    } = {}
  ): Promise<AST[]> {
    const { parallelism = 4 } = options;

    // Process files in batches for controlled parallelism
    const results: AST[] = [];
    for (let i = 0; i < filepaths.length; i += parallelism) {
      const batch = filepaths.slice(i, i + parallelism);
      const batchResults = await Promise.all(
        batch.map((filepath) => this.analyzeFile(filepath, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Search for specific symbols across codebase
   * Thin wrapper around Serena's find_symbol
   *
   * @param symbolName - Symbol name or name_path pattern
   * @param options - Search options
   * @returns Array of matching symbols with their AST context
   */
  async findSymbols(
    symbolName: string,
    options: {
      filepath?: string;
      kind?: LSPSymbolKind;
      includeBody?: boolean;
      depth?: number;
    } = {}
  ): Promise<{ symbol: SerenaSymbol; ast: AST }[]> {
    const { filepath = '', kind, includeBody = false, depth = 1 } = options;

    // Query Serena for matching symbols
    const symbols = await this.serenaTool.findSymbol(symbolName, filepath, depth, includeBody);

    // Filter by kind if specified
    const filteredSymbols = kind ? symbols.filter((s) => s.kind === kind) : symbols;

    // Build AST context for each symbol
    const results = await Promise.all(
      filteredSymbols.map(async (symbol) => {
        const ast = await this.analyzeFile(symbol.relative_path, { includeBody, depth });
        return { symbol, ast };
      })
    );

    return results;
  }

  /**
   * Search for code patterns using regex
   * Wrapper around Serena's search_for_pattern
   *
   * @param pattern - Regex pattern to search for
   * @param options - Search options
   * @returns Map of files to matching lines
   */
  async searchPattern(
    pattern: string,
    options: {
      filepath?: string;
      contextLines?: number;
    } = {}
  ): Promise<Map<string, string[]>> {
    const { filepath = '', contextLines = 0 } = options;

    const results = await this.serenaTool.searchPattern(pattern, filepath);

    return new Map(Object.entries(results));
  }

  /**
   * Get analysis statistics
   * Useful for monitoring performance and cache efficiency
   *
   * @returns Current analysis stats
   */
  getStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * Clear analysis cache
   * Use when files have been modified externally
   *
   * @param filepath - Optional: clear cache for specific file, otherwise clear all
   */
  clearCache(filepath?: string): void {
    if (filepath) {
      this.cache.delete(filepath);
    } else {
      this.cache.clear();
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - AST CONSTRUCTION
  // ==========================================================================

  /**
   * Build complete AST from Serena file overview
   */
  private async buildAST(
    filepath: string,
    overview: SerenaFileOverview,
    includeBody: boolean,
    depth: number
  ): Promise<AST> {
    const startTime = Date.now();

    // Determine language from file extension
    const language = this.detectLanguage(filepath);

    // Read file content for AST root.raw (CRITICAL: Rules need this!)
    let fileContent = '';
    let lineCount = 1;
    try {
      fileContent = await fs.readFile(filepath, 'utf-8');
      lineCount = fileContent.split('\n').length;
    } catch (error) {
      logger.error(`Failed to read file ${filepath}:`, error);
    }

    // Build symbol table from Serena symbols
    const symbolTable = await this.buildSymbolTable(overview.symbols, filepath, includeBody, depth);

    // Create root AST node with actual file content
    const root: ASTNode = {
      type: 'TranslationUnit',
      file: filepath,
      line: 1,
      column: 1,
      endLine: lineCount,
      endColumn: 1,
      raw: fileContent, // CRITICAL: Rules need this to analyze code!
      children: [],
    };

    // Extract includes (simplified for now)
    const includes = await this.extractIncludes(filepath);

    // Count lines of code
    const linesOfCode = await this.countLinesOfCode(filepath);

    // Create AST
    const ast: AST = {
      file: filepath,
      language,
      root,
      symbols: symbolTable,
      includes,
      metadata: {
        parseTime: Date.now() - startTime,
        nodeCount: symbolTable.classes.size + symbolTable.functions.size + symbolTable.methods.size + symbolTable.variables.size,
        linesOfCode,
      },

      // Convenience array accessors
      classes: Array.from(symbolTable.classes.values()),
      functions: Array.from(symbolTable.functions.values()),
      methods: Array.from(symbolTable.methods.values()),
      variables: Array.from(symbolTable.variables.values()),
    };

    return ast;
  }

  /**
   * Build symbol table from Serena symbols
   */
  private async buildSymbolTable(
    symbols: SerenaSymbol[],
    filepath: string,
    includeBody: boolean,
    depth: number
  ): Promise<SymbolTable> {
    const symbolTable: SymbolTable = {
      classes: new Map(),
      methods: new Map(),
      functions: new Map(),
      variables: new Map(),
      typedefs: new Map(),
    };

    // Process each top-level symbol
    for (const symbol of symbols) {
      await this.processSymbol(symbol, symbolTable, filepath, includeBody, depth);
    }

    return symbolTable;
  }

  /**
   * Process a single Serena symbol and add to symbol table
   * Recursively processes child symbols
   */
  private async processSymbol(
    symbol: SerenaSymbol,
    symbolTable: SymbolTable,
    filepath: string,
    includeBody: boolean,
    depth: number,
    parentClass?: string
  ): Promise<void> {
    switch (symbol.kind) {
      case LSPSymbolKind.Class:
      case LSPSymbolKind.Struct:
        await this.processClass(symbol, symbolTable, filepath, includeBody, depth);
        break;

      case LSPSymbolKind.Method:
      case LSPSymbolKind.Constructor:
        if (parentClass) {
          await this.processMethod(symbol, symbolTable, filepath, parentClass, includeBody);
        }
        break;

      case LSPSymbolKind.Function:
        await this.processFunction(symbol, symbolTable, filepath, includeBody);
        break;

      case LSPSymbolKind.Variable:
      case LSPSymbolKind.Field:
      case LSPSymbolKind.Property:
        await this.processVariable(symbol, symbolTable, filepath, parentClass);
        break;
    }

    // Process children recursively if within depth limit
    if (symbol.children && depth > 0) {
      for (const child of symbol.children) {
        await this.processSymbol(
          child,
          symbolTable,
          filepath,
          includeBody,
          depth - 1,
          symbol.kind === LSPSymbolKind.Class || symbol.kind === LSPSymbolKind.Struct ? symbol.name : parentClass
        );
      }
    }
  }

  /**
   * Process class symbol
   */
  private async processClass(
    symbol: SerenaSymbol,
    symbolTable: SymbolTable,
    filepath: string,
    includeBody: boolean,
    depth: number
  ): Promise<void> {
    const classSymbol: ClassSymbol = {
      name: symbol.name,
      namespace: this.extractNamespace(symbol.name_path),
      fullyQualifiedName: symbol.name_path,
      file: filepath,
      line: symbol.line,
      column: symbol.column,
      // Extract base classes from signature (e.g., "class Foo : public Bar" -> ["Bar"])
      baseClasses: this.extractBaseClasses(symbol.signature || ''),
      methods: [],
      fields: [],
      accessModifiers: {
        public: [],
        protected: [],
        private: [],
      },
      // Detect abstract class from modifiers or pure virtual methods
      isAbstract: symbol.modifiers?.includes('abstract') || symbol.signature?.includes('= 0') || false,
      isFinal: symbol.modifiers?.includes('final') || false,
      // Detect template parameters (e.g., "template<typename T>" -> true)
      isTemplate: symbol.signature?.includes('template<') || symbol.signature?.includes('template <') || false,
      templateParameters: this.extractTemplateParameters(symbol.signature || ''),

      // Convenience properties
      members: [],
      documentation: symbol.documentation,
      location: {
        file: filepath,
        line: symbol.line,
        column: symbol.column,
        endLine: symbol.end_line,
        endColumn: symbol.end_column,
      },
    };

    // Process children (methods and fields)
    if (symbol.children && depth > 0) {
      for (const child of symbol.children) {
        if (child.kind === LSPSymbolKind.Method || child.kind === LSPSymbolKind.Constructor) {
          const method = await this.convertToMethodSymbol(child, symbol.name, filepath, includeBody);
          classSymbol.methods.push(method);
          symbolTable.methods.set(`${symbol.name}::${child.name}`, method);
        } else if (child.kind === LSPSymbolKind.Field || child.kind === LSPSymbolKind.Property) {
          const field = await this.convertToVariableSymbol(child, filepath, 'class');
          classSymbol.fields.push(field);
          classSymbol.members.push(field);
        }
      }
    }

    symbolTable.classes.set(symbol.name, classSymbol);
  }

  /**
   * Process method symbol
   */
  private async processMethod(
    symbol: SerenaSymbol,
    symbolTable: SymbolTable,
    filepath: string,
    className: string,
    includeBody: boolean
  ): Promise<void> {
    const method = await this.convertToMethodSymbol(symbol, className, filepath, includeBody);
    symbolTable.methods.set(`${className}::${symbol.name}`, method);
  }

  /**
   * Process function symbol
   */
  private async processFunction(
    symbol: SerenaSymbol,
    symbolTable: SymbolTable,
    filepath: string,
    includeBody: boolean
  ): Promise<void> {
    const func = await this.convertToFunctionSymbol(symbol, filepath, includeBody);
    symbolTable.functions.set(symbol.name, func);
  }

  /**
   * Process variable symbol
   */
  private async processVariable(
    symbol: SerenaSymbol,
    symbolTable: SymbolTable,
    filepath: string,
    parentClass?: string
  ): Promise<void> {
    const scope: 'global' | 'class' | 'local' | 'parameter' = parentClass ? 'class' : 'global';
    const variable = await this.convertToVariableSymbol(symbol, filepath, scope);
    symbolTable.variables.set(symbol.name, variable);
  }

  // ==========================================================================
  // SYMBOL CONVERSION HELPERS
  // ==========================================================================

  /**
   * Convert Serena symbol to MethodSymbol
   */
  private async convertToMethodSymbol(
    symbol: SerenaSymbol,
    className: string,
    filepath: string,
    includeBody: boolean
  ): Promise<MethodSymbol> {
    const signature = symbol.signature || '';
    const returnType = this.extractReturnType(signature);
    const parameters = this.extractParameters(signature);

    return {
      name: symbol.name,
      className,
      fullyQualifiedName: `${className}::${symbol.name}`,
      file: filepath,
      line: symbol.line,
      column: symbol.column,
      signature,
      returnType,
      parameters,
      isVirtual: symbol.modifiers?.includes('virtual') || false,
      isOverride: symbol.modifiers?.includes('override') || false,
      isConst: signature.includes(' const'),
      isStatic: symbol.modifiers?.includes('static') || false,
      // Extract access modifier from modifiers or default to public
      accessModifier: this.extractAccessModifier(symbol.modifiers),
      body: includeBody ? symbol.body : undefined,

      // Convenience properties
      visibility: 'public',
      isPureVirtual: signature.includes('= 0'),
      documentation: symbol.documentation,
      location: {
        file: filepath,
        line: symbol.line,
        column: symbol.column,
        endLine: symbol.end_line,
        endColumn: symbol.end_column,
      },
    };
  }

  /**
   * Convert Serena symbol to FunctionSymbol
   */
  private async convertToFunctionSymbol(
    symbol: SerenaSymbol,
    filepath: string,
    includeBody: boolean
  ): Promise<FunctionSymbol> {
    const signature = symbol.signature || '';
    const returnType = this.extractReturnType(signature);
    const parameters = this.extractParameters(signature);

    return {
      name: symbol.name,
      namespace: this.extractNamespace(symbol.name_path),
      fullyQualifiedName: symbol.name_path,
      file: filepath,
      line: symbol.line,
      column: symbol.column,
      signature,
      returnType,
      parameters,
      isStatic: symbol.modifiers?.includes('static') || false,
      isInline: symbol.modifiers?.includes('inline') || false,
      body: includeBody ? symbol.body : undefined,

      // Convenience properties
      documentation: symbol.documentation,
      location: {
        file: filepath,
        line: symbol.line,
        column: symbol.column,
        endLine: symbol.end_line,
        endColumn: symbol.end_column,
      },
      visibility: 'public',
    };
  }

  /**
   * Convert Serena symbol to VariableSymbol
   */
  private async convertToVariableSymbol(
    symbol: SerenaSymbol,
    filepath: string,
    scope: 'global' | 'class' | 'local' | 'parameter'
  ): Promise<VariableSymbol> {
    const type = this.extractType(symbol.signature || '');

    return {
      name: symbol.name,
      type,
      file: filepath,
      line: symbol.line,
      column: symbol.column,
      scope,
      isPointer: type.includes('*'),
      isReference: type.includes('&'),
      isConst: type.includes('const'),
      isStatic: symbol.modifiers?.includes('static') || false,
      // Extract initializer from signature (e.g., "int x = 5" -> "5")
      initializer: this.extractInitializer(symbol.signature || ''),

      // Convenience properties
      location: {
        file: filepath,
        line: symbol.line,
        column: symbol.column,
        endLine: symbol.end_line,
        endColumn: symbol.end_column,
      },
      modifiers: symbol.modifiers || [],
      initialValue: undefined,
      initialization: undefined,
      visibility: 'public',
    };
  }

  // ==========================================================================
  // PARSING HELPERS
  // ==========================================================================

  /**
   * Extract return type from function signature
   */
  private extractReturnType(signature: string): string {
    // Simple heuristic: return type is before function name
    // Example: "void Update()" -> "void"
    const match = signature.match(/^([\w:]+(?:\s*[*&])?)\s+\w+\s*\(/);
    return match ? match[1].trim() : 'void';
  }

  /**
   * Extract parameters from function signature
   */
  private extractParameters(signature: string): ParameterInfo[] {
    // Extract parameter list from signature
    // Example: "void Func(int x, const std::string& name)" -> [...]
    const match = signature.match(/\((.*)\)/);
    if (!match || !match[1].trim()) {
      return [];
    }

    const paramStr = match[1];
    const params = paramStr.split(',').map((p) => p.trim());

    return params.map((param) => {
      const parts = param.split(/\s+/);
      const name = parts[parts.length - 1].replace(/[*&]/g, '');
      const type = parts.slice(0, -1).join(' ');

      // Extract default value (e.g., "int x = 5" -> "5")
      const defaultMatch = param.match(/=\s*(.+)$/);
      const defaultValue = defaultMatch ? defaultMatch[1].trim() : undefined;

      return {
        name,
        type,
        defaultValue,
        isConst: type.includes('const'),
        isReference: type.includes('&'),
        isPointer: type.includes('*'),
      };
    });
  }

  /**
   * Extract type from variable declaration
   */
  private extractType(signature: string): string {
    // Simple heuristic: type is everything before variable name
    const parts = signature.split(/\s+/);
    return parts.slice(0, -1).join(' ');
  }

  /**
   * Extract namespace from name_path
   */
  private extractNamespace(namePath: string): string {
    const parts = namePath.split('/');
    return parts.slice(0, -1).join('::');
  }

  /**
   * Extract #include directives from file
   */
  private async extractIncludes(filepath: string): Promise<IncludeDirective[]> {
    // Use Serena's search_for_pattern to find #include directives
    const pattern = '^\\s*#\\s*include\\s+[<"]([^>"]+)[>"]';
    const results = await this.serenaTool.searchPattern(pattern, filepath);

    const includes: IncludeDirective[] = [];
    for (const [file, lines] of Object.entries(results)) {
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const match = line.match(/#\s*include\s+([<"])([^>"]+)[>"]/);
        if (match) {
          const isSystemInclude = match[1] === '<';
          includes.push({
            file,
            // Serena returns lines as array, use index as line number (1-based)
            line: lineIndex + 1,
            includedFile: match[2],
            isSystemInclude,
            isResolved: false,
          });
        }
      }
    }

    return includes;
  }

  /**
   * Count lines of code in file (approximation)
   */
  private async countLinesOfCode(filepath: string): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filepath, 'utf-8');
      const lines = content.split('\n');

      // Count non-empty, non-comment lines
      let loc = 0;
      let inBlockComment = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Handle block comments
        if (trimmed.startsWith('/*')) {
          inBlockComment = true;
        }
        if (inBlockComment) {
          if (trimmed.includes('*/')) {
            inBlockComment = false;
          }
          continue;
        }

        // Skip single-line comments
        if (trimmed.startsWith('//')) continue;

        // Count as code
        loc++;
      }

      return loc;
    } catch (error) {
      // If file read fails, return 0
      return 0;
    }
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filepath: string): Language {
    const ext = filepath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'hpp':
      case 'hh':
      case 'hxx':
        return 'hpp';
      case 'h':
        return 'h';
      default:
        return 'cpp';
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Extract base classes from class signature
   * e.g., "class Foo : public Bar, private Baz" -> ["Bar", "Baz"]
   */
  private extractBaseClasses(signature: string): string[] {
    const baseClasses: string[] = [];

    // Match patterns like ": public Bar" or ": private Baz, public Qux"
    const match = signature.match(/:\s*(?:public|protected|private)?\s+(\w+(?:\s*,\s*(?:public|protected|private)?\s+\w+)*)/);
    if (match) {
      const bases = match[1].split(',').map(b => b.trim().replace(/^(public|protected|private)\s+/, ''));
      baseClasses.push(...bases);
    }

    return baseClasses;
  }

  /**
   * Extract template parameters from signature
   * e.g., "template<typename T, int N>" -> ["T", "N"]
   */
  private extractTemplateParameters(signature: string): string[] {
    const params: string[] = [];

    // Match template parameters
    const match = signature.match(/template\s*<([^>]+)>/);
    if (match) {
      const paramStr = match[1];
      // Extract parameter names (simplified - handles "typename T" or "int N")
      const paramMatches = paramStr.matchAll(/(?:typename|class|int|size_t)\s+(\w+)/g);
      for (const m of paramMatches) {
        params.push(m[1]);
      }
    }

    return params;
  }

  /**
   * Extract access modifier from modifiers list
   */
  private extractAccessModifier(modifiers?: string[]): 'public' | 'protected' | 'private' {
    if (!modifiers) return 'public';

    if (modifiers.includes('private')) return 'private';
    if (modifiers.includes('protected')) return 'protected';
    return 'public';
  }

  /**
   * Extract initializer from variable signature
   * e.g., "int x = 5" -> "5"
   */
  private extractInitializer(signature: string): string | undefined {
    const match = signature.match(/=\s*(.+?)$/);
    return match ? match[1].trim() : undefined;
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Get cached AST for file
   */
  private async getCached(filepath: string): Promise<AST | null> {
    const entry = this.cache.get(filepath);
    if (!entry) {
      return null;
    }

    // Validate cache entry is still fresh (check file modification time)
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(filepath);
      const fileModTime = stats.mtimeMs;

      // If file was modified after cache entry, invalidate cache
      if (fileModTime > entry.timestamp) {
        this.cache.delete(filepath);
        return null;
      }

      // Also validate file hash if available
      if (entry.fileHash) {
        const currentHash = await this.computeFileHash(filepath);
        if (currentHash !== entry.fileHash) {
          this.cache.delete(filepath);
          return null;
        }
      }

      return entry.ast;
    } catch (error) {
      // If stat fails, assume cache is invalid
      this.cache.delete(filepath);
      return null;
    }
  }

  /**
   * Cache AST for file
   */
  private async setCached(filepath: string, ast: AST): Promise<void> {
    const fileHash = await this.computeFileHash(filepath);

    this.cache.set(filepath, {
      ast,
      timestamp: Date.now(),
      fileHash,
    });
  }

  /**
   * Compute file hash for cache validation
   */
  private async computeFileHash(filepath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const fs = await import('fs/promises');
      const content = await fs.readFile(filepath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return '';
    }
  }
}

// ============================================================================
// FALLBACK FILE PARSER (when Serena unavailable)
// ============================================================================

/**
 * Simple regex-based C++ parser for when Serena is unavailable
 * Extracts namespaces, classes, functions, and POINTER VARIABLES
 */
async function parseFileWithFallback(filepath: string): Promise<SerenaFileOverview> {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    const symbols: SerenaSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract namespace declarations
      const namespaceMatch = line.match(/namespace\s+(\w+)/);
      if (namespaceMatch) {
        symbols.push({
          name: namespaceMatch[1],
          name_path: namespaceMatch[1],
          relative_path: filepath,
          kind: LSPSymbolKind.Namespace,
          line: i + 1,
          column: 0,
        });
      }

      // Extract class/struct declarations
      const classMatch = line.match(/(?:class|struct)\s+(?:\w+\s+)?(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          name_path: classMatch[1],
          relative_path: filepath,
          kind: LSPSymbolKind.Class,
          line: i + 1,
          column: 0,
        });
      }

      // Extract function declarations (simplified)
      const functionMatch = line.match(/^\s*(?:\w+(?:\s*\*|\s*&)?)\s+(\w+)\s*\(/);
      if (functionMatch && !line.includes('if') && !line.includes('while') && !line.includes('for')) {
        symbols.push({
          name: functionMatch[1],
          name_path: functionMatch[1],
          relative_path: filepath,
          kind: LSPSymbolKind.Function,
          line: i + 1,
          column: 0,
        });
      }

      // CRITICAL: Extract pointer variable declarations (Player*, Unit*, etc.)
      const varMatch = line.match(/\b(Player|Unit|Creature|GameObject|WorldSession|Item|Spell|Aura|Group|Guild|Map|BattleGround|InstanceScript)\s*\*\s*(\w+)\s*[;=,)]/);
      if (varMatch) {
        const typeName = varMatch[1];
        const varName = varMatch[2];
        symbols.push({
          name: varName,
          name_path: varName,
          relative_path: filepath,
          kind: LSPSymbolKind.Variable,
          line: i + 1,
          column: 0,
          signature: `${typeName}* ${varName}`,
        });
      }
    }

    logger.info(`⚠️  Fallback parser found ${symbols.length} symbols in ${filepath}`);
    return {
      file: filepath,
      symbols,
      total_symbols: symbols.length,
      top_level_symbols: symbols.length,
    };
  } catch (error) {
    logger.error(`Failed to parse file ${filepath}:`, error);
    return {
      file: filepath,
      symbols: [],
      total_symbols: 0,
      top_level_symbols: 0,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create CodeAnalysisEngine with Serena MCP tools
 *
 * @param serenaMCPClient - Serena MCP client instance
 * @returns Configured CodeAnalysisEngine
 */
export function createCodeAnalysisEngine(serenaMCPClient: any, astData?: any): CodeAnalysisEngine {
  // Wrap Serena MCP tools for CodeAnalysisEngine
  const serenaTool = {
    getSymbolsOverview: async (filepath: string): Promise<SerenaFileOverview> => {
      // If AST data provided, use it instead of calling Serena
      if (astData && astData[filepath]) {
        return astData[filepath] as SerenaFileOverview;
      }

      // Fallback to Serena MCP if available
      if (!serenaMCPClient) {
        logger.info(`⚠️  Serena unavailable, using fallback parser for: ${filepath}`);
        return await parseFileWithFallback(filepath);
      }

      const result = await serenaMCPClient.callTool('mcp__serena__get_symbols_overview', {
        relative_path: filepath,
      });
      return result as SerenaFileOverview;
    },

    findSymbol: async (
      name_path: string,
      filepath: string,
      depth: number,
      includeBody: boolean
    ): Promise<SerenaSymbol[]> => {
      // Return empty if Serena unavailable
      if (!serenaMCPClient) {
        return [];
      }
      const result = await serenaMCPClient.callTool('mcp__serena__find_symbol', {
        name_path,
        relative_path: filepath,
        depth,
        include_body: includeBody,
      });
      return result as SerenaSymbol[];
    },

    searchPattern: async (pattern: string, filepath: string): Promise<{ [file: string]: string[] }> => {
      // Return empty if Serena unavailable
      if (!serenaMCPClient) {
        return {};
      }
      const result = await serenaMCPClient.callTool('mcp__serena__search_for_pattern', {
        substring_pattern: pattern,
        relative_path: filepath,
        output_mode: 'content',
      });
      return result as { [file: string]: string[] };
    },
  };

  return new CodeAnalysisEngine(serenaTool);
}

export default CodeAnalysisEngine;
