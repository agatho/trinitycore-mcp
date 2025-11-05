/**
 * PlayerBot AI Behavior Visualizer
 * Analyze and visualize C++ AI code with interactive flowcharts
 */

"use client";

import { useState } from "react";
import { ArrowLeft, Brain, Upload, Download, AlertTriangle, Lightbulb, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMCPTool } from "@/hooks/useMCP";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import mermaid from "mermaid";
import { useEffect, useRef } from "react";

interface AIAnalysisReport {
  summary: {
    totalActions: number;
    totalConditions: number;
    complexity: number;
    issuesFound: number;
    optimizationsAvailable: number;
  };
  decisionTree: any[];
  actionPriorities: Array<{ action: string; priority: number; frequency: number }>;
  issues: Array<{ type: string; severity: string; location: string; description: string }>;
  optimizations: Array<{ type: string; description: string; impact: string }>;
  flowchart?: string;
}

export default function AIVisualizerPage() {
  const [code, setCode] = useState("");
  const [analysis, setAnalysis] = useState<AIAnalysisReport | null>(null);
  const [format, setFormat] = useState<"markdown" | "flowchart">("flowchart");
  const { callTool, loading, error } = useMCPTool();
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#1e40af',
        lineColor: '#64748b',
        secondaryColor: '#8b5cf6',
        tertiaryColor: '#10b981',
      }
    });
  }, []);

  useEffect(() => {
    if (analysis?.flowchart && mermaidRef.current) {
      mermaid.render('mermaid-diagram', analysis.flowchart).then(({ svg }) => {
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = svg;
        }
      });
    }
  }, [analysis?.flowchart]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCode(content);
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!code.trim()) {
      alert('Please provide C++ AI code to analyze');
      return;
    }

    try {
      const result = await callTool("analyze-bot-ai", {
        code,
        outputFormat: format,
        detectIssues: true,
        generateOptimizations: true,
      });

      setAnalysis(result as AIAnalysisReport);
    } catch (err) {
      console.error('AI analysis failed:', err);
      alert('Failed to analyze AI code');
    }
  };

  const handleExport = () => {
    if (!analysis) return;

    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-analysis-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Brain className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold text-white">
                    AI Behavior Visualizer
                  </h1>
                  <p className="text-xl text-slate-300 mt-2">
                    Analyze and visualize <span className="text-purple-400 font-semibold">PlayerBot AI logic</span>
                  </p>
                </div>
              </div>

              {analysis && (
                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Analysis
                </Button>
              )}
            </div>
          </div>

          {/* Input Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload AI Code</CardTitle>
              <CardDescription>
                Upload a C++ file or paste code to analyze decision-making logic
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex-1">
                    <div className="flex items-center justify-center w-full h-32 px-4 transition bg-slate-800 border-2 border-slate-600 border-dashed rounded-md appearance-none cursor-pointer hover:border-purple-400 focus:outline-none">
                      <div className="flex flex-col items-center space-y-2">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="font-medium text-slate-400">
                          Click to upload C++ file
                        </span>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".cpp,.h,.hpp"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Or paste code here:</label>
                  <textarea
                    className="w-full h-64 p-4 bg-slate-800 border border-slate-600 rounded-md font-mono text-sm"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="void UpdateAI(uint32 diff) {&#10;    // Your AI code here&#10;}"
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handleAnalyze}
                    disabled={loading || !code.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    {loading ? 'Analyzing...' : 'Analyze AI'}
                  </Button>

                  <div className="flex items-center gap-2">
                    <label className="text-sm">Output Format:</label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as any)}
                      className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm"
                    >
                      <option value="flowchart">Flowchart</option>
                      <option value="markdown">Markdown</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 p-4 rounded-md">
                    {error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {analysis && (
            <Tabs defaultValue="summary" className="space-y-6">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="flowchart">Flowchart</TabsTrigger>
                <TabsTrigger value="issues">
                  Issues
                  {analysis.summary.issuesFound > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                      {analysis.summary.issuesFound}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="optimizations">
                  Optimizations
                  {analysis.summary.optimizationsAvailable > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                      {analysis.summary.optimizationsAvailable}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="actions">Action Priorities</TabsTrigger>
              </TabsList>

              {/* Summary Tab */}
              <TabsContent value="summary">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{analysis.summary.totalActions}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Conditions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{analysis.summary.totalConditions}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Complexity Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{analysis.summary.complexity}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Issues Found
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-400">
                        {analysis.summary.issuesFound}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Flowchart Tab */}
              <TabsContent value="flowchart">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Decision Flow</CardTitle>
                    <CardDescription>
                      Visual representation of the AI's decision-making logic
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-800 p-6 rounded-lg overflow-auto">
                      <div ref={mermaidRef} className="mermaid-diagram" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Issues Tab */}
              <TabsContent value="issues">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      Detected Issues
                    </CardTitle>
                    <CardDescription>
                      Potential problems found in the AI code
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analysis.issues.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No issues detected</p>
                    ) : (
                      <div className="space-y-4">
                        {analysis.issues.map((issue, index) => (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border ${
                              issue.severity === 'high'
                                ? 'bg-red-500/10 border-red-500/30'
                                : issue.severity === 'medium'
                                ? 'bg-yellow-500/10 border-yellow-500/30'
                                : 'bg-blue-500/10 border-blue-500/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle
                                className={`h-5 w-5 mt-0.5 ${
                                  issue.severity === 'high'
                                    ? 'text-red-400'
                                    : issue.severity === 'medium'
                                    ? 'text-yellow-400'
                                    : 'text-blue-400'
                                }`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{issue.type}</span>
                                  <span className="text-xs px-2 py-0.5 bg-slate-700 rounded-full">
                                    {issue.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {issue.description}
                                </p>
                                <code className="text-xs bg-slate-800 px-2 py-1 rounded">
                                  {issue.location}
                                </code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Optimizations Tab */}
              <TabsContent value="optimizations">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-400" />
                      Optimization Suggestions
                    </CardTitle>
                    <CardDescription>
                      Recommendations to improve AI performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analysis.optimizations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No optimizations suggested
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {analysis.optimizations.map((opt, index) => (
                          <div
                            key={index}
                            className="p-4 rounded-lg border bg-green-500/10 border-green-500/30"
                          >
                            <div className="flex items-start gap-3">
                              <Lightbulb className="h-5 w-5 mt-0.5 text-green-400" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{opt.type}</span>
                                  <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-400 rounded-full">
                                    {opt.impact}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {opt.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Action Priorities Tab */}
              <TabsContent value="actions">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-blue-400" />
                      Action Priority Analysis
                    </CardTitle>
                    <CardDescription>
                      Frequency and priority of AI actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.actionPriorities.map((action, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{action.action}</div>
                            <div className="text-xs text-muted-foreground">
                              Used {action.frequency} times
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-blue-400">
                              Priority: {action.priority}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </main>
  );
}
