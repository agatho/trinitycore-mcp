"use client";

import { Users, TrendingUp, Shield, ShoppingBag, GraduationCap, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

interface CreatureCardProps {
  creature: Creature;
}

const typeColors: Record<string, string> = {
  "None": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "Beast": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Dragonkin": "bg-red-500/20 text-red-400 border-red-500/30",
  "Demon": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Elemental": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Giant": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Undead": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "Humanoid": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Critter": "bg-green-500/20 text-green-400 border-green-500/30",
  "Mechanical": "bg-slate-500/20 text-slate-400 border-slate-500/30",
  "Not specified": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "Totem": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Non-combat Pet": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "Gas Cloud": "bg-teal-500/20 text-teal-400 border-teal-500/30",
};

const classificationColors: Record<string, string> = {
  "Normal": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "Elite": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Rare Elite": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Boss": "bg-red-500/20 text-red-400 border-red-500/30",
  "Rare": "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function CreatureCard({ creature }: CreatureCardProps) {
  const typeColor = typeColors[creature.typeName] || typeColors["None"];
  const classificationColor = classificationColors[creature.classificationName] || classificationColors["Normal"];

  const levelText = creature.minLevel === creature.maxLevel
    ? creature.minLevel.toString()
    : `${creature.minLevel}-${creature.maxLevel}`;

  return (
    <Link href={`/creatures/${creature.id}`}>
      <Card className="bg-slate-800/50 border-slate-700 hover:border-green-500/50 transition-all cursor-pointer group">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-white group-hover:text-green-400 transition-colors text-xl">
                  {creature.name}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`${typeColor} text-xs px-2 py-0.5`}
                >
                  {creature.typeName}
                </Badge>
                <Badge
                  variant="outline"
                  className={`${classificationColor} text-xs px-2 py-0.5`}
                >
                  {creature.classificationName}
                </Badge>
              </div>
              {creature.subname && (
                <CardDescription className="text-slate-400 mt-2">
                  {creature.subname}
                </CardDescription>
              )}
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className="w-12 h-12 bg-slate-700/50 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <Users className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Level */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Level</div>
                <div className="text-white font-medium">{levelText}</div>
              </div>
            </div>

            {/* Faction */}
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Faction</div>
                <div className="text-white font-medium">{creature.faction}</div>
              </div>
            </div>

            {/* NPC Flags */}
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">NPC Flags</div>
                <div className="text-white font-medium">{creature.npcFlags}</div>
              </div>
            </div>

            {/* Type */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Type ID</div>
                <div className="text-white font-medium">{creature.type}</div>
              </div>
            </div>
          </div>

          {/* NPC Features */}
          {(creature.isVendor || creature.isTrainer || creature.isQuestGiver || creature.isGossip) && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                {creature.isVendor && (
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    <ShoppingBag className="w-3 h-3 mr-1" />
                    Vendor
                  </Badge>
                )}
                {creature.isTrainer && (
                  <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Trainer
                  </Badge>
                )}
                {creature.isQuestGiver && (
                  <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    Quest Giver
                  </Badge>
                )}
                {creature.isGossip && (
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    Gossip
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Creature ID */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Creature ID: {creature.id}</span>
              <span className="text-slate-500">
                Classification: {creature.classification}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
