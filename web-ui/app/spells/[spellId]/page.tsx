"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Zap, Clock, Crosshair, TrendingUp, Info, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSpell } from "@/hooks/useMCP";

const schoolColors: Record<string, string> = {
  Physical: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Fire: "bg-red-500/20 text-red-400 border-red-500/30",
  Frost: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Arcane: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Nature: "bg-green-500/20 text-green-400 border-green-500/30",
  Shadow: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Holy: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function SpellDetailPage() {
  const params = useParams();
  const spellId = parseInt(params.spellId as string);
  const { data, isLoading, error } = useSpell(spellId);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center py-24">
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400">Loading spell data...</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !data || !data.success) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <Link href="/spells">
              <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Spells
              </Button>
            </Link>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Zap className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Spell not found</h3>
                <p className="text-slate-400">
                  {error?.message || `Spell ID ${spellId} not found in database`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  const spell = data.spell || data.result || data;
  const schoolColor = schoolColors[spell.school] || schoolColors.Physical;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link href="/spells">
            <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Spells
            </Button>
          </Link>

          {/* Spell Header */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-4 bg-purple-500/20 rounded-lg">
                <Zap className="w-12 h-12 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold text-white">
                    {spell.name || "Unknown Spell"}
                  </h1>
                  <Badge variant="outline" className={schoolColor}>
                    {spell.school || "Unknown"}
                  </Badge>
                </div>
                <p className="text-xl text-slate-300">
                  {spell.description || "No description available"}
                </p>
                <div className="mt-3 text-sm text-slate-500">
                  Spell ID: {spellId}
                </div>
              </div>
            </div>
          </div>

          {/* Spell Details */}
          <div className="space-y-6">
            {/* Core Stats */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Core Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Cast Time</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {spell.castTime > 0 ? `${(spell.castTime / 1000).toFixed(1)}s` : "Instant"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Cooldown</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {spell.cooldown > 0 ? `${(spell.cooldown / 1000).toFixed(1)}s` : "None"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Crosshair className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Range</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {spell.range > 0 ? `${spell.range} yards` : "Melee"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Level</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {spell.baseLevel > 0 ? spell.baseLevel : "Any"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Info */}
            {spell.spellLevel !== undefined && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Spell Level</span>
                      <span className="text-white font-medium">
                        {spell.spellLevel > 0 ? spell.spellLevel : "N/A"}
                      </span>
                    </div>
                    {spell.maxLevel !== undefined && spell.maxLevel > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Max Level</span>
                        <span className="text-white font-medium">{spell.maxLevel}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Raw Data */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  Raw Spell Data
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Complete spell information from database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                  <code className="text-sm text-slate-300 font-mono">
                    {JSON.stringify(spell, null, 2)}
                  </code>
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
