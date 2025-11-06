/**
 * TrinityCore SAI Unified Editor - AI Provider System
 *
 * Unified abstraction layer for multiple AI providers:
 * - OpenAI GPT-4
 * - Ollama (local LLMs)
 * - LM Studio (local API server)
 * - Claude/Anthropic
 *
 * @module sai-unified/ai-providers
 * @version 3.0.0
 */

import type {
  SAIScript,
  AIGenerationRequest,
  AIGenerationResult,
  AIProvider,
  AIModel,
} from './types';

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export interface AIProviderConfig {
  provider: 'openai' | 'ollama' | 'lmstudio' | 'claude';
  apiKey?: string;
  apiUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  useClaudeCodeMax?: boolean; // For Claude: use Claude Code subscription instead of API key
}

export const DEFAULT_MODELS: Record<AIProviderConfig['provider'], AIModel[]> = {
  openai: [
    { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000 },
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai', contextWindow: 8192 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385 },
  ],
  ollama: [
    { id: 'llama2:70b', name: 'Llama 2 70B', provider: 'ollama', contextWindow: 4096 },
    { id: 'llama2:13b', name: 'Llama 2 13B', provider: 'ollama', contextWindow: 4096 },
    { id: 'llama2:7b', name: 'Llama 2 7B', provider: 'ollama', contextWindow: 4096 },
    { id: 'mistral:latest', name: 'Mistral', provider: 'ollama', contextWindow: 8192 },
    { id: 'codellama:34b', name: 'Code Llama 34B', provider: 'ollama', contextWindow: 16384 },
    { id: 'phi:latest', name: 'Phi-2', provider: 'ollama', contextWindow: 2048 },
  ],
  lmstudio: [
    { id: 'local-model', name: 'Local Model', provider: 'lmstudio', contextWindow: 4096 },
  ],
  claude: [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'claude', contextWindow: 200000 },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'claude', contextWindow: 200000 },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'claude', contextWindow: 200000 },
  ],
};

// ============================================================================
// PROMPT ENGINEERING
// ============================================================================

/**
 * Build system prompt for SAI script generation
 */
export function buildSystemPrompt(): string {
  return `You are an expert TrinityCore Smart AI (SAI) script generator. Your role is to create SAI scripts for World of Warcraft creatures based on descriptions.

SAI SCRIPT STRUCTURE:
- Events: Trigger conditions (91 types: UPDATE_IC, AGGRO, HEALTH_PCT, etc.)
- Actions: What happens (160 types: CAST, TALK, SUMMON_CREATURE, etc.)
- Targets: Who is affected (31 types: SELF, VICTIM, ACTION_INVOKER, etc.)

IMPORTANT RULES:
1. Each script needs at least one event and one action
2. Events trigger actions, actions affect targets
3. Use realistic timers (1000ms = 1 second)
4. For combat NPCs, use UPDATE_IC for spell casting
5. For health-based triggers, use HEALTH_PCT event
6. For dialogue, use TALK action with SELF or ACTION_INVOKER target
7. Cast spells use CAST action with VICTIM or random hostile target
8. Phase systems use SET_EVENT_PHASE action

COMMON PATTERNS:
- Basic Combat: UPDATE_IC → CAST → VICTIM
- Aggro Yell: AGGRO → TALK → SELF
- Health Phase: HEALTH_PCT → SET_EVENT_PHASE → SELF
- Boss Adds: HEALTH_PCT → SUMMON_CREATURE → SELF

Return scripts in JSON format with nodes (events, actions, targets) and connections.`;
}

/**
 * Build user prompt for script generation
 */
export function buildUserPrompt(request: AIGenerationRequest): string {
  let prompt = `Generate a SAI script for the following creature:\n\n`;
  prompt += `DESCRIPTION: ${request.prompt}\n\n`;

  if (request.context) {
    if (request.context.creatureEntry) {
      prompt += `Creature Entry: ${request.context.creatureEntry}\n`;
    }
    if (request.context.creatureType) {
      prompt += `Type: ${request.context.creatureType}\n`;
    }
    if (request.context.creatureRank) {
      prompt += `Rank: ${request.context.creatureRank}\n`;
    }
    if (request.context.level) {
      prompt += `Level: ${request.context.level}\n`;
    }
    if (request.context.faction) {
      prompt += `Faction: ${request.context.faction}\n`;
    }
    if (request.context.additionalContext) {
      prompt += `\nAdditional Context: ${request.context.additionalContext}\n`;
    }
  }

  prompt += `\nGenerate a complete SAI script with appropriate events, actions, and targets. Return ONLY valid JSON.`;

  return prompt;
}

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

export class OpenAIProvider implements AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async generateScript(request: AIGenerationRequest): Promise<AIGenerationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(request) },
          ],
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 2000,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse JSON response
      const script = this.parseScriptFromResponse(content);

      return {
        success: true,
        script,
        confidence: 0.9,
        tokensUsed: data.usage.total_tokens,
        generationTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generationTime: Date.now() - startTime,
      };
    }
  }

  private parseScriptFromResponse(content: string): SAIScript {
    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

    const parsed = JSON.parse(jsonStr);

    // Convert to SAIScript format
    return {
      id: `ai-generated-${Date.now()}`,
      name: parsed.name || 'AI Generated Script',
      entryOrGuid: parsed.entryOrGuid || 0,
      sourceType: parsed.sourceType || 0,
      nodes: parsed.nodes || [],
      connections: parsed.connections || [],
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        description: 'Generated by OpenAI GPT-4',
        tags: ['ai-generated'],
      },
    };
  }
}

