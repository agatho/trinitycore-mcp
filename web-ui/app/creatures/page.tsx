"use client";

import { useState } from "react";
import { ArrowLeft, Search, Users, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useMCPTool } from "@/hooks/useMCP";
import { CreatureCard } from "./components/CreatureCard";
import { CreatureFilters } from "./components/CreatureFilters";

interface Creature {
  id: number;
  name: string;
  subname: string;
  type: number;
  typeName: string;
  classification: number;
  classificationName: string;
  minLevel: number;
  maxLevel: number;
  faction: number;
  npcFlags: number;
  isVendor: boolean;
  isTrainer: boolean;
  isQuestGiver: boolean;
  isGossip: boolean;
}

const POPULAR_CREATURES = [
  { id: 6491, name: "Spirit Healer" },
  { id: 1, name: "Monstrous Crawler" },
  { id: 721, name: "Rabbit" },
  { id: 14720, name: "High Overlord Saurfang" },
];

export default function CreaturesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedClassification, setSelectedClassification] = useState<number | null>(null);
  const [filterVendor, setFilterVendor] = useState(false);
  const [filterTrainer, setFilterTrainer] = useState(false);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const { callTool, loading, error } = useMCPTool<Creature>();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setCreatures([]);
      return;
    }

    try {
      const creatureId = parseInt(searchQuery);

      if (!isNaN(creatureId)) {
        const result = await callTool("mcp__trinitycore__get-creature-full-info", {
          entry: creatureId,
          includeLoot: false
        });

        if (result) {
          const creatureData = (result as any).creature || result;
          setCreatures([{
            id: creatureId,
            name: creatureData.name || "Unknown Creature",
            subname: creatureData.subname || "",
            type: creatureData.type || 0,
            typeName: getTypeName(creatureData.type || 0),
            classification: creatureData.rank || 0,
            classificationName: getClassificationName(creatureData.rank || 0),
            minLevel: creatureData.minlevel || 1,
            maxLevel: creatureData.maxlevel || 1,
            faction: creatureData.faction || 0,
            npcFlags: creatureData.npcflag || 0,
            isVendor: ((creatureData.npcflag || 0) & 128) !== 0,
            isTrainer: ((creatureData.npcflag || 0) & 16) !== 0,
            isQuestGiver: ((creatureData.npcflag || 0) & 2) !== 0,
            isGossip: ((creatureData.npcflag || 0) & 1) !== 0,
          }]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch creature:", err);
      setCreatures([]);
    }
  };

  const getTypeName = (type: number): string => {
    const types: Record<number, string> = {
      0: "None",
      1: "Beast",
      2: "Dragonkin",
      3: "Demon",
      4: "Elemental",
      5: "Giant",
      6: "Undead",
      7: "Humanoid",
      8: "Critter",
      9: "Mechanical",
      10: "Not specified",
      11: "Totem",
      12: "Non-combat Pet",
      13: "Gas Cloud",
    };
    return types[type] || "Unknown";
  };

  const getClassificationName = (classification: number): string => {
    const classifications: Record<number, string> = {
      0: "Normal",
      1: "Elite",
      2: "Rare Elite",
      3: "Boss",
      4: "Rare",
    };
    return classifications[classification] || "Normal";
  };

  const filteredCreatures = creatures.filter(creature => {
    if (selectedType !== null && creature.type !== selectedType) {
      return false;
    }
    if (selectedClassification !== null && creature.classification !== selectedClassification) {
      return false;
    }
    if (filterVendor && !creature.isVendor) {
      return false;
    }
    if (filterTrainer && !creature.isTrainer) {
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
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Users className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h1 className="text-5xl font-bold text-white">
                  Creature Explorer
                </h1>
                <p className="text-xl text-slate-300 mt-2">
                  Explore <span className="text-green-400 font-semibold">50,000+ NPCs</span> from World of Warcraft
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
                  placeholder="Search creatures by ID (e.g., 6491 for Spirit Healer)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-6 text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="px-8 py-6 bg-green-600 hover:bg-green-700"
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </form>

            <div className="mt-3 text-sm text-slate-400">
              <p>💡 Tip: Enter a creature ID to view creature details. Popular creature IDs:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {POPULAR_CREATURES.map((creature) => (
                  <button
                    key={creature.id}
                    onClick={() => setSearchQuery(creature.id.toString())}
                    className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors text-xs"
                  >
                    {creature.id} - {creature.name}
                  </button>
                ))}
              </div>
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
              <CreatureFilters
                selectedType={selectedType}
                onSelectType={setSelectedType}
                selectedClassification={selectedClassification}
                onSelectClassification={setSelectedClassification}
                filterVendor={filterVendor}
                onFilterVendor={setFilterVendor}
                filterTrainer={filterTrainer}
                onFilterTrainer={setFilterTrainer}
              />
            </div>

            {/* Main Content - Creature List */}
            <div className="lg:col-span-3">
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-slate-400">Searching creatures...</p>
                  </div>
                </div>
              ) : filteredCreatures.length === 0 && searchQuery ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-24 text-center">
                    <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      No creatures found
                    </h3>
                    <p className="text-slate-400">
                      Try searching with a different creature ID
                    </p>
                  </CardContent>
                </Card>
              ) : filteredCreatures.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-24 text-center">
                    <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Start searching
                    </h3>
                    <p className="text-slate-400">
                      Enter a creature ID above to explore creature data
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-slate-400 mb-4">
                    Showing {filteredCreatures.length} creature{filteredCreatures.length !== 1 ? "s" : ""}
                  </div>
                  {filteredCreatures.map((creature) => (
                    <CreatureCard key={creature.id} creature={creature} />
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
