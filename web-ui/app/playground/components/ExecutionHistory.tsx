"use client";

import { History, Clock, CheckCircle, XCircle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  toolName: string;
  parameters: Record<string, any>;
  result: any;
  executionTime: number;
  success: boolean;
  error?: string;
}

interface ExecutionHistoryProps {
  history: HistoryEntry[];
  onReplay: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export function ExecutionHistory({ history, onReplay, onClear }: ExecutionHistoryProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return "Just now";
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // Format as date
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 sticky top-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              History
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {history.length} execution{history.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-slate-400 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No executions yet</p>
            <p className="text-xs mt-1">Run a tool to see it here</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="group relative bg-slate-900/50 rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
                onClick={() => onReplay(entry)}
              >
                {/* Status Icon */}
                <div className="absolute top-3 right-3">
                  {entry.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* Tool Name */}
                <div className="font-mono text-xs text-white mb-1 pr-6 truncate">
                  {entry.toolName.replace("mcp__trinitycore__", "")}
                </div>

                {/* Parameters Preview */}
                <div className="text-xs text-slate-500 mb-2 truncate">
                  {Object.keys(entry.parameters).length > 0 ? (
                    <span>
                      {Object.keys(entry.parameters).length} parameter{Object.keys(entry.parameters).length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span>No parameters</span>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(entry.timestamp)}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-1.5 py-0 ${
                      entry.success
                        ? "bg-green-500/10 text-green-500 border-green-500/30"
                        : "bg-red-500/10 text-red-500 border-red-500/30"
                    }`}
                  >
                    {entry.executionTime}ms
                  </Badge>
                </div>

                {/* Error Message */}
                {entry.error && (
                  <div className="mt-2 text-xs text-red-400 truncate">
                    {entry.error}
                  </div>
                )}

                {/* Replay Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-slate-900/90 rounded-lg transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Replay
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
