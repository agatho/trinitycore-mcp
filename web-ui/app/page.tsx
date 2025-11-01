"use client";

import { useState } from "react";
import { Search, Database, Zap, Code, BookOpen, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMCPTools } from "@/hooks/useMCP";
import Link from "next/link";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading, error } = useMCPTools();

  const toolCategories = [
    {
      name: "Spell System",
      icon: Zap,
      description: "Browse spells, effects, and attributes",
      href: "/spells",
      color: "text-purple-500",
    },
    {
      name: "Item Database",
      icon: Database,
      description: "Search items, stats, and equipment",
      href: "/items",
      color: "text-blue-500",
    },
    {
      name: "Creature Data",
      icon: Server,
      description: "Explore NPCs, vendors, and trainers",
      href: "/creatures",
      color: "text-green-500",
    },
    {
      name: "API Playground",
      icon: Code,
      description: "Interactive MCP tool testing",
      href: "/playground",
      color: "text-orange-500",
    },
    {
      name: "Documentation",
      icon: BookOpen,
      description: "Complete API reference (3,812 methods)",
      href: "/docs",
      color: "text-red-500",
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo and Title */}
          <div className="space-y-4">
            <h1 className="text-6xl font-bold text-white tracking-tight">
              TrinityCore
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mt-2">
                API Explorer
              </span>
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Enterprise-grade documentation with{" "}
              <span className="text-blue-400 font-semibold">live MCP integration</span>,
              real-time database access, and interactive API playground
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2">
            {isLoading && (
              <span className="text-sm text-slate-400">Connecting to MCP server...</span>
            )}
            {error && (
              <span className="text-sm text-red-400">
                ⚠️ MCP server unavailable - some features disabled
              </span>
            )}
            {data && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-400 font-medium">
                  MCP Server Online - {data.count} tools available
                </span>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search spells, items, creatures, API methods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
              <Button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700"
              >
                Search
              </Button>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Try: &quot;Fireball&quot;, &quot;Thunderfury&quot;, &quot;Ragnaros&quot;, &quot;Player::CastSpell&quot;
            </p>
          </form>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {toolCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.name} href={category.href}>
                <Card className="h-full bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-slate-700/50 rounded-lg group-hover:scale-110 transition-transform ${category.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-white">{category.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-slate-400">
                      {category.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-blue-400">{data?.count || 56}</div>
              <div className="text-sm text-slate-400">MCP Tools</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-purple-400">3,812</div>
              <div className="text-sm text-slate-400">API Methods</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-green-400">45,000+</div>
              <div className="text-sm text-slate-400">Spells</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-orange-400">Live</div>
              <div className="text-sm text-slate-400">Database</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-slate-800">
        <div className="text-center text-slate-500 text-sm">
          <p>
            TrinityCore API Explorer - Enterprise MCP-Enhanced Documentation
          </p>
          <p className="mt-2">
            Powered by{" "}
            <a
              href="https://github.com/agatho/trinitycore-mcp"
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              TrinityCore MCP Server v1.4.0
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
