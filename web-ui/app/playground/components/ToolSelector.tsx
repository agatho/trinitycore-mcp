"use client";

import { useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MCPTool, MCPToolCategory } from "@/lib/mcp/client";
import { Badge } from "@/components/ui/badge";

interface ToolSelectorProps {
  tools: MCPTool[];
  selectedTool: MCPTool | null;
  onSelectTool: (tool: MCPTool) => void;
}

const categoryColors: Record<MCPToolCategory, string> = {
  [MCPToolCategory.SPELL]: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  [MCPToolCategory.ITEM]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  [MCPToolCategory.CREATURE]: "bg-green-500/20 text-green-400 border-green-500/30",
  [MCPToolCategory.QUEST]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  [MCPToolCategory.DATABASE]: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  [MCPToolCategory.COMBAT]: "bg-red-500/20 text-red-400 border-red-500/30",
  [MCPToolCategory.TALENT]: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  [MCPToolCategory.REPUTATION]: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  [MCPToolCategory.ECONOMY]: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  [MCPToolCategory.PVP]: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  [MCPToolCategory.DUNGEON]: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  [MCPToolCategory.LEVELING]: "bg-lime-500/20 text-lime-400 border-lime-500/30",
  [MCPToolCategory.COORDINATION]: "bg-teal-500/20 text-teal-400 border-teal-500/30",
};

export function ToolSelector({ tools, selectedTool, onSelectTool }: ToolSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MCPToolCategory | null>(null);

  // Filter tools by search query and category
  const filteredTools = tools.filter(tool => {
    const matchesSearch = !searchQuery ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory || tool.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Get unique categories with counts
  const categories = Object.values(MCPToolCategory).map(category => ({
    category,
    count: tools.filter(t => t.category === category).length,
  })).filter(({ count }) => count > 0);

  return (
    <Card className="bg-slate-800/50 border-slate-700 sticky top-4">
      <CardHeader>
        <CardTitle className="text-white">Available Tools</CardTitle>
        <CardDescription className="text-slate-400">
          {filteredTools.length} of {tools.length} tools
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Category
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={`cursor-pointer transition-colors ${
                selectedCategory === null
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                  : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
              }`}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Badge>
            {categories.map(({ category, count }) => (
              <Badge
                key={category}
                variant="outline"
                className={`cursor-pointer transition-colors ${
                  selectedCategory === category
                    ? categoryColors[category]
                    : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category} ({count})
              </Badge>
            ))}
          </div>
        </div>

        {/* Tools List */}
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {filteredTools.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No tools found
            </div>
          ) : (
            filteredTools.map((tool) => (
              <button
                key={tool.name}
                onClick={() => onSelectTool(tool)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-all group ${
                  selectedTool?.name === tool.name
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">
                      {tool.name.replace("mcp__trinitycore__", "")}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-1">
                      {tool.description}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${
                    selectedTool?.name === tool.name ? "text-blue-400" : "text-slate-600 group-hover:text-slate-400"
                  }`} />
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
