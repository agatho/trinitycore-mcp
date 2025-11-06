"use client";

import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, HelpCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import Link from "next/link";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReport = () => {
    const { error } = this.state;
    const subject = encodeURIComponent("Error Report: TrinityCore MCP Web-UI");
    const body = encodeURIComponent(`
Error Message: ${error?.message || "Unknown error"}

Stack Trace:
${error?.stack || "No stack trace available"}

User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
    `.trim());

    window.open(`mailto:support@trinitycore.org?subject=${subject}&body=${body}`, "_blank");
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;

      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full bg-slate-800/50 border-red-500/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-2xl">Something Went Wrong</CardTitle>
                  <CardDescription className="text-slate-400">
                    An unexpected error occurred while rendering this page
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error Message */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Error Details
                </h4>
                <p className="text-sm text-slate-300 font-mono">
                  {error?.message || "Unknown error occurred"}
                </p>
              </div>

              {/* Suggested Actions */}
              <div className="space-y-2">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  What you can do:
                </h4>
                <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                  <li>Try refreshing the page</li>
                  <li>Clear your browser cache and cookies</li>
                  <li>Check if the MCP server is running</li>
                  <li>Return to the homepage and try again</li>
                  <li>Report the issue if it persists</li>
                </ul>
              </div>

              {/* Stack Trace (collapsible) */}
              {error?.stack && (
                <details className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <summary className="text-sm text-slate-400 cursor-pointer hover:text-white">
                    View Stack Trace (for developers)
                  </summary>
                  <pre className="text-xs text-slate-500 mt-2 overflow-x-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap gap-3">
              <Button
                onClick={this.handleRetry}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>

              <Link href="/">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Homepage
                </Button>
              </Link>

              <Button
                variant="outline"
                onClick={this.handleReport}
                className="border-slate-600 text-slate-300 hover:text-white"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
