/**
 * AI Review Engine with GPT-4 Integration
 * Priority #4: Component #13 - Intelligent Code Analysis
 *
 * Enhances rule engine violations with AI-powered analysis:
 * - Contextual understanding of code intent
 * - Detailed explanations of issues
 * - Actionable fix suggestions
 * - Best practice recommendations
 * - Performance and security insights
 *
 * Performance targets:
 * - <2s per violation analysis (cached)
 * - <10s for complex multi-violation analysis
 * - Batch processing support for efficiency
 */

import type {
  RuleViolation,
  CodeContext,
  AST,
  FunctionSymbol,
  MethodSymbol,
  CodeFix,
  FixType,
} from './types';
import { logger } from '../utils/logger';
import type { CodeAnalysisEngine } from './CodeAnalysisEngine';

// ============================================================================
// LLM PROVIDER TYPES
// ============================================================================

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'ollama' | 'lmstudio';

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: LLMProvider;
  endpoint?: string; // Custom endpoint URL
  apiKey?: string; // For OpenAI
  model: string; // Model name
  temperature?: number;
  maxTokens?: number;
}

/**
 * Provider-specific configurations
 */
export const DEFAULT_LLM_CONFIGS: Record<LLMProvider, Partial<LLMConfig>> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 2000,
  },
  ollama: {
    endpoint: 'http://localhost:11434/api/generate',
    model: 'codellama:13b', // Popular code model
    temperature: 0.7,
    maxTokens: 2000,
  },
  lmstudio: {
    endpoint: 'http://localhost:1234/v1/chat/completions',
    model: 'local-model', // User configurable
    temperature: 0.7,
    maxTokens: 2000,
  },
};

// ============================================================================
// AI REVIEW TYPES
// ============================================================================

/**
 * AI-enhanced review result
 * Combines rule violations with AI insights
 */
export interface AIReviewResult {
  originalViolation: RuleViolation;
  enhancedExplanation: string;
  contextualInsights: string[];
  improvedFix?: CodeFix;
  bestPractices: string[];
  relatedIssues: string[];
  confidenceScore: number;
  aiModel: string;
  aiProvider: LLMProvider;
  processingTime: number;
}

/**
 * Batch AI review result
 */
export interface BatchAIReviewResult {
  results: AIReviewResult[];
  summary: {
    totalViolations: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  overallInsights: string[];
  processingTime: number;
}

/**
 * AI review options
 */
export interface AIReviewOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  includeCodeContext?: boolean;
  contextLines?: number;
  generateImprovedFix?: boolean;
  analyzeRelatedCode?: boolean;
  useCache?: boolean;
}

/**
 * LLM API response format (unified across providers)
 */
interface LLMResponse {
  id?: string;
  model: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens: number;
  };
  provider: LLMProvider;
}

/**
 * OpenAI-specific response format
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Ollama-specific response format
 */
interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * LM Studio response format (OpenAI-compatible)
 */
type LMStudioResponse = OpenAIResponse;

/**
 * Parsed AI analysis from GPT-4
 */
interface AIAnalysis {
  enhancedExplanation: string;
  contextualInsights: string[];
  improvedFix?: {
    code: string;
    explanation: string;
  };
  bestPractices: string[];
  relatedIssues: string[];
  confidenceScore: number;
}

// ============================================================================
// CACHE SYSTEM
// ============================================================================

interface CacheEntry {
  result: AIReviewResult;
  timestamp: number;
  expiresAt: number;
}

interface AIReviewStats {
  totalReviews: number;
  cacheHits: number;
  cacheMisses: number;
  totalTokensUsed: number;
  totalCost: number;
  averageProcessingTime: number;
}

// ============================================================================
// AI REVIEW ENGINE
// ============================================================================

export class AIReviewEngine {
  private codeAnalysisEngine: CodeAnalysisEngine;
  private cache: Map<string, CacheEntry> = new Map();
  private stats: AIReviewStats = {
    totalReviews: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalTokensUsed: 0,
    totalCost: 0,
    averageProcessingTime: 0,
  };

