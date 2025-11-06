"use client";

import { LucideIcon, Search, Database, Zap, ShoppingBag, Users, FileCode } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import Link from "next/link";

interface ExampleItem {
  label: string;
  value: string | number;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  suggestions?: string[];
  examples?: ExampleItem[];
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  showSearchTips?: boolean;
}

const searchTips = [
  "Use specific IDs for exact matches",
  "Try popular examples from the suggestions",
  "Check the documentation for valid ranges",
  "Ensure the MCP server is running",
];

export function EmptyState({
  icon: Icon = Search,
  title,
  description,
  suggestions = [],
  examples = [],
  actionLabel,
  actionHref,
  onAction,
  showSearchTips = false,
}: EmptyStateProps) {
  return (
    <Card className="bg-slate-800/30 border-slate-700">
      <CardContent className="py-16 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon className="w-8 h-8 text-slate-500" />
        </div>

        {/* Title & Description */}
        <h3 className="text-2xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 max-w-md mx-auto mb-6">{description}</p>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="max-w-lg mx-auto mb-6 text-left">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">What you can try:</h4>
            <ul className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-blue-400 mt-0.5">→</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Examples */}
        {examples.length > 0 && (
          <div className="max-w-lg mx-auto mb-6">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Try these examples:</h4>
            <div className="flex flex-wrap gap-2 justify-center">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={example.onClick}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
                >
                  {example.label}
                  {example.value && (
                    <span className="ml-2 text-blue-400">#{example.value}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Tips */}
        {showSearchTips && (
          <div className="max-w-lg mx-auto mb-6 text-left">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Search Tips:</h4>
            <ul className="space-y-1">
              {searchTips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-500">
                  <span className="mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Button */}
        {(actionLabel || actionHref || onAction) && (
          <div className="flex justify-center gap-3">
            {actionHref ? (
              <Link href={actionHref}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  {actionLabel || "Go to Homepage"}
                </Button>
              </Link>
            ) : (
              <Button onClick={onAction} className="bg-blue-600 hover:bg-blue-700">
                {actionLabel || "Try Again"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Preset Empty States for common scenarios

export function NoSearchResults({ query, onClear }: { query?: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No Results Found"
      description={query ? `No results match "${query}"` : "Your search didn't return any results"}
      suggestions={[
        "Try different search terms",
        "Use specific IDs instead of names",
        "Check the spelling of your query",
        "Browse popular items below",
      ]}
      actionLabel="Clear Search"
      onAction={onClear}
      showSearchTips
    />
  );
}

export function NoSpellsFound({ onTryExample }: { onTryExample?: (id: number) => void }) {
  return (
    <EmptyState
      icon={Zap}
      title="No Spells Found"
      description="Enter a spell ID to view details, or try one of the popular examples below"
      suggestions={[
        "Enter a valid spell ID (e.g., 133, 116, 2120)",
        "Check the spell ID from WoWHead",
        "Use the global search (Cmd/Ctrl + K)",
      ]}
      examples={[
        { label: "Fireball", value: 133, onClick: () => onTryExample?.(133) },
        { label: "Frostbolt", value: 116, onClick: () => onTryExample?.(116) },
        { label: "Pyroblast", value: 11366, onClick: () => onTryExample?.(11366) },
      ]}
      showSearchTips
    />
  );
}

export function NoItemsFound({ onTryExample }: { onTryExample?: (id: number) => void }) {
  return (
    <EmptyState
      icon={ShoppingBag}
      title="No Items Found"
      description="Enter an item ID to view details, or try one of the legendary examples below"
      suggestions={[
        "Enter a valid item ID (e.g., 19019, 17182, 18803)",
        "Check the item ID from WoWHead",
        "Use the global search (Cmd/Ctrl + K)",
      ]}
      examples={[
        { label: "Thunderfury", value: 19019, onClick: () => onTryExample?.(19019) },
        { label: "Sulfuras", value: 17182, onClick: () => onTryExample?.(17182) },
        { label: "Frostmourne", value: 18803, onClick: () => onTryExample?.(18803) },
      ]}
      showSearchTips
    />
  );
}

export function NoCreaturesFound({ onTryExample }: { onTryExample?: (id: number) => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No Creatures Found"
      description="Enter a creature ID to view details, or try one of the famous bosses below"
      suggestions={[
        "Enter a valid creature ID (e.g., 10184, 12435, 11502)",
        "Check the creature ID from WoWHead",
        "Use the global search (Cmd/Ctrl + K)",
      ]}
      examples={[
        { label: "Onyxia", value: 10184, onClick: () => onTryExample?.(10184) },
        { label: "Ragnaros", value: 11502, onClick: () => onTryExample?.(11502) },
        { label: "Lich King", value: 36597, onClick: () => onTryExample?.(36597) },
      ]}
      showSearchTips
    />
  );
}

export function NoDataAvailable() {
  return (
    <EmptyState
      icon={Database}
      title="No Data Available"
      description="The database query returned no results"
      suggestions={[
        "Check the MCP server connection",
        "Verify database configuration",
        "Try a different search query",
        "Return to homepage",
      ]}
      actionLabel="Go to Homepage"
      actionHref="/"
    />
  );
}

export function MCPServerOffline() {
  return (
    <EmptyState
      icon={FileCode}
      title="MCP Server Unavailable"
      description="Unable to connect to the TrinityCore MCP server"
      suggestions={[
        "Ensure the MCP server is running",
        "Check server configuration",
        "Verify database connection",
        "See documentation for setup instructions",
      ]}
      actionLabel="View Documentation"
      actionHref="/docs"
    />
  );
}
