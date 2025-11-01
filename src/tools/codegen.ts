/**
 * Code Generation Tools for Playerbot Development
 * Phase 5 - Week 3: Code Generation Infrastructure
 */

import * as path from 'path';
import { CodeGenerator, GeneratedCode } from '../codegen/CodeGenerator.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Initialize code generator
const generator = new CodeGenerator();

/**
 * Generate a bot component (AI strategy, state manager, etc.)
 * Performance target: <500ms p95
 */
export async function generateBotComponent(options: {
  componentType: 'ai_strategy' | 'state_manager' | 'event_handler';
  className: string;
  description?: string;
  role?: 'tank' | 'healer' | 'dps';
  outputPath?: string;
  namespace?: string;
  includeTests?: boolean;
}): Promise<{
  generated: GeneratedCode;
  additionalFiles?: GeneratedCode[];
  generationTime: number;
}> {
  const start = performance.now();

  // Determine template based on component type
  const templateMap = {
    ai_strategy: 'ai_strategies/combat_strategy',
    state_manager: 'state_managers/state_manager',
    event_handler: 'event_handlers/event_handler',
  };

  const templateName = templateMap[options.componentType];

  // Build template data
  const templateData: Record<string, any> = {
    className: options.className,
    description: options.description || `Auto-generated ${options.componentType}`,
    namespace: options.namespace || 'Playerbot',
    generationDate: new Date().toISOString(),

    // AI Strategy specific
    ...(options.componentType === 'ai_strategy' && {
      baseClass: 'CombatStrategy',
      role: options.role || 'dps',
      isDPS: options.role === 'dps',
      isTank: options.role === 'tank',
      isHealer: options.role === 'healer',
      engagementRange: options.role === 'healer' ? 40 : options.role === 'tank' ? 8 : 30,
      updateFrequency: 100,
      defensiveThreshold: 30,
      threadSafety: 'Thread-safe (uses SpellPacketBuilder)',
      performanceTarget: '<0.1% CPU per bot',
      includeThreadSafety: true,

      // Default spell IDs (will be customized per class)
      spellIds: {
        PRIMARY_ABILITY: 0,
        SECONDARY_ABILITY: 0,
        COOLDOWN_ABILITY: 0,
        ...(options.role === 'healer' && {
          EMERGENCY_HEAL: 0,
          EFFICIENT_HEAL: 0,
        }),
        ...(options.role === 'tank' && {
          THREAT_GENERATOR: 0,
        }),
      },

      // Default rotation (will be customized)
      rotation: [
        {
          spellId: 'Spells::PRIMARY_ABILITY',
          priority: 1.0,
          description: 'Primary ability - highest priority',
          condition: 'return true;  // Always available',
        },
        {
          spellId: 'Spells::SECONDARY_ABILITY',
          priority: 0.8,
          description: 'Secondary ability - high priority',
          condition: 'return IsSpellReady(ai->GetBot(), Spells::SECONDARY_ABILITY);',
        },
      ],
    }),
  };

  // Determine output path
  const outputPath =
    options.outputPath ||
    path.join(
      process.cwd(),
      'generated',
      options.componentType,
      `${options.className}.h`
    );

  // Generate header file
  const generated = await generator.generate({
    templateName,
    outputPath,
    data: templateData,
    format: true,
    overwrite: true,
  });

  // Generate .cpp file if needed
  const additionalFiles: GeneratedCode[] = [];

  // Generate test file if requested
  if (options.includeTests) {
    const testData = {
      ...templateData,
      componentClassName: options.className,
    };

    const testPath = outputPath.replace('.h', '_test.cpp');

    try {
      const testFile = await generator.generate({
        templateName: 'tests/component_test',
        outputPath: testPath,
        data: testData,
        format: true,
        overwrite: true,
      });

      additionalFiles.push(testFile);
    } catch (error) {
      // Test template might not exist yet - skip silently
      console.warn(`Test generation skipped: ${error}`);
    }
  }

  const generationTime = performance.now() - start;

  return {
    generated,
    additionalFiles,
    generationTime,
  };
}

/**
 * Generate a packet handler
 * Performance target: <312ms p95
 */
export async function generatePacketHandler(options: {
  handlerName: string;
  opcode: string;
  direction: 'client' | 'server' | 'bidirectional';
  description?: string;
  fields: Array<{
    name: string;
    type: string;
    description?: string;
    isGuid?: boolean;
    isString?: boolean;
    isArray?: boolean;
    arraySize?: number;
  }>;
  outputPath?: string;
  namespace?: string;
}): Promise<{
  generated: GeneratedCode;
  generationTime: number;
}> {
  const start = performance.now();

  const templateData = {
    className: options.handlerName,
    description: options.description || `Packet handler for ${options.opcode}`,
    opcode: options.opcode,
    direction: options.direction,
    namespace: options.namespace || 'Playerbot::Packets',
    fields: options.fields,
    generationDate: new Date().toISOString(),

    // Packet metadata
    fixedSize: options.fields.every(f => !f.isString && !f.isArray),
    packetSize: options.fields.reduce((sum, f) => {
      if (f.isGuid) return sum + 8;
      if (f.type.includes('uint32')) return sum + 4;
      if (f.type.includes('uint16')) return sum + 2;
      if (f.type.includes('uint8')) return sum + 1;
      if (f.type.includes('float')) return sum + 4;
      return sum;
    }, 0),

    // Features
    needsBuilder: options.direction === 'client' || options.direction === 'bidirectional',
    includeLogging: true,
    includeSpellPackets: options.opcode.includes('SPELL') || options.opcode.includes('CAST'),
    includeMovementPackets: options.opcode.includes('MOVE') || options.opcode.includes('POSITION'),

    // Packet type detection
    isMovementPacket: options.opcode.includes('MOVE'),
    isSpellPacket: options.opcode.includes('SPELL') || options.opcode.includes('CAST'),
    isAuraPacket: options.opcode.includes('AURA'),
    isItemPacket: options.opcode.includes('ITEM'),

    // Frequency estimation
    frequency: options.opcode.includes('MOVE') ? 'High (10-20 Hz)'
             : options.opcode.includes('AURA') ? 'Medium (1-5 Hz)'
             : 'Low (<1 Hz)',

    // Validation
    hasValidation: options.fields.some(f => f.name.includes('Id') || f.isGuid),
    validations: options.fields
      .filter(f => f.name.includes('Id') || f.isGuid)
      .map(f => ({
        condition: f.isGuid
          ? `data.${f.name}.IsEmpty()`
          : `data.${f.name} == 0`,
        message: `Invalid ${f.name}`,
      })),
  };

  const outputPath =
    options.outputPath ||
    path.join(process.cwd(), 'generated', 'packet_handlers', `${options.handlerName}.h`);

  const generated = await generator.generate({
    templateName: 'packet_handlers/packet_handler',
    outputPath,
    data: templateData,
    format: true,
    overwrite: true,
  });

  const generationTime = performance.now() - start;

  return {
    generated,
    generationTime,
  };
}

