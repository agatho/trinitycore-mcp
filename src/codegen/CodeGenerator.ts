/**
 * Code Generator for Playerbot Components
 * Phase 5 - Week 3: Code Generation Infrastructure
 *
 * Uses Handlebars templates to generate C++ code with:
 * - AI Strategies
 * - Packet Handlers
 * - State Managers
 * - CMake integration files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import prettier from 'prettier';
import { logger } from '../utils/logger.js';

export interface CodeGenerationOptions {
  templateName: string;
  outputPath: string;
  data: Record<string, any>;
  format?: boolean;
  overwrite?: boolean;
}

export interface GeneratedCode {
  filePath: string;
  content: string;
  sizeBytes: number;
  linesOfCode: number;
  generationTime: number;
}

export class CodeGenerator {
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private templateBasePath: string;

  constructor(templateBasePath?: string) {
    this.templateBasePath = templateBasePath || path.resolve(__dirname, '../../templates');
    this.registerHelpers();
  }

  /**
   * Register Handlebars helpers for code generation
   */
  private registerHelpers(): void {
    // Helper: Uppercase first letter
    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Helper: Convert to UPPER_SNAKE_CASE
    Handlebars.registerHelper('upperSnake', (str: string) => {
      if (!str) return '';
      return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
    });

    // Helper: Convert to camelCase
    Handlebars.registerHelper('camelCase', (str: string) => {
      if (!str) return '';
      return str.replace(/[-_]([a-z])/g, (g) => g[1].toUpperCase());
    });

    // Helper: Conditional includes based on flags
    Handlebars.registerHelper('ifCond', function (this: any, v1: any, operator: string, v2: any, options: any) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // Helper: Repeat block N times
    Handlebars.registerHelper('repeat', function (this: any, n: number, options: any) {
      let result = '';
      for (let i = 0; i < n; ++i) {
        result += options.fn({ index: i, count: n });
      }
      return result;
    });

    // Helper: Current date/time
    Handlebars.registerHelper('now', () => {
      return new Date().toISOString();
    });

    // Helper: Indent code block
    Handlebars.registerHelper('indent', (text: string, spaces: number) => {
      if (!text) return '';
      const indent = ' '.repeat(spaces);
      return text
        .split('\n')
        .map((line) => (line ? indent + line : line))
        .join('\n');
    });

    // Helper: CMake variable reference (for ${VAR} syntax)
    Handlebars.registerHelper('cmake', (varName: string) => {
      return new Handlebars.SafeString(`\${${varName}}`);
    });
  }

  /**
   * Load and compile a template
   */
  async loadTemplate(templateName: string): Promise<Handlebars.TemplateDelegate> {
    // Check cache first
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!;
    }

    // Determine template file path
    const templatePath = path.join(this.templateBasePath, `${templateName}.hbs`);

    try {
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = Handlebars.compile(templateSource);

      // Cache the compiled template
      this.templates.set(templateName, compiledTemplate);

      return compiledTemplate;
    } catch (error) {
      throw new Error(`Failed to load template "${templateName}": ${error}`);
    }
  }

  /**
   * Generate code from a template
   */
  async generate(options: CodeGenerationOptions): Promise<GeneratedCode> {
    const start = performance.now();

    // Load template
    const template = await this.loadTemplate(options.templateName);

    // Add generation metadata
    const templateData = {
      ...options.data,
      generationDate: new Date().toISOString(),
      generatorVersion: '2.0.0',
    };

    // Generate code
    let code = template(templateData);

    // Format code if requested (C++ only for now)
    if (options.format && (options.outputPath.endsWith('.cpp') || options.outputPath.endsWith('.h'))) {
      try {
        // Use clang-format style for C++
        // Note: prettier doesn't support C++, so we'll do basic formatting
        code = this.basicCppFormat(code);
      } catch (error) {
        logger.warn(`Failed to format code: ${error}`);
      }
    }

    // Calculate metrics
    const sizeBytes = Buffer.byteLength(code, 'utf-8');
    const linesOfCode = code.split('\n').filter((line) => line.trim().length > 0).length;
    const generationTime = performance.now() - start;

    // Write to file if output path specified
    if (options.outputPath) {
      const outputDir = path.dirname(options.outputPath);

      // Create directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });

      // Check if file exists
      const fileExists = await fs
        .access(options.outputPath)
        .then(() => true)
        .catch(() => false);

      if (fileExists && !options.overwrite) {
        throw new Error(`File already exists: ${options.outputPath}. Set overwrite=true to replace.`);
      }

      // Write file
      await fs.writeFile(options.outputPath, code, 'utf-8');
    }

    return {
      filePath: options.outputPath,
      content: code,
      sizeBytes,
      linesOfCode,
      generationTime,
    };
  }

  /**
   * Basic C++ code formatting (since prettier doesn't support C++)
   */
  private basicCppFormat(code: string): string {
    // Remove extra blank lines (max 2 consecutive)
    code = code.replace(/\n{3,}/g, '\n\n');

    // Ensure newline at end of file
    if (!code.endsWith('\n')) {
      code += '\n';
    }

    // Trim trailing whitespace on each line
    code = code
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n');

    return code;
  }

  /**
   * Generate multiple files from templates
   */
  async generateBatch(items: CodeGenerationOptions[]): Promise<GeneratedCode[]> {
    const results: GeneratedCode[] = [];

    for (const item of items) {
      try {
        const result = await this.generate(item);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to generate ${item.outputPath}:`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * List available templates
   */
  async listTemplates(): Promise<string[]> {
    const templates: string[] = [];

    const scanDir = async (dir: string, prefix: string = ''): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await scanDir(fullPath, relativePath);
        } else if (entry.name.endsWith('.hbs')) {
          // Remove .hbs extension
          templates.push(relativePath.replace('.hbs', ''));
        }
      }
    };

    await scanDir(this.templateBasePath);
    return templates.sort();
  }

  /**
   * Get template metadata (parameters, description)
   */
  async getTemplateMetadata(templateName: string): Promise<{
    name: string;
    description?: string;
    requiredParams: string[];
    optionalParams: string[];
  }> {
    const templatePath = path.join(this.templateBasePath, `${templateName}.hbs`);
    const source = await fs.readFile(templatePath, 'utf-8');

    // Extract description from header comment
    const descMatch = source.match(/\* (.+)\n \*\n \* Auto-generated/);
    const description = descMatch ? descMatch[1] : undefined;

    // Extract required parameters ({{variable}})
    const requiredParams = new Set<string>();
    const optionalParams = new Set<string>();

    // Match {{variable}} and {{#if variable}}
    const varMatches = source.matchAll(/{{(?:#if )?([a-zA-Z_][a-zA-Z0-9_]*)/g);
    for (const match of varMatches) {
      const param = match[1];
      if (!param.startsWith('this') && param !== 'each') {
        if (source.includes(`{{#if ${param}}}`)) {
          optionalParams.add(param);
        } else {
          requiredParams.add(param);
        }
      }
    }

    return {
      name: templateName,
      description,
      requiredParams: Array.from(requiredParams).sort(),
      optionalParams: Array.from(optionalParams).sort(),
    };
  }
}
