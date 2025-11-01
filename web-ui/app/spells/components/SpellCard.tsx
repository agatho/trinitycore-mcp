"use client";

import { Clock, Zap, Crosshair, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

interface SpellCardProps {
  spell: Spell;
}

const schoolColors: Record<string, string> = {
  Physical: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Fire: "bg-red-500/20 text-red-400 border-red-500/30",
  Frost: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Arcane: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Nature: "bg-green-500/20 text-green-400 border-green-500/30",
  Shadow: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Holy: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export function SpellCard({ spell }: SpellCardProps) {
  const schoolColor = schoolColors[spell.school] || schoolColors.Physical;

  return (
    <Link href={`/spells/${spell.id}`}>
      <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-white group-hover:text-purple-400 transition-colors text-xl">
                  {spell.name}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`${schoolColor} text-xs px-2 py-0.5`}
                >
                  {spell.school}
                </Badge>
              </div>
              <CardDescription className="text-slate-400 mt-2">
                {spell.description || "No description available"}
              </CardDescription>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className="w-12 h-12 bg-slate-700/50 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Cast Time */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Cast Time</div>
                <div className="text-white font-medium">
                  {spell.castTime > 0 ? `${(spell.castTime / 1000).toFixed(1)}s` : "Instant"}
                </div>
              </div>
            </div>

            {/* Cooldown */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Cooldown</div>
                <div className="text-white font-medium">
                  {spell.cooldown > 0 ? `${(spell.cooldown / 1000).toFixed(1)}s` : "None"}
                </div>
              </div>
            </div>

            {/* Range */}
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Range</div>
                <div className="text-white font-medium">
                  {spell.range > 0 ? `${spell.range} yd` : "Melee"}
                </div>
              </div>
            </div>

            {/* Level */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Level</div>
                <div className="text-white font-medium">
                  {spell.baseLevel > 0 ? spell.baseLevel : "Any"}
                </div>
              </div>
            </div>
          </div>

          {/* Spell ID */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Spell ID: {spell.id}</span>
              <span className="text-slate-500">
                Spell Level: {spell.spellLevel > 0 ? spell.spellLevel : "N/A"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
