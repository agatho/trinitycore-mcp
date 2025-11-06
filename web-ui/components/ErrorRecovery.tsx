"use client";

import { AlertCircle, RefreshCw, Home, HelpCircle, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import Link from "next/link";

interface ErrorRecoveryProps {
  error: Error | string;
  title?: string;
  description?: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
  showHelpLink?: boolean;
  suggestions?: string[];
}

export function ErrorRecovery({
  error,
  title = "An Error Occurred",
  description = "Something went wrong. Please try again.",
  onRetry,
  showHomeButton = true,
  showHelpLink = true,
  suggestions = [
    "Check your internet connection",
    "Verify the MCP server is running",
    "Try refreshing the page",
    "Return to homepage and try again",
  ],
}: ErrorRecoveryProps) {
  const errorMessage = typeof error === "string" ? error : error.message;

  const handleReport = () => {
    const subject = encodeURIComponent("Error Report: TrinityCore MCP Web-UI");
    const body = encodeURIComponent(`
Error: ${errorMessage}

URL: ${typeof window !== "undefined" ? window.location.href : "N/A"}
Timestamp: ${new Date().toISOString()}
User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}
    `.trim());

    window.open(`mailto:support@trinitycore.org?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <Card className="bg-red-500/10 border-red-500/30">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-white text-lg">{title}</CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Message */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm text-red-400 font-mono break-words">
            {errorMessage}
          </p>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Suggested actions:
            </h4>
            <ul className="text-sm text-slate-400 space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-slate-600 mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}

          {showHomeButton && (
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:text-white"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </Link>
          )}

          {showHelpLink && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReport}
              className="text-slate-400 hover:text-white"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Report Issue
            </Button>
          )}

          <Link href="https://docs.trinitycore.org" target="_blank">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Documentation
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