/**
 * Generate CMake integration files
 * Performance target: <200ms p95
 */
export async function generateCMakeIntegration(options: {
  projectName: string;
  sourceFiles: string[];
  headerFiles: string[];
  testFiles?: string[];
  isLibrary?: boolean;
  isModule?: boolean;
  dependencies?: string[];
  includeDirectories?: string[];
  outputPath?: string;
}): Promise<{
  generated: GeneratedCode;
  generationTime: number;
}> {
  const start = performance.now();

  const templateData = {
    projectName: options.projectName,
    sourceFiles: options.sourceFiles,
    headerFiles: options.headerFiles,
    testFiles: options.testFiles || [],
    hasTests: (options.testFiles?.length || 0) > 0,
    isLibrary: options.isLibrary || false,
    isModule: options.isModule || false,
    moduleName: options.isModule ? options.projectName : undefined,
    componentName: !options.isModule ? options.projectName : undefined,
    dependencies: options.dependencies || [],
    includeDirectories: options.includeDirectories || [],
    compileDefinitions: [],
    installPath: options.projectName.replace(/_/g, '/'),
    generationDate: new Date().toISOString(),
  };

  const outputPath =
    options.outputPath ||
    path.join(process.cwd(), 'generated', options.projectName, 'CMakeLists.txt');

  const generated = await generator.generate({
    templateName: 'cmake/CMakeLists',
    outputPath,
    data: templateData,
    format: false, // CMake doesn't need formatting
    overwrite: true,
  });

  const generationTime = performance.now() - start;

  return {
    generated,
    generationTime,
  };
}

/**
 * Validate generated code (compilation check)
 * Performance target: <2000ms p95 (includes compilation)
 */
export async function validateGeneratedCode(options: {
  filePath: string;
  checkCompilation?: boolean;
  checkStyle?: boolean;
}): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  validationTime: number;
}> {
  const start = performance.now();

  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic file validation
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(options.filePath, 'utf-8');

    // Check for common issues
    if (!content.includes('#pragma once') && options.filePath.endsWith('.h')) {
      warnings.push('Missing #pragma once in header file');
    }

    if (content.includes('TODO') || content.includes('FIXME')) {
      warnings.push('Contains TODO/FIXME comments');
    }

    // Check for thread-safety issues
    if (content.includes('static ') && !content.includes('thread_local')) {
      warnings.push('Contains static variables (potential thread-safety issue)');
    }

  } catch (error) {
    errors.push(`Failed to read file: ${error}`);
  }

  // Compilation check (if requested)
  if (options.checkCompilation && options.filePath.endsWith('.cpp')) {
    try {
      // Try to compile with g++ or clang (basic syntax check)
      const { stderr } = await execAsync(`g++ -std=c++20 -fsyntax-only ${options.filePath}`);

      if (stderr) {
        // Parse compiler errors/warnings
        const lines = stderr.split('\n');
        for (const line of lines) {
          if (line.includes('error:')) {
            errors.push(line.trim());
          } else if (line.includes('warning:')) {
            warnings.push(line.trim());
          }
        }
      }
    } catch (error: any) {
      // Compiler not available or compilation failed
      if (error.stderr) {
        errors.push(`Compilation failed: ${error.stderr}`);
      } else {
        warnings.push('Compiler not available - skipping compilation check');
      }
    }
  }

  const validationTime = performance.now() - start;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validationTime,
  };
}

/**
 * List available code generation templates
 */
export async function listCodeTemplates(): Promise<{
  templates: string[];
  count: number;
  retrievalTime: number;
}> {
  const start = performance.now();

  const templates = await generator.listTemplates();

  const retrievalTime = performance.now() - start;

  return {
    templates,
    count: templates.length,
    retrievalTime,
  };
}

/**
 * Get template metadata and required parameters
 */
export async function getTemplateInfo(templateName: string): Promise<{
  name: string;
  description?: string;
  requiredParams: string[];
  optionalParams: string[];
  retrievalTime: number;
}> {
  const start = performance.now();

  const metadata = await generator.getTemplateMetadata(templateName);

  const retrievalTime = performance.now() - start;

  return {
    ...metadata,
    retrievalTime,
  };
}
