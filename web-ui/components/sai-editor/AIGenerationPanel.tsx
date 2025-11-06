/**
 * AI Generation Panel Component
 *
 * Generate SAI scripts using multiple AI providers:
 * - OpenAI GPT-4
 * - Ollama (local LLMs)
 * - LM Studio (local API server)
 * - Claude/Anthropic
 */

'use client';

import React, { useState, useEffect } from 'react';
import { SAIScript, AIGenerationRequest, AIGenerationResult, AIModel } from '@/lib/sai-unified/types';
import {
  AIProviderConfig,
  DEFAULT_MODELS,
  createAIProvider,
  validateProvider,
} from '@/lib/sai-unified/ai-providers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, CheckCircle, AlertCircle, Settings, Zap, Server, Cloud } from 'lucide-react';
import { toast } from 'sonner';

interface AIGenerationPanelProps {
  onGenerate: (script: SAIScript) => void;
  className?: string;
}

export const AIGenerationPanel: React.FC<AIGenerationPanelProps> = ({
  onGenerate,
  className = '',
}) => {
  // Provider configuration
  const [provider, setProvider] = useState<AIProviderConfig['provider']>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [useClaudeCodeMax, setUseClaudeCodeMax] = useState(false);

  // Generation state
  const [prompt, setPrompt] = useState('');
  const [creatureEntry, setCreatureEntry] = useState<number>(0);
  const [creatureType, setCreatureType] = useState('');
  const [creatureRank, setCreatureRank] = useState('');
  const [level, setLevel] = useState<number>(0);
  const [additionalContext, setAdditionalContext] = useState('');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<AIGenerationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [isConfigured, setIsConfigured] = useState(false);

  // Load saved configuration
  useEffect(() => {
    const saved = localStorage.getItem('sai-ai-config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setProvider(config.provider || 'openai');
        setApiKey(config.apiKey || '');
        setApiUrl(config.apiUrl || '');
        setSelectedModel(config.model || '');
        setTemperature(config.temperature || 0.7);
        setUseClaudeCodeMax(config.useClaudeCodeMax || false);
      } catch (e) {
        console.error('Failed to load AI config', e);
      }
    }
  }, []);

  // Save configuration
  const saveConfiguration = () => {
    const config: any = {
      provider,
      apiKey,
      apiUrl,
      model: selectedModel,
      temperature,
      useClaudeCodeMax,
    };

    localStorage.setItem('sai-ai-config', JSON.stringify(config));
    setIsConfigured(true);
    toast.success('Configuration saved');
  };

  // Test connection
  const testConnection = async () => {
    const config: AIProviderConfig = {
      provider,
      apiKey,
      apiUrl,
      model: selectedModel,
      temperature,
    };

    try {
      const validation = await validateProvider(config);
      if (validation.valid) {
        toast.success('Connection successful!');
        setIsConfigured(true);
      } else {
        toast.error(`Connection failed: ${validation.error}`);
        setIsConfigured(false);
      }
    } catch (error) {
      toast.error('Connection test failed');
      setIsConfigured(false);
    }
  };

  // Generate script
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResult(null);

    try {
      const config: AIProviderConfig = {
        provider,
        apiKey,
        apiUrl,
        model: selectedModel,
        temperature,
      };

      const aiProvider = createAIProvider(config);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const request: AIGenerationRequest = {
        prompt,
        context: {
          creatureEntry: creatureEntry || undefined,
          creatureType: creatureType || undefined,
          creatureRank: creatureRank || undefined,
          level: level || undefined,
          additionalContext: additionalContext || undefined,
        },
        options: {
          temperature,
        },
      };

      const generationResult = await aiProvider.generateScript(request);

      clearInterval(progressInterval);
      setProgress(100);
      setResult(generationResult);

      if (generationResult.success && generationResult.script) {
        toast.success('Script generated successfully!');
      } else {
        toast.error(generationResult.error || 'Generation failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply generated script
  const applyScript = () => {
    if (result?.script) {
      onGenerate(result.script);
      toast.success('Script applied to editor');
    }
  };

  // Get provider icon
  const getProviderIcon = (prov: string) => {
    switch (prov) {
      case 'openai':
        return <Cloud className="h-4 w-4" />;
      case 'ollama':
        return <Server className="h-4 w-4" />;
      case 'lmstudio':
        return <Server className="h-4 w-4" />;
      case 'claude':
        return <Cloud className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  // Get available models for selected provider
  const availableModels = DEFAULT_MODELS[provider] || [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI-Powered Generation
        </CardTitle>
        <CardDescription>
          Generate SAI scripts using AI (GPT-4, Ollama, LM Studio, Claude)
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            {!isConfigured && (
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Configure your AI provider in Settings first
                </p>
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Script Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe the behavior you want... (e.g., 'A fire mage boss that summons adds at 75%, 50%, and 25% health')"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                disabled={isGenerating}
              />
            </div>

            {/* Context (collapsible) */}
            <details className="space-y-2">
              <summary className="text-sm font-medium cursor-pointer hover:text-blue-600">
                Advanced Context (Optional)
              </summary>
              <div className="space-y-3 mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="creatureEntry" className="text-xs">
                      Creature Entry
                    </Label>
                    <Input
                      id="creatureEntry"
                      type="number"
                      placeholder="0"
                      value={creatureEntry || ''}
                      onChange={(e) => setCreatureEntry(Number(e.target.value))}
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="level" className="text-xs">
                      Level
                    </Label>
                    <Input
                      id="level"
                      type="number"
                      placeholder="0"
                      value={level || ''}
                      onChange={(e) => setLevel(Number(e.target.value))}
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="creatureType" className="text-xs">
                    Creature Type
                  </Label>
                  <Select value={creatureType} onValueChange={setCreatureType} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beast">Beast</SelectItem>
                      <SelectItem value="dragonkin">Dragonkin</SelectItem>
                      <SelectItem value="demon">Demon</SelectItem>
                      <SelectItem value="elemental">Elemental</SelectItem>
                      <SelectItem value="giant">Giant</SelectItem>
                      <SelectItem value="undead">Undead</SelectItem>
                      <SelectItem value="humanoid">Humanoid</SelectItem>
                      <SelectItem value="critter">Critter</SelectItem>
                      <SelectItem value="mechanical">Mechanical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="creatureRank" className="text-xs">
                    Creature Rank
                  </Label>
                  <Select value={creatureRank} onValueChange={setCreatureRank} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rank..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                      <SelectItem value="rare">Rare Elite</SelectItem>
                      <SelectItem value="boss">Boss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="additionalContext" className="text-xs">
                    Additional Context
                  </Label>
                  <Textarea
                    id="additionalContext"
                    placeholder="Any additional context..."
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={2}
                    disabled={isGenerating}
                  />
                </div>
              </div>
            </details>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !isConfigured}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Script
                </>
              )}
            </Button>

            {/* Progress */}
            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-xs text-center text-gray-500">
                  Generating script with {provider.toUpperCase()}...
                </p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-3 p-4 border rounded-lg">
                {result.success ? (
                  <>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-semibold">Generation Successful</span>
                      {result.confidence && (
                        <Badge variant="outline">
                          {Math.round(result.confidence * 100)}% confidence
                        </Badge>
                      )}
                    </div>

                    {result.script && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p>Generated {result.script.nodes.length} nodes</p>
                        <p>
                          Time: {result.generationTime}ms
                          {result.tokensUsed && ` • Tokens: ${result.tokensUsed}`}
                        </p>
                      </div>
                    )}

                    <Button onClick={applyScript} className="w-full">
                      Apply to Editor
                    </Button>

                    {result.suggestions && result.suggestions.length > 0 && (
                      <div className="text-xs space-y-1">
                        <p className="font-medium">Suggestions:</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                          {result.suggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">Generation Failed</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {result.error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>AI Provider</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['openai', 'claude', 'ollama', 'lmstudio'] as const).map((prov) => (
                  <Button
                    key={prov}
                    variant={provider === prov ? 'default' : 'outline'}
                    onClick={() => setProvider(prov)}
                    className="justify-start"
                  >
                    {getProviderIcon(prov)}
                    <span className="ml-2 capitalize">{prov === 'lmstudio' ? 'LM Studio' : prov}</span>
                    {(prov === 'ollama' || prov === 'lmstudio') && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Local
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* API Key (for cloud providers) */}
            {(provider === 'openai' || provider === 'claude') && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  API Key {provider === 'claude' && useClaudeCodeMax && '(Optional Backup)'}
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder={`Enter your ${provider.toUpperCase()} API key${provider === 'claude' && useClaudeCodeMax ? ' (optional backup)' : ''}`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  {provider === 'openai' && 'Get your API key from platform.openai.com'}
                  {provider === 'claude' && !useClaudeCodeMax && 'Get your API key from console.anthropic.com'}
                  {provider === 'claude' && useClaudeCodeMax && 'Optional: Add API key as fallback if Claude Code Max backend is unavailable'}
                </p>

                {provider === 'claude' && (
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="useClaudeCodeMax"
                      checked={useClaudeCodeMax}
                      onChange={(e) => setUseClaudeCodeMax(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label htmlFor="useClaudeCodeMax" className="text-sm font-normal cursor-pointer">
                      I have Claude Code with Max subscription (try first)
                    </Label>
                  </div>
                )}
                {provider === 'claude' && useClaudeCodeMax && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      ℹ️ Will try Claude Code Max first, then fall back to API key if needed. Configure both for maximum reliability!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* API URL (for local providers) */}
            {(provider === 'ollama' || provider === 'lmstudio') && (
              <div className="space-y-2">
                <Label htmlFor="apiUrl">API URL</Label>
                <Input
                  id="apiUrl"
                  type="text"
                  placeholder={
                    provider === 'ollama'
                      ? 'http://localhost:11434'
                      : 'http://localhost:1234'
                  }
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  {provider === 'ollama' && 'Default: http://localhost:11434'}
                  {provider === 'lmstudio' && 'Default: http://localhost:1234'}
                </p>
              </div>
            )}

            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{model.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {(model.contextWindow / 1000).toFixed(0)}K
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <Label htmlFor="temperature">
                Temperature: {temperature.toFixed(2)}
              </Label>
              <input
                id="temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={testConnection} variant="outline" className="flex-1">
                Test Connection
              </Button>
              <Button onClick={saveConfiguration} className="flex-1">
                Save Config
              </Button>
            </div>

            {/* Status */}
            {isConfigured && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Configuration saved and validated
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AIGenerationPanel;
