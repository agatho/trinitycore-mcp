"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Code, FileText, Link as LinkIcon, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useParams } from "next/navigation";

interface APIMethod {
  method: string;
  className: string;
  methodName: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returns?: {
    type: string;
    description: string;
  };
  usage?: string;
  notes?: string;
  related_methods?: string[];
}

export default function MethodDetailPage() {
  const params = useParams();
  const methodName = decodeURIComponent(params.method as string);
  const [method, setMethod] = useState<APIMethod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/docs/${encodeURIComponent(methodName)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setMethod(data.method);
        } else {
          setError(data.error);
        }
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [methodName]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-slate-400">Loading method documentation...</div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !method) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <Link href="/docs">
              <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Documentation
              </Button>
            </Link>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Method not found</h3>
                <p className="text-slate-400">{error || `Method ${methodName} not found in documentation`}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link href="/docs">
            <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Documentation
            </Button>
          </Link>

          {/* Method Header */}
          <div className="mb-8">
            <div className="mb-4">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">
                {method.className}
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white font-mono mb-4">
              {method.method}
            </h1>
            <p className="text-xl text-slate-300">
              {method.description}
            </p>
          </div>

          {/* Method Details */}
          <div className="space-y-6">
            {/* Parameters */}
            {method.parameters && method.parameters.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Parameters
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {method.parameters.length} parameter{method.parameters.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {method.parameters.map((param, index) => (
                      <div key={index} className="border-l-2 border-blue-500 pl-4">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-mono text-white">{param.name}</span>
                          <span className="text-sm text-slate-500">-</span>
                          <span className="text-sm font-mono text-blue-400">{param.type}</span>
                        </div>
                        <p className="text-sm text-slate-400">{param.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Return Value */}
            {method.returns && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Return Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-l-2 border-green-500 pl-4">
                    <div className="font-mono text-green-400 mb-2">{method.returns.type}</div>
                    <p className="text-slate-400">{method.returns.description}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usage Example */}
            {method.usage && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Usage Example
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto">
                    <code className="text-sm text-slate-300 font-mono">
                      {method.usage}
                    </code>
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {method.notes && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 whitespace-pre-wrap">{method.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Related Methods */}
            {method.related_methods && method.related_methods.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <LinkIcon className="w-5 h-5" />
                    Related Methods
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {method.related_methods.length} related method{method.related_methods.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {method.related_methods.map((relatedMethod, index) => (
                      <Link
                        key={index}
                        href={`/docs/${encodeURIComponent(relatedMethod)}`}
                      >
                        <div className="px-4 py-2 bg-slate-900/50 rounded hover:bg-slate-700/50 transition-colors">
                          <span className="font-mono text-blue-400 hover:text-blue-300">
                            {relatedMethod}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
