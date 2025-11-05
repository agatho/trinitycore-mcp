"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Play, History, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useMCPTools, useMCPTool } from "@/hooks/useMCP";
import { MCPTool } from "@/lib/mcp/types";
import { ToolSelector } from "./components/ToolSelector";
import { ParameterForm } from "./components/ParameterForm";
import { ResponseViewer } from "./components/ResponseViewer";
import { ExecutionHistory, HistoryEntry } from "./components/ExecutionHistory";

export default function PlaygroundPage() {
  const { data: toolsData, isLoading: toolsLoading, error: toolsError } = useMCPTools();
  const { callTool, loading: executing, error: executionError, result } = useMCPTool();

  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [response, setResponse] = useState<any>(null);
  const [executionTime, setExecutionTime] = useState<number | undefined>(undefined);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('mcpPlaygroundHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mcpPlaygroundHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }, [history]);

  const handleToolSelect = (tool: MCPTool) => {
    setSelectedTool(tool);
    setParameters({});
    setResponse(null);
    setExecutionTime(undefined);
  };

  const handleExecute = async (params: Record<string, any>) => {
    if (!selectedTool) return;

    const startTime = Date.now();

    try {
      const toolResult = await callTool(selectedTool.name, params);
      const duration = Date.now() - startTime;

      setResponse(toolResult);
      setExecutionTime(duration);

      // Add to history
      const historyEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        toolName: selectedTool.name,
        parameters: params,
        result: toolResult,
        executionTime: duration,
        success: true,
      };

      setHistory(prev => [historyEntry, ...prev].slice(0, 50)); // Keep last 50 entries
    } catch (error) {
      const duration = Date.now() - startTime;

      setResponse(null);
      setExecutionTime(duration);

      // Add error to history
      const historyEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        toolName: selectedTool.name,
        parameters: params,
        result: null,
        executionTime: duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setHistory(prev => [historyEntry, ...prev].slice(0, 50));
    }
  };

  const handleHistoryReplay = (entry: HistoryEntry) => {
    // Find the tool
    const tool = toolsData?.tools.find(t => t.name === entry.toolName);
    if (tool) {
      setSelectedTool(tool);
      setParameters(entry.parameters);
      setResponse(entry.result);
      setExecutionTime(entry.executionTime);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('mcpPlaygroundHistory');
  };

  if (toolsLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-7xl mx-auto text-center">
            <div className="text-slate-400">Loading MCP tools...</div>
          </div>
        </div>
      </main>
    );
  }

  if (toolsError) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-7xl mx-auto">
            <Link href="/">
              <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <FileCode className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">MCP Server Unavailable</h3>
                <p className="text-slate-400">Failed to connect to TrinityCore MCP server</p>
                <p className="text-sm text-red-400 mt-2">{toolsError.message}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  const tools = toolsData?.tools || [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/">
              <Button variant="ghost" className="mb-4 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-5xl font-bold text-white mb-4">
                  Interactive API Playground
                </h1>
                <p className="text-xl text-slate-300">
                  Test <span className="text-blue-400 font-semibold">{tools.length} MCP tools</span> with live execution and real-time results
                </p>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-400 font-medium">
                  MCP Server Online
                </span>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Tool Selector */}
            <div className="lg:col-span-1">
              <ToolSelector
                tools={tools}
                selectedTool={selectedTool}
                onSelectTool={handleToolSelect}
              />
            </div>

            {/* Center - Parameter Form & Response */}
            <div className="lg:col-span-2 space-y-6">
              {selectedTool ? (
                <>
                  {/* Tool Info */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-white font-mono text-lg">
                            {selectedTool.name}
                          </CardTitle>
                          <CardDescription className="mt-2 text-slate-400">
                            {selectedTool.description}
                          </CardDescription>
                        </div>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">
                          {selectedTool.category}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Parameter Form */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <FileCode className="w-5 h-5" />
                        Parameters
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        Configure tool parameters and execute
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ParameterForm
                        tool={selectedTool}
                        onExecute={handleExecute}
                        isExecuting={executing}
                      />
                    </CardContent>
                  </Card>

                  {/* Execution Error */}
                  {executionError && (
                    <Card className="bg-red-500/10 border-red-500/30">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-red-400 text-xs font-bold">!</span>
                          </div>
                          <div>
                            <h4 className="text-red-400 font-semibold mb-1">Execution Error</h4>
                            <p className="text-sm text-slate-400">{executionError}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Response Viewer */}
                  {(response || executing) && (
                    <ResponseViewer
                      response={response}
                      executionTime={executionTime}
                      isLoading={executing}
                    />
                  )}
                </>
              ) : (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-24 text-center">
                    <Play className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Select a tool to begin
                    </h3>
                    <p className="text-slate-400">
                      Choose an MCP tool from the sidebar to start testing
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Sidebar - Execution History */}
            <div className="lg:col-span-1">
              <ExecutionHistory
                history={history}
                onReplay={handleHistoryReplay}
                onClear={handleClearHistory}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
