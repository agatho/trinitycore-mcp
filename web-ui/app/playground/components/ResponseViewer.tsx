"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResponseViewerProps {
  response: any;
  executionTime?: number;
  isLoading?: boolean;
}

export function ResponseViewer({ response, executionTime, isLoading }: ResponseViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const jsonString = JSON.stringify(response, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const jsonString = JSON.stringify(response, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-response-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Response</CardTitle>
          <div className="flex items-center gap-4">
            {executionTime !== undefined && (
              <span className="text-sm text-slate-400">
                ⚡ {executionTime}ms
              </span>
            )}
            {!isLoading && response && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-slate-400 hover:text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-400">Executing MCP tool...</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-lg overflow-hidden">
            <pre className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto text-sm">
              <code className="text-slate-300 font-mono">
                {formatJSON(response)}
              </code>
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Format JSON with syntax highlighting
 */
function formatJSON(data: any): string {
  if (data === null || data === undefined) {
    return "null";
  }

  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return String(data);
  }
}
