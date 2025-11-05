/**
 * AI-Powered Code Review Visualizer
 * Interactive code review with inline suggestions and fix previews
 */

"use client";

import { useState } from "react";
import {
  ArrowLeft,
  FileCode,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  Info,
  Play,
} from "lucide-react";
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
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface ReviewViolation {
  rule: string;
  severity: 'critical' | 'major' | 'minor';
  category: string;
  message: string;
  line: number;
  column?: number;
  suggestion?: string;
  autoFixable: boolean;
}

interface CodeReviewReport {
  summary: {
    totalViolations: number;
    critical: number;
    major: number;
    minor: number;
    linesReviewed: number;
    score: number;
  };
  violations: ReviewViolation[];
  statistics: {
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

export default function CodeReviewPage() {
  const [code, setCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [review, setReview] = useState<CodeReviewReport | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<ReviewViolation | null>(null);
  const [fixedCode, setFixedCode] = useState<string>("");
  const { callTool, loading, error } = useMCPTool();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCode(content);
      };
      reader.readAsText(file);
    }
  };

  const handleReview = async () => {
    if (!code.trim()) {
      alert('Please provide code to review');
      return;
    }

    try {
      const result = await callTool("ai-review-code", {
        code,
        language: fileName.endsWith('.cpp') || fileName.endsWith('.h') ? 'cpp' : 'auto',
        enableAutoFix: true,
      });

      setReview(result as CodeReviewReport);
      setSelectedViolation(null);
    } catch (err) {
      console.error('Code review failed:', err);
      alert('Failed to review code');
    }
  };

  const handleAutoFix = async (violation: ReviewViolation) => {
    if (!violation.autoFixable) return;

    try {
      const result = await callTool("apply-code-fix", {
        code,
        violation,
      });

      setFixedCode(result.fixedCode);
      setSelectedViolation(violation);
    } catch (err) {
      console.error('Auto-fix failed:', err);
      alert('Failed to apply fix');
    }
  };

  const handleApplyFix = () => {
    if (fixedCode) {
      setCode(fixedCode);
      setFixedCode("");
      setSelectedViolation(null);
      // Re-run review
      handleReview();
    }
  };

  const handleExport = () => {
    if (!review) return;

    const blob = new Blob([JSON.stringify(review, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `code-review-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'major':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'minor':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-400" />;
      case 'major':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case 'minor':
        return <Info className="h-5 w-5 text-blue-400" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-400" />;
    }
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
                <div className="p-3 bg-indigo-500/20 rounded-lg">
                  <FileCode className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold text-white">
                    Code Review
                  </h1>
                  <p className="text-xl text-slate-300 mt-2">
                    AI-powered analysis with <span className="text-indigo-400 font-semibold">1020 TrinityCore rules</span>
                  </p>
                </div>
              </div>

              {review && (
                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              )}
            </div>
          </div>

          {/* Input Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload Code</CardTitle>
              <CardDescription>
                Upload a C++ file or paste code for AI-powered review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex-1">
                    <div className="flex items-center justify-center w-full h-32 px-4 transition bg-slate-800 border-2 border-slate-600 border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-400 focus:outline-none">
                      <div className="flex flex-col items-center space-y-2">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="font-medium text-slate-400">
                          Click to upload {fileName || 'C++ file'}
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
                    placeholder="// Your C++ code here"
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handleReview}
                    disabled={loading || !code.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {loading ? 'Reviewing...' : 'Start Review'}
                  </Button>
                </div>

                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 p-4 rounded-md">
                    {error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Review Results */}
          {review && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Code Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${
                      review.summary.score >= 80 ? 'text-green-400' :
                      review.summary.score >= 60 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {review.summary.score}/100
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{review.summary.totalViolations}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Critical
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-400">{review.summary.critical}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Major
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-400">{review.summary.major}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Minor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-400">{review.summary.minor}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Violations List */}
              <Tabs defaultValue="all" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="all">
                    All Issues ({review.summary.totalViolations})
                  </TabsTrigger>
                  <TabsTrigger value="critical">
                    Critical ({review.summary.critical})
                  </TabsTrigger>
                  <TabsTrigger value="major">
                    Major ({review.summary.major})
                  </TabsTrigger>
                  <TabsTrigger value="minor">
                    Minor ({review.summary.minor})
                  </TabsTrigger>
                  <TabsTrigger value="categories">By Category</TabsTrigger>
                </TabsList>

                {(['all', 'critical', 'major', 'minor'] as const).map((tab) => (
                  <TabsContent key={tab} value={tab}>
                    <div className="space-y-4">
                      {review.violations
                        .filter((v) => tab === 'all' || v.severity === tab)
                        .map((violation, index) => (
                          <Card key={index} className={`border ${getSeverityColor(violation.severity)}`}>
                            <CardContent className="pt-6">
                              <div className="flex items-start gap-4">
                                {getSeverityIcon(violation.severity)}
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h4 className="font-semibold mb-1">{violation.rule}</h4>
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {violation.message}
                                      </p>
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>Line {violation.line}</span>
                                        <span>•</span>
                                        <span className="px-2 py-0.5 bg-slate-700 rounded-full">
                                          {violation.category}
                                        </span>
                                        <span className="px-2 py-0.5 bg-slate-700 rounded-full">
                                          {violation.severity}
                                        </span>
                                      </div>
                                    </div>
                                    {violation.autoFixable && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAutoFix(violation)}
                                      >
                                        Auto-Fix
                                      </Button>
                                    )}
                                  </div>
                                  {violation.suggestion && (
                                    <div className="mt-3 p-3 bg-slate-800 rounded-lg">
                                      <div className="text-xs font-medium text-green-400 mb-1">
                                        Suggestion:
                                      </div>
                                      <div className="text-sm">{violation.suggestion}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </TabsContent>
                ))}

                <TabsContent value="categories">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(review.statistics.byCategory).map(([category, count]) => (
                      <Card key={category}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{category}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{count}</div>
                          <div className="text-sm text-muted-foreground">violations</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Fix Preview */}
              {fixedCode && selectedViolation && (
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Fix Preview</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setFixedCode("")}>
                          Cancel
                        </Button>
                        <Button onClick={handleApplyFix} className="bg-green-600 hover:bg-green-700">
                          Apply Fix
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      Fixing: {selectedViolation.rule} at line {selectedViolation.line}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Original</h4>
                        <SyntaxHighlighter
                          language="cpp"
                          style={vscDarkPlus}
                          customStyle={{
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                          }}
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Fixed</h4>
                        <SyntaxHighlighter
                          language="cpp"
                          style={vscDarkPlus}
                          customStyle={{
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                          }}
                        >
                          {fixedCode}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
