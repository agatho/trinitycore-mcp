"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Users, TrendingUp, Shield, Info, Code, ShoppingBag, GraduationCap, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCreature } from "@/hooks/useMCP";

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
};

const classificationColors: Record<string, string> = {
  "Normal": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "Elite": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Rare Elite": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Boss": "bg-red-500/20 text-red-400 border-red-500/30",
  "Rare": "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function CreatureDetailPage() {
  const params = useParams();
  const creatureId = parseInt(params.creatureId as string);
  const { data, isLoading, error } = useCreature(creatureId);

  const getTypeName = (type: number): string => {
    const types: Record<number, string> = {
      0: "None", 1: "Beast", 2: "Dragonkin", 3: "Demon",
      4: "Elemental", 5: "Giant", 6: "Undead", 7: "Humanoid",
      8: "Critter", 9: "Mechanical", 10: "Not specified",
      11: "Totem", 12: "Non-combat Pet", 13: "Gas Cloud",
    };
    return types[type] || "Unknown";
  };

  const getClassificationName = (classification: number): string => {
    const classifications: Record<number, string> = {
      0: "Normal", 1: "Elite", 2: "Rare Elite", 3: "Boss", 4: "Rare",
    };
    return classifications[classification] || "Normal";
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center py-24">
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400">Loading creature data...</p>
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
            <Link href="/creatures">
              <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Creatures
              </Button>
            </Link>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Creature not found</h3>
                <p className="text-slate-400">
                  {error?.message || `Creature ID ${creatureId} not found in database`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  const creatureData = data.creature || data.result || data;
  const typeName = getTypeName(creatureData.type || 0);
  const classificationName = getClassificationName(creatureData.rank || 0);
  const typeColor = typeColors[typeName] || typeColors["None"];
  const classificationColor = classificationColors[classificationName] || classificationColors["Normal"];

  const levelText = creatureData.minlevel === creatureData.maxlevel
    ? creatureData.minlevel?.toString() || "?"
    : `${creatureData.minlevel || "?"}-${creatureData.maxlevel || "?"}`;

  const isVendor = ((creatureData.npcflag || 0) & 128) !== 0;
  const isTrainer = ((creatureData.npcflag || 0) & 16) !== 0;
  const isQuestGiver = ((creatureData.npcflag || 0) & 2) !== 0;
  const isGossip = ((creatureData.npcflag || 0) & 1) !== 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link href="/creatures">
            <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Creatures
            </Button>
          </Link>

          {/* Creature Header */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-4 bg-green-500/20 rounded-lg">
                <Users className="w-12 h-12 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-4xl font-bold text-white">
                    {creatureData.name || "Unknown Creature"}
                  </h1>
                  <Badge variant="outline" className={typeColor}>
                    {typeName}
                  </Badge>
                  <Badge variant="outline" className={classificationColor}>
                    {classificationName}
                  </Badge>
                </div>
                {creatureData.subname && (
                  <p className="text-xl text-slate-300">{creatureData.subname}</p>
                )}
                <div className="mt-3 text-sm text-slate-500">
                  Creature ID: {creatureId}
                </div>
              </div>
            </div>
          </div>

          {/* Creature Details */}
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
                      <TrendingUp className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Level</span>
                    </div>
                    <div className="text-lg font-semibold text-white">{levelText}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Faction</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {creatureData.faction || "N/A"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Type ID</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {creatureData.type !== undefined ? creatureData.type : "N/A"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">NPC Flags</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {creatureData.npcflag || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NPC Features */}
            {(isVendor || isTrainer || isQuestGiver || isGossip) && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">NPC Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isVendor && (
                      <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <ShoppingBag className="w-3 h-3 mr-1" />
                        Vendor
                      </Badge>
                    )}
                    {isTrainer && (
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        <GraduationCap className="w-3 h-3 mr-1" />
                        Trainer
                      </Badge>
                    )}
                    {isQuestGiver && (
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Quest Giver
                      </Badge>
                    )}
                    {isGossip && (
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Gossip
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Information */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Additional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {creatureData.family !== undefined && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Family</span>
                      <span className="text-white font-medium">{creatureData.family}</span>
                    </div>
                  )}
                  {creatureData.modelid1 !== undefined && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Model ID</span>
                      <span className="text-white font-medium">{creatureData.modelid1}</span>
                    </div>
                  )}
                  {creatureData.scale !== undefined && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Scale</span>
                      <span className="text-white font-medium">{creatureData.scale}</span>
                    </div>
                  )}
                  {creatureData.AIName && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">AI Name</span>
                      <span className="text-white font-medium">{creatureData.AIName}</span>
                    </div>
                  )}
                  {creatureData.ScriptName && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Script Name</span>
                      <span className="text-white font-medium">{creatureData.ScriptName}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Raw Data */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  Raw Creature Data
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Complete creature information from database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                  <code className="text-sm text-slate-300 font-mono">
                    {JSON.stringify(creatureData, null, 2)}
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