  // LLM configuration
  private llmConfig: LLMConfig;
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Initialize AI Review Engine
   *
   * @param codeAnalysisEngine - Code analysis engine for context extraction
   * @param llmConfig - LLM provider configuration (OpenAI, Ollama, or LM Studio)
   */
  constructor(codeAnalysisEngine: CodeAnalysisEngine, llmConfig: LLMConfig) {
    this.codeAnalysisEngine = codeAnalysisEngine;
    this.llmConfig = {
      ...DEFAULT_LLM_CONFIGS[llmConfig.provider],
      ...llmConfig,
    };
  }

  /**
   * Review a single code violation with AI enhancement
   * Main entry point for AI-powered review
   *
   * @param violation - Rule violation from rule engine
   * @param context - Code context
   * @param options - AI review options
   * @returns AI-enhanced review result
   */
  async reviewViolation(
    violation: RuleViolation,
    context: CodeContext,
    options: AIReviewOptions = {}
  ): Promise<AIReviewResult> {
    const startTime = Date.now();
    const {
      provider = this.llmConfig.provider,
      model = this.llmConfig.model,
      temperature = this.llmConfig.temperature || 0.7,
      maxTokens = this.llmConfig.maxTokens || 2000,
      includeCodeContext = true,
      contextLines = 10,
      generateImprovedFix = true,
      analyzeRelatedCode = true,
      useCache = true,
    } = options;

    // Check cache first
    if (useCache) {
      const cached = this.getCached(violation, context);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
    }

    this.stats.cacheMisses++;

    // Build prompt for GPT-4
    const prompt = await this.buildReviewPrompt(violation, context, {
      includeCodeContext,
      contextLines,
      generateImprovedFix,
      analyzeRelatedCode,
    });

    // Call LLM API (supports OpenAI, Ollama, LM Studio)
    const llmResponse = await this.callLLM(prompt, {
      provider,
      model,
      temperature,
      maxTokens,
    });

    // Parse AI analysis
    const analysis = this.parseAIResponse(llmResponse);

    // Build enhanced result
    const result: AIReviewResult = {
      originalViolation: violation,
      enhancedExplanation: analysis.enhancedExplanation,
      contextualInsights: analysis.contextualInsights,
      improvedFix: analysis.improvedFix ? this.buildImprovedFix(analysis.improvedFix, violation, context) : undefined,
      bestPractices: analysis.bestPractices,
      relatedIssues: analysis.relatedIssues,
      confidenceScore: analysis.confidenceScore,
      aiModel: model,
      aiProvider: provider,
      processingTime: Date.now() - startTime,
    };

    // Cache result
    if (useCache) {
      this.setCached(violation, context, result);
    }

    // Update stats
    this.updateStats(llmResponse, result);

    return result;
  }

  /**
   * Review multiple violations in batch
   * Optimized for efficiency with GPT-4 rate limits
   *
   * @param violations - Array of violations to review
   * @param context - Code context
   * @param options - AI review options
   * @returns Batch AI review results
   */
  async reviewViolationsBatch(
    violations: RuleViolation[],
    context: CodeContext,
    options: AIReviewOptions = {}
  ): Promise<BatchAIReviewResult> {
    const startTime = Date.now();

    // Process violations with rate limiting
    const results: AIReviewResult[] = [];
    const batchSize = 5; // Process 5 at a time to respect rate limits

    for (let i = 0; i < violations.length; i += batchSize) {
      const batch = violations.slice(i, i + batchSize);
      const batchPromises = batch.map((violation) => this.reviewViolation(violation, context, options));

      // Wait for batch completion with error handling
      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('AI review failed for violation:', result.reason);
        }
      }