// ============================================================================
// OLLAMA PROVIDER
// ============================================================================

export class OllamaProvider implements AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || 'http://localhost:11434',
    };
  }

  async generateScript(request: AIGenerationRequest): Promise<AIGenerationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: `${buildSystemPrompt()}\n\n${buildUserPrompt(request)}`,
          temperature: this.config.temperature || 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.response;

      const script = this.parseScriptFromResponse(content);

      return {
        success: true,
        script,
        confidence: 0.8, // Local models may be less reliable
        generationTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generationTime: Date.now() - startTime,
      };
    }
  }

  private parseScriptFromResponse(content: string): SAIScript {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

    const parsed = JSON.parse(jsonStr);

    return {
      id: `ai-generated-${Date.now()}`,
      name: parsed.name || 'AI Generated Script',
      entryOrGuid: parsed.entryOrGuid || 0,
      sourceType: parsed.sourceType || 0,
      nodes: parsed.nodes || [],
      connections: parsed.connections || [],
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        description: 'Generated by Ollama',
        tags: ['ai-generated', 'local-llm'],
      },
    };
  }
}

// ============================================================================
// LM STUDIO PROVIDER
// ============================================================================

export class LMStudioProvider implements AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || 'http://localhost:1234',
    };
  }

  async generateScript(request: AIGenerationRequest): Promise<AIGenerationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(request) },
          ],
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      const script = this.parseScriptFromResponse(content);

      return {
        success: true,
        script,
        confidence: 0.8,
        tokensUsed: data.usage?.total_tokens,
        generationTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generationTime: Date.now() - startTime,
      };
    }
  }

  private parseScriptFromResponse(content: string): SAIScript {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

    const parsed = JSON.parse(jsonStr);

    return {
      id: `ai-generated-${Date.now()}`,
      name: parsed.name || 'AI Generated Script',
      entryOrGuid: parsed.entryOrGuid || 0,
      sourceType: parsed.sourceType || 0,
      nodes: parsed.nodes || [],
      connections: parsed.connections || [],
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        description: 'Generated by LM Studio',
        tags: ['ai-generated', 'local-llm'],
      },
    };
  }
}

// ============================================================================
// CLAUDE/ANTHROPIC PROVIDER
// ============================================================================

export class ClaudeProvider implements AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async generateScript(request: AIGenerationRequest): Promise<AIGenerationResult> {
    const startTime = Date.now();

    try {
      // Try Claude Code Max subscription first (if enabled)
      if (this.config.useClaudeCodeMax) {
        const backendUrl = this.config.apiUrl || 'http://localhost:3001/api/claude-generate';

        try {
          const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.config.model,
              max_tokens: this.config.maxTokens || 4096,
              system: buildSystemPrompt(),
              messages: [
                { role: 'user', content: buildUserPrompt(request) },
              ],
              temperature: this.config.temperature || 0.7,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.content[0].text;
            const script = this.parseScriptFromResponse(content);

            return {
              success: true,
              script,
              confidence: 0.95,
              tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
              generationTime: Date.now() - startTime,
            };
          }

          // Backend not available, fall through to API key method
          console.log('Claude Code Max backend not available, falling back to API key method...');
        } catch (backendError) {
          // Backend error, fall through to API key method
          console.log('Claude Code Max backend error:', backendError, '- falling back to API key method...');
        }

        // If we have an API key as backup, fall through to use it
        if (!this.config.apiKey) {
          return {
            success: false,
            error: 'Claude Code Max backend is not available and no API key is configured. Please either: (1) Set up a backend server at http://localhost:3001/api/claude-generate, or (2) Add your Anthropic API key as a backup.',
            generationTime: Date.now() - startTime,
          };
        }

        // Continue to API key method below...
      }

      // Standard Anthropic API (Method 2 or fallback from Method 1)
      if (!this.config.apiKey) {
        return {
          success: false,
          error: 'No Anthropic API key provided. Please configure your API key in Settings.',
          generationTime: Date.now() - startTime,
        };
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens || 4096,
          system: buildSystemPrompt(),
          messages: [
            { role: 'user', content: buildUserPrompt(request) },
          ],
          temperature: this.config.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Claude API error');
      }

      const data = await response.json();
      const content = data.content[0].text;

      const script = this.parseScriptFromResponse(content);

      return {
        success: true,
        script,
        confidence: 0.95, // Claude is very reliable
        tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
        generationTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generationTime: Date.now() - startTime,
      };
    }
  }

  private parseScriptFromResponse(content: string): SAIScript {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

    const parsed = JSON.parse(jsonStr);

    return {
      id: `ai-generated-${Date.now()}`,
      name: parsed.name || 'AI Generated Script',
      entryOrGuid: parsed.entryOrGuid || 0,
      sourceType: parsed.sourceType || 0,
      nodes: parsed.nodes || [],
      connections: parsed.connections || [],
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        description: 'Generated by Claude',
        tags: ['ai-generated', 'claude'],
      },
    };
  }
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'lmstudio':
      return new LMStudioProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

export async function validateProvider(config: AIProviderConfig): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const provider = createAIProvider(config);

    // Test with minimal request
    const result = await provider.generateScript({
      prompt: 'Test connection',
      options: { maxTokens: 10 },
    });

    return {
      valid: result.success || result.error?.includes('Test') || false,
      error: result.error,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
