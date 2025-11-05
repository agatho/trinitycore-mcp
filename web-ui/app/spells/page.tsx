"use client";

import { useState } from "react";
import { ArrowLeft, Search, Zap, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useMCPTool } from "@/hooks/useMCP";
import { SpellCard } from "./components/SpellCard";
import { SpellFilters } from "./components/SpellFilters";

interface Spell {
  id: number;
  name: string;
  description: string;
  school: string;
  spellLevel: number;
  baseLevel: number;
  maxLevel: number;
  castTime: number;
  cooldown: number;
  range: number;
}

export default function SpellsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [spells, setSpells] = useState<Spell[]>([]);
  const { callTool, loading, error } = useMCPTool<Spell[]>();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setSpells([]);
      return;
    }

    try {
      // Call MCP tool to get spell info
      // For demo purposes, we'll use get-spell-info with a spell ID
      // In production, you'd use a search tool or DBC query
      const spellId = parseInt(searchQuery);

      if (!isNaN(spellId)) {
        const result = await callTool("get-spell-info", { spellId });

        // Convert single spell result to array format
        if (result) {
          setSpells([{
            id: spellId,
            name: (result as any).name || "Unknown Spell",
            description: (result as any).description || "",
            school: (result as any).school || "Unknown",
            spellLevel: (result as any).spellLevel || 0,
            baseLevel: (result as any).baseLevel || 0,
            maxLevel: (result as any).maxLevel || 0,
            castTime: (result as any).castTime || 0,
            cooldown: (result as any).cooldown || 0,
            range: (result as any).range || 0,
          }]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch spell:", err);
      setSpells([]);
    }
  };

  const filteredSpells = spells.filter(spell => {
    if (selectedSchool && spell.school !== selectedSchool) {
      return false;
    }
    return true;
  });

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

            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-5xl font-bold text-white">
                  Spell Browser
                </h1>
                <p className="text-xl text-slate-300 mt-2">
                  Explore <span className="text-purple-400 font-semibold">4,400+ server-side spells</span> from TrinityCore
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search spells by ID (e.g., 133 for Fireball)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-6 text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="px-8 py-6 bg-purple-600 hover:bg-purple-700"
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </form>

            <div className="mt-3 text-sm text-slate-400">
              <p>💡 Tip: Enter a spell ID to view spell details. Server-side spell examples:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setSearchQuery("482")}
                  className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                >
                  482 - Reset
                </button>
                <button
                  onClick={() => setSearchQuery("794")}
                  className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                >
                  794 - Initialize Images
                </button>
                <button
                  onClick={() => setSearchQuery("1177")}
                  className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                >
                  1177 - Twin Empathy
                </button>
                <button
                  onClick={() => setSearchQuery("4051")}
                  className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                >
                  4051 - Explosive Sheep Passive
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Note: Regular player spells (Fireball, Fire Blast, etc.) are stored in client DB2 files and loaded by TrinityCore at runtime.
                The database only contains server-side mechanic spells.
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="bg-red-500/10 border-red-500/30 mb-8">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-red-400 text-xs font-bold">!</span>
                  </div>
                  <div>
                    <h4 className="text-red-400 font-semibold mb-1">Search Error</h4>
                    <p className="text-sm text-slate-400">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Filters */}
            <div className="lg:col-span-1">
              <SpellFilters
                selectedSchool={selectedSchool}
                onSelectSchool={setSelectedSchool}
              />
            </div>

            {/* Main Content - Spell List */}
            <div className="lg:col-span-3">
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-slate-400">Searching spells...</p>
                  </div>
                </div>
              ) : filteredSpells.length === 0 && searchQuery ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-24 text-center">
                    <Zap className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      No spells found
                    </h3>
                    <p className="text-slate-400">
                      Try searching with a different spell ID
                    </p>
                  </CardContent>
                </Card>
              ) : filteredSpells.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-24 text-center">
                    <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Start searching
                    </h3>
                    <p className="text-slate-400">
                      Enter a spell ID above to explore spell data
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-slate-400 mb-4">
                    Showing {filteredSpells.length} spell{filteredSpells.length !== 1 ? "s" : ""}
                  </div>
                  {filteredSpells.map((spell) => (
                    <SpellCard key={spell.id} spell={spell} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