      // Rate limit delay (prevent API throttling)
      if (i + batchSize < violations.length) {
        await this.delay(1000); // 1 second delay between batches
      }
    }

    // Generate summary
    const summary = this.generateSummary(results);

    // Generate overall insights
    const overallInsights = await this.generateOverallInsights(results, context, options);

    return {
      results,
      summary,
      overallInsights,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze code without specific violations
   * General code quality analysis
   *
   * @param filepath - File to analyze
   * @param options - AI review options
   * @returns General code review insights
   */
  async analyzeCodeQuality(
    filepath: string,
    options: AIReviewOptions = {}
  ): Promise<{
    qualityScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    complexity: 'low' | 'medium' | 'high';
  }> {
    // Get file AST
    const ast = await this.codeAnalysisEngine.analyzeFile(filepath);

    // Build quality analysis prompt
    const prompt = this.buildQualityAnalysisPrompt(ast);

    // Call LLM
    const provider = options.provider || this.llmConfig.provider;
    const model = options.model || this.llmConfig.model;
    const response = await this.callLLM(prompt, {
      provider,
      model,
      temperature: 0.7,
      maxTokens: 1500,
    });

    // Parse quality analysis
    return this.parseQualityAnalysis(response);
  }

  /**
   * Get AI review statistics
   *
   * @returns Current statistics
   */
  getStats(): AIReviewStats {
    return { ...this.stats };
  }

  /**
   * Clear review cache
   *
   * @param expiredOnly - Only clear expired entries
   */
  clearCache(expiredOnly: boolean = false): void {
    if (!expiredOnly) {
      this.cache.clear();
      return;
    }

    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - PROMPT ENGINEERING
  // ==========================================================================

  /**
   * Build comprehensive review prompt for GPT-4
   */
  private async buildReviewPrompt(
    violation: RuleViolation,
    context: CodeContext,
    options: {
      includeCodeContext: boolean;
      contextLines: number;
      generateImprovedFix: boolean;
      analyzeRelatedCode: boolean;
    }
  ): Promise<string> {
    let prompt = `You are an expert C++ code reviewer specializing in TrinityCore (World of Warcraft server emulator).

**Code Review Task:**
Analyze the following code violation and provide detailed insights.

**Violation Details:**
- Rule: ${violation.ruleId}
- Severity: ${violation.severity}
- Category: ${violation.metadata.category}
- Message: ${violation.message}
- File: ${violation.file}
- Line: ${violation.line}

`;

    // Add code context if requested
    if (options.includeCodeContext) {
      const codeContext = await this.extractCodeContext(context, options.contextLines);
      prompt += `**Code Context:**
\`\`\`cpp
${codeContext}
\`\`\`

`;
    }

    // Add existing fix if available
    if (violation.suggestedFix) {
      prompt += `**Suggested Fix:**
${violation.suggestedFix.explanation}

\`\`\`cpp
${violation.suggestedFix.codeSnippet?.after || ''}
\`\`\`

`;
    }

    // Add related code analysis if requested
    if (options.analyzeRelatedCode) {
      const relatedCode = await this.findRelatedCode(context);
      if (relatedCode) {
        prompt += `**Related Code:**
${relatedCode}

`;
      }
    }

    // Add specific instructions
    prompt += `**Please provide:**

1. **Enhanced Explanation** (2-3 sentences):
   - Why this is a problem
   - What could go wrong if not fixed
   - Impact on code quality/performance/security

2. **Contextual Insights** (2-4 bullet points):
   - Code context analysis
   - TrinityCore-specific considerations
   - Related patterns in the codebase

3. **Improved Fix** (if applicable):
   ${options.generateImprovedFix ? '- Complete, working code fix\n   - Step-by-step explanation\n   - Why this fix is better' : '- Not requested'}

4. **Best Practices** (2-3 recommendations):
   - TrinityCore coding standards
   - C++20 modern practices
   - Performance considerations

5. **Related Issues** (if any):
   - Other potential problems in the same code
   - Patterns that might need attention

6. **Confidence Score** (0.0-1.0):
   - Your confidence in the analysis

**Format your response as JSON:**
\`\`\`json
{
  "enhancedExplanation": "...",
  "contextualInsights": ["...", "..."],
  "improvedFix": {
    "code": "...",
    "explanation": "..."
  },
  "bestPractices": ["...", "..."],
  "relatedIssues": ["..."],
  "confidenceScore": 0.95
}
\`\`\`
`;

    return prompt;
  }

  /**
   * Build quality analysis prompt (no specific violations)
   */
  private buildQualityAnalysisPrompt(ast: AST): string {
    const classCount = ast.classes.length;
    const functionCount = ast.functions.length;
    const methodCount = ast.methods.length;
    const linesOfCode = ast.metadata.linesOfCode;

    return `You are an expert C++ code reviewer specializing in TrinityCore.

**Code Quality Analysis Task:**
Analyze the following C++ file for overall code quality.

**File Details:**
- File: ${ast.file}
- Language: ${ast.language}
- Classes: ${classCount}
- Functions: ${functionCount}
- Methods: ${methodCount}
- Lines of Code: ${linesOfCode}

**Class Overview:**
${ast.classes.map((c) => `- ${c.name} (${c.methods.length} methods)`).join('\n')}

**Function Overview:**
${ast.functions.map((f) => `- ${f.name}()`).join('\n')}

**Please provide:**

1. **Quality Score** (0-100):
   - Overall code quality rating

2. **Strengths** (3-5 points):
   - What is done well
   - Good patterns observed

3. **Weaknesses** (3-5 points):
   - Areas needing improvement
   - Code smells or anti-patterns

4. **Recommendations** (3-5 specific actions):
   - Concrete improvements to make
   - Prioritized by impact

5. **Complexity Assessment**:
   - Overall complexity: low/medium/high
   - Reasoning

**Format your response as JSON:**
\`\`\`json
{
  "qualityScore": 85,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": ["..."],
  "complexity": "medium"
}
\`\`\`
`;
  }

  // ==========================================================================
  // PRIVATE METHODS - LLM INTEGRATION (OpenAI, Ollama, LM Studio)
  // ==========================================================================

  /**
   * Call LLM API with provider abstraction
   * Supports OpenAI, Ollama, and LM Studio
   */
  private async callLLM(
    prompt: string,
    options: {
      provider: LLMProvider;
      model: string;
      temperature: number;
      maxTokens: number;
    }
  ): Promise<LLMResponse> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        switch (options.provider) {
          case 'openai':
            return await this.callOpenAI(prompt, options);
          case 'ollama':
            return await this.callOllama(prompt, options);
          case 'lmstudio':
            return await this.callLMStudio(prompt, options);
          default:
            throw new Error(`Unsupported LLM provider: ${options.provider}`);
        }
      } catch (error) {
        lastError = error as Error;
        logger.error(`LLM API call failed (attempt ${attempt + 1}/${maxRetries}):`, error);

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`LLM API call failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Call OpenAI API (GPT-4, GPT-3.5)
   */
  private async callOpenAI(
    prompt: string,
    options: {
      model: string;
      temperature: number;
      maxTokens: number;
    }
  ): Promise<LLMResponse> {
    const endpoint = this.llmConfig.endpoint || DEFAULT_LLM_CONFIGS.openai.endpoint!;
    const apiKey = this.llmConfig.apiKey;

    if (!apiKey) {
      throw new Error('OpenAI API key required for OpenAI provider');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert C++ code reviewer specializing in TrinityCore. Provide detailed, actionable code reviews with focus on correctness, performance, and maintainability. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenAIResponse;

    return {
      id: data.id,
      model: data.model,
      content: data.choices[0].message.content,
      usage: data.usage,
      provider: 'openai',
    };
  }

  /**
   * Call Ollama API (local models)
   */
  private async callOllama(
    prompt: string,
    options: {
      model: string;
      temperature: number;
      maxTokens: number;
    }
  ): Promise<LLMResponse> {
    const endpoint = this.llmConfig.endpoint || DEFAULT_LLM_CONFIGS.ollama.endpoint!;

    const systemPrompt = `You are an expert C++ code reviewer specializing in TrinityCore. Provide detailed, actionable code reviews with focus on correctness, performance, and maintainability. Always respond with valid JSON.

${prompt}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OllamaResponse;

    return {
      model: data.model,
      content: data.response,
      usage: {
        prompt_tokens: data.prompt_eval_count,
        completion_tokens: data.eval_count,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      provider: 'ollama',
    };
  }

  /**
   * Call LM Studio API (OpenAI-compatible)
   */
  private async callLMStudio(
    prompt: string,
    options: {
      model: string;
      temperature: number;
      maxTokens: number;
    }
  ): Promise<LLMResponse> {
    const endpoint = this.llmConfig.endpoint || DEFAULT_LLM_CONFIGS.lmstudio.endpoint!;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert C++ code reviewer specializing in TrinityCore. Provide detailed, actionable code reviews with focus on correctness, performance, and maintainability. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as LMStudioResponse;

    return {
      id: data.id,
      model: data.model,
      content: data.choices[0].message.content,
      usage: data.usage,
      provider: 'lmstudio',
    };
  }

  /**
   * Parse LLM JSON response into AIAnalysis
   */
  private parseAIResponse(response: LLMResponse): AIAnalysis {
    try {
      const content = response.content;

      // Extract JSON from response (may be wrapped in markdown code blocks)
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        enhancedExplanation: parsed.enhancedExplanation || 'No explanation provided',
        contextualInsights: parsed.contextualInsights || [],
        improvedFix: parsed.improvedFix || undefined,
        bestPractices: parsed.bestPractices || [],
        relatedIssues: parsed.relatedIssues || [],
        confidenceScore: parsed.confidenceScore || 0.5,
      };
    } catch (error) {
      logger.error('Failed to parse GPT-4 response:', error);
      return {
        enhancedExplanation: 'Failed to parse AI response',
        contextualInsights: [],
        bestPractices: [],
        relatedIssues: [],
        confidenceScore: 0.0,
      };
    }
  }

  /**
   * Parse quality analysis response
   */
  private parseQualityAnalysis(response: LLMResponse): {
    qualityScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    complexity: 'low' | 'medium' | 'high';
  } {
    try {
      const content = response.content;

      // Extract JSON from response
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        qualityScore: parsed.qualityScore || 50,
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        recommendations: parsed.recommendations || [],
        complexity: parsed.complexity || 'medium',
      };
    } catch (error) {
      logger.error('Failed to parse quality analysis:', error);
      return {
        qualityScore: 50,
        strengths: [],
        weaknesses: [],
        recommendations: [],
        complexity: 'medium',
      };
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - CODE CONTEXT EXTRACTION
  // ==========================================================================

  /**
   * Extract code context around violation
   */
  private async extractCodeContext(context: CodeContext, contextLines: number): Promise<string> {
    // Get AST from context
    const ast = context.ast;

    // Try to find code in AST symbols
    if (ast.functions.length > 0 || ast.methods.length > 0) {
      // Return first function/method body as context
      const firstFunc = ast.functions[0] || ast.methods[0];
      if (firstFunc && 'body' in firstFunc && firstFunc.body) {
        return firstFunc.body;
      }
    }

    // Fallback: return placeholder (would need actual file reading)
    return `// Code context at ${context.file}\n// (Context extraction requires file read access)`;
  }

  /**
   * Find related code that might be affected by the violation
   */
  private async findRelatedCode(context: CodeContext): Promise<string | null> {
    try {
      const ast = context.ast;

      // Look for related symbols (callers, callees, similar patterns)
      const related: string[] = [];

      // Add class count
      if (ast.classes.length > 0) {
        related.push(`File contains ${ast.classes.length} classes`);
      }

      // Add function count
      if (ast.functions.length > 0) {
        related.push(`File contains ${ast.functions.length} functions`);
      }

      return related.length > 0 ? related.join('\n') : null;
    } catch (error) {
      logger.error('Failed to find related code:', error);
      return null;
    }
  }

  /**
   * Find symbol containing specific line
   */
  private findSymbolAtLine(ast: AST, line: number): FunctionSymbol | MethodSymbol | null {
    // Check functions
    for (const func of ast.functions) {
      if (func.line <= line && func.location?.endLine && func.location.endLine >= line) {
        return func;
      }
    }

    // Check methods
    for (const method of ast.methods) {
      if (method.line <= line && method.location?.endLine && method.location.endLine >= line) {
        return method;
      }
    }

    return null;
  }

  // ==========================================================================
  // PRIVATE METHODS - RESULT BUILDING
  // ==========================================================================

  /**
   * Build improved CodeFix from AI analysis
   */
  private buildImprovedFix(
    aiFixSuggestion: { code: string; explanation: string },
    violation: RuleViolation,
    context: CodeContext
  ): CodeFix {
    return {
      type: violation.metadata.category as unknown as FixType,
      file: violation.file,
      line: violation.line,
      diff: this.generateDiff(violation, aiFixSuggestion.code),
      explanation: aiFixSuggestion.explanation,
      codeSnippet: {
        before: violation.codeSnippet.before,
        after: aiFixSuggestion.code,
      },
      confidence: 0.85, // AI-generated fixes have slightly lower confidence
      autoApplicable: false, // AI fixes should be reviewed
      estimatedImpact: violation.severity === 'critical' ? 'high' : violation.severity === 'major' ? 'medium' : 'low',
    };
  }

  /**
   * Generate unified diff for fix
   */
  private generateDiff(violation: RuleViolation, newCode: string): string {
    const oldCode = violation.codeSnippet.before;

    return `--- ${violation.file}
+++ ${violation.file}
@@ -${violation.line},1 +${violation.line},1 @@
-${oldCode}
+${newCode}`;
  }

  /**
   * Generate summary from batch results
   */
  private generateSummary(results: AIReviewResult[]): {
    totalViolations: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } {
    const summary = {
      totalViolations: results.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const result of results) {
      const severity = result.originalViolation.severity;
      if (severity === 'critical') summary.critical++;
      else if (severity === 'major') summary.high++;
      else if (severity === 'minor') summary.medium++;
      else summary.low++; // 'info'
    }

    return summary;
  }

  /**
   * Generate overall insights from batch analysis
   */
  private async generateOverallInsights(
    results: AIReviewResult[],
    context: CodeContext,
    options: AIReviewOptions
  ): Promise<string[]> {
    // Extract common themes from individual reviews
    const allInsights = results.flatMap((r) => r.contextualInsights);
    const allBestPractices = results.flatMap((r) => r.bestPractices);

    // Use GPT-4 to synthesize overall insights
    const prompt = `Based on ${results.length} code review violations, synthesize 3-5 overall insights about code quality and common issues.

**Common Insights:**
${allInsights.slice(0, 10).join('\n')}

**Best Practices Mentioned:**
${allBestPractices.slice(0, 10).join('\n')}

Provide 3-5 high-level insights as a JSON array:
\`\`\`json
["insight 1", "insight 2", ...]
\`\`\`
`;

    try {
      const provider = options.provider || this.llmConfig.provider;
      const model = options.model || this.llmConfig.model;
      const response = await this.callLLM(prompt, {
        provider,
        model,
        temperature: 0.7,
        maxTokens: 500,
      });

      const content = response.content;

      // Extract JSON from response
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.error('Failed to generate overall insights:', error);
      return ['Multiple code quality issues detected. Review individual violations for details.'];
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - CACHE & UTILITIES
  // ==========================================================================

  /**
   * Get cached review result
   */
  private getCached(violation: RuleViolation, context: CodeContext): AIReviewResult | null {
    const key = this.getCacheKey(violation, context);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Cache review result
   */
  private setCached(violation: RuleViolation, context: CodeContext, result: AIReviewResult): void {
    const key = this.getCacheKey(violation, context);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.cacheDuration,
    });
  }

  /**
   * Generate cache key from violation and context
   */
  private getCacheKey(violation: RuleViolation, context: CodeContext): string {
    return `${violation.ruleId}:${context.file}:${violation.line}:${violation.message}`;
  }

  /**
   * Update statistics after review
   */
  private updateStats(llmResponse: LLMResponse, result: AIReviewResult): void {
    this.stats.totalReviews++;

    if (llmResponse.usage) {
      this.stats.totalTokensUsed += llmResponse.usage.total_tokens;

      // Cost calculation (only for OpenAI)
      if (llmResponse.provider === 'openai') {
        const costPerToken = llmResponse.model.includes('gpt-4') ? 0.00003 : 0.000002;
        this.stats.totalCost += llmResponse.usage.total_tokens * costPerToken;
      }
      // Ollama and LM Studio are free (local hosting)
    }

    // Update average processing time
    this.stats.averageProcessingTime =
      (this.stats.averageProcessingTime * (this.stats.totalReviews - 1) + result.processingTime) /
      this.stats.totalReviews;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create AIReviewEngine with dependencies
 *
 * @param codeAnalysisEngine - Code analysis engine
 * @param llmConfig - LLM provider configuration
 * @returns Configured AIReviewEngine
 *
 * @example
 * // OpenAI (GPT-4)
 * const engine = createAIReviewEngine(analysisEngine, {
 *   provider: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4-turbo',
 * });
 *
 * @example
 * // Ollama (local)
 * const engine = createAIReviewEngine(analysisEngine, {
 *   provider: 'ollama',
 *   endpoint: 'http://localhost:11434/api/generate',
 *   model: 'codellama:13b',
 * });
 *
 * @example
 * // LM Studio (local)
 * const engine = createAIReviewEngine(analysisEngine, {
 *   provider: 'lmstudio',
 *   endpoint: 'http://localhost:1234/v1/chat/completions',
 *   model: 'local-model',
 * });
 */
export function createAIReviewEngine(codeAnalysisEngine: CodeAnalysisEngine, llmConfig: LLMConfig): AIReviewEngine {
  return new AIReviewEngine(codeAnalysisEngine, llmConfig);
}

export default AIReviewEngine;
