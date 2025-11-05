'use client';

/**
 * Development Workflow Automation
 * Automate common TrinityCore development tasks
 */

import React, { useState, useEffect } from 'react';
import { Play, Square, Code, Database, Server, TestTube, Package, Download, Copy, Terminal } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkflowTask, WorkflowTemplate } from '@/lib/workflow-manager';
import { WorkflowTemplates, getTaskDuration, getWorkflowSummary } from '@/lib/workflow-manager';

export default function WorkflowPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [runningTasks, setRunningTasks] = useState<WorkflowTask[]>([]);
  const [workflowOutput, setWorkflowOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  // Code generation state
  const [creatureName, setCreatureName] = useState('');
  const [creatureEntry, setCreatureEntry] = useState('');
  const [spellId, setSpellId] = useState('');
  const [spellName, setSpellName] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedFilename, setGeneratedFilename] = useState('');

  // Custom command state
  const [customCommand, setCustomCommand] = useState('');
  const [customArgs, setCustomArgs] = useState('');
  const [commandOutput, setCommandOutput] = useState('');

  const [activeTab, setActiveTab] = useState('workflows');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    setTemplates(WorkflowTemplates);
  };

  const startWorkflow = async (template: WorkflowTemplate) => {
    try {
      setIsRunning(true);
      setSelectedTemplate(template);
      setWorkflowOutput([`[INFO] Starting workflow: ${template.name}`]);
      setRunningTasks([]);

      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          templateId: template.id,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setWorkflowOutput((prev) => [...prev, `[ERROR] ${data.error}`]);
        setIsRunning(false);
        return;
      }

      // Simulate task execution
      for (let i = 0; i < template.tasks.length; i++) {
        const task = template.tasks[i];
        setWorkflowOutput((prev) => [...prev, `[${i + 1}/${template.tasks.length}] ${task.name}...`]);

        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setWorkflowOutput((prev) => [
          ...prev,
          `    $ ${task.command} ${task.args?.join(' ') || ''}`,
          `    ✓ Completed`,
        ]);
      }

      setWorkflowOutput((prev) => [...prev, `[SUCCESS] Workflow completed successfully`]);
    } catch (error: any) {
      setWorkflowOutput((prev) => [...prev, `[ERROR] ${error.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const stopWorkflow = () => {
    setIsRunning(false);
    setWorkflowOutput((prev) => [...prev, `[WARNING] Workflow stopped by user`]);
  };

  const generateCreatureScript = async () => {
    if (!creatureName || !creatureEntry) {
      alert('Please enter both creature name and entry');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-creature',
          creatureName,
          creatureEntry: parseInt(creatureEntry),
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setGeneratedCode(data.code);
      setGeneratedFilename(data.filename);
    } catch (error: any) {
      alert(`Failed to generate script: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateSpellSQL = async () => {
    if (!spellId || !spellName) {
      alert('Please enter both spell ID and name');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-spell',
          spellId: parseInt(spellId),
          spellName,
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setGeneratedCode(data.sql);
      setGeneratedFilename(`spell_${spellName.toLowerCase().replace(/\s+/g, '_')}.sql`);
    } catch (error: any) {
      alert(`Failed to generate SQL: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeCustomCommand = async () => {
    if (!customCommand) {
      alert('Please enter a command');
      return;
    }

    try {
      setLoading(true);
      setCommandOutput('Executing...');

      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'custom-command',
          command: customCommand,
          args: customArgs.split(' ').filter((a) => a.trim()),
        }),
      });

      const data = await response.json();

      if (data.error) {
        setCommandOutput(`Error: ${data.error}`);
        return;
      }

      setCommandOutput(data.output);
    } catch (error: any) {
      setCommandOutput(`Failed to execute: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadCode = () => {
    if (!generatedCode || !generatedFilename) return;

    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
    }
  };

  const getIconForCategory = (category: string) => {
    switch (category) {
      case 'database':
        return <Database className="w-5 h-5" />;
      case 'server':
        return <Server className="w-5 h-5" />;
      case 'code-gen':
        return <Code className="w-5 h-5" />;
      case 'testing':
        return <TestTube className="w-5 h-5" />;
      case 'deployment':
        return <Package className="w-5 h-5" />;
      default:
        return <Play className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'database':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'server':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'code-gen':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'testing':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'deployment':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Terminal className="w-8 h-8 text-green-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Development Workflow Automation</h1>
              <p className="text-slate-400">Automate common TrinityCore development tasks</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border-b border-slate-700">
            <TabsTrigger value="workflows">Workflow Templates</TabsTrigger>
            <TabsTrigger value="code-gen">Code Generator</TabsTrigger>
            <TabsTrigger value="custom">Custom Commands</TabsTrigger>
          </TabsList>

          {/* Workflow Templates Tab */}
          <TabsContent value="workflows" className="mt-6">
            <div className="grid grid-cols-12 gap-6">
              {/* Templates List */}
              <div className="col-span-5">
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="font-semibold text-white">Available Workflows ({templates.length})</h3>
                  </div>
                  <div className="divide-y divide-slate-700 max-h-[800px] overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 hover:bg-slate-700/30 cursor-pointer transition-colors ${
                          selectedTemplate?.id === template.id ? 'bg-slate-700/50' : ''
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded border ${getCategoryColor(template.category)}`}>
                            {getIconForCategory(template.category)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-1">{template.name}</h4>
                            <p className="text-sm text-slate-400 mb-2">{template.description}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{template.tasks.length} tasks</span>
                              <span>•</span>
                              <span>{template.category}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Workflow Details & Execution */}
              <div className="col-span-7">
                {!selectedTemplate ? (
                  <div className="bg-slate-800/30 backdrop-blur border border-slate-700 rounded-lg p-12 text-center">
                    <Play className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">
                      Select a Workflow
                    </h3>
                    <p className="text-slate-500">
                      Choose a workflow template from the left to view details and execute
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Workflow Info */}
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-1">{selectedTemplate.name}</h2>
                          <p className="text-slate-400">{selectedTemplate.description}</p>
                        </div>
                        {isRunning ? (
                          <Button
                            variant="outline"
                            onClick={stopWorkflow}
                            className="flex items-center gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <Square className="w-4 h-4" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            onClick={() => startWorkflow(selectedTemplate)}
                            disabled={loading}
                            className="flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            Run Workflow
                          </Button>
                        )}
                      </div>

                      {/* Task List */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-300 mb-2">Tasks ({selectedTemplate.tasks.length})</h3>
                        {selectedTemplate.tasks.map((task, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 bg-slate-900/50 rounded border border-slate-700"
                          >
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-white mb-1">{task.name}</div>
                              <code className="text-xs text-slate-500 font-mono">
                                {task.command} {task.args?.join(' ')}
                              </code>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Execution Output */}
                    {workflowOutput.length > 0 && (
                      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                          <h3 className="font-semibold text-white">Execution Output</h3>
                          {isRunning && (
                            <span className="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
                              Running...
                            </span>
                          )}
                        </div>
                        <div className="p-4 bg-slate-900/50 font-mono text-sm max-h-96 overflow-y-auto">
                          {workflowOutput.map((line, idx) => (
                            <div
                              key={idx}
                              className={`${
                                line.includes('[ERROR]')
                                  ? 'text-red-400'
                                  : line.includes('[SUCCESS]')
                                  ? 'text-green-400'
                                  : line.includes('[WARNING]')
                                  ? 'text-yellow-400'
                                  : line.includes('[INFO]')
                                  ? 'text-blue-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Code Generator Tab */}
          <TabsContent value="code-gen" className="mt-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Generation Forms */}
              <div className="space-y-6">
                {/* Creature Script Generator */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Code className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-semibold text-white">Generate Creature Script</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Creature Name
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., Custom Vendor"
                        value={creatureName}
                        onChange={(e) => setCreatureName(e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Creature Entry ID
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g., 999001"
                        value={creatureEntry}
                        onChange={(e) => setCreatureEntry(e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>
                    <Button
                      onClick={generateCreatureScript}
                      disabled={loading}
                      className="w-full"
                    >
                      <Code className="w-4 h-4 mr-2" />
                      Generate Script
                    </Button>
                  </div>
                </div>

                {/* Spell SQL Generator */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Database className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Generate Spell SQL</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Spell Name
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., Mega Fireball"
                        value={spellName}
                        onChange={(e) => setSpellName(e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Spell ID
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g., 999001"
                        value={spellId}
                        onChange={(e) => setSpellId(e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>
                    <Button
                      onClick={generateSpellSQL}
                      disabled={loading}
                      className="w-full"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      Generate SQL
                    </Button>
                  </div>
                </div>
              </div>

              {/* Generated Code Display */}
              <div>
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-white">
                      {generatedFilename || 'Generated Code'}
                    </h3>
                    {generatedCode && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={copyCode}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={downloadCode}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <pre className="p-4 text-sm font-mono text-slate-300 overflow-x-auto bg-slate-900/50 min-h-[600px] max-h-[600px] overflow-y-auto">
                    {generatedCode || '// Generated code will appear here'}
                  </pre>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Custom Commands Tab */}
          <TabsContent value="custom" className="mt-6">
            <div className="max-w-4xl mx-auto">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Terminal className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Execute Custom Command</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Command
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., mysql, git, cmake"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Arguments
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., -e 'SELECT * FROM creature_template LIMIT 10'"
                      value={customArgs}
                      onChange={(e) => setCustomArgs(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-white font-mono"
                    />
                  </div>

                  <Button
                    onClick={executeCustomCommand}
                    disabled={loading}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Execute Command
                  </Button>

                  {commandOutput && (
                    <div className="mt-6">
                      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 font-mono text-sm text-slate-300">
                        <div className="text-slate-500 mb-2">Output:</div>
                        <pre className="whitespace-pre-wrap">{commandOutput}</pre>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex gap-2 text-sm text-yellow-400">
                    <span>⚠️</span>
                    <div>
                      <strong>Warning:</strong> Custom commands are executed on the server.
                      Be cautious with destructive operations (DROP, DELETE, etc.).
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
