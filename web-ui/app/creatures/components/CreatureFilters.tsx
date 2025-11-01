"use client";

import { Filter, ShoppingBag, GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface CreatureFiltersProps {
  selectedType: number | null;
  onSelectType: (type: number | null) => void;
  selectedClassification: number | null;
  onSelectClassification: (classification: number | null) => void;
  filterVendor: boolean;
  onFilterVendor: (value: boolean) => void;
  filterTrainer: boolean;
  onFilterTrainer: (value: boolean) => void;
}

const creatureTypes = [
  { id: 0, name: "None", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  { id: 1, name: "Beast", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { id: 2, name: "Dragonkin", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { id: 3, name: "Demon", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: 4, name: "Elemental", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: 5, name: "Giant", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: 6, name: "Undead", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { id: 7, name: "Humanoid", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: 8, name: "Critter", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { id: 9, name: "Mechanical", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
];

const creatureClassifications = [
  { id: 0, name: "Normal", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  { id: 1, name: "Elite", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { id: 2, name: "Rare Elite", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: 3, name: "Boss", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { id: 4, name: "Rare", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
];

export function CreatureFilters({
  selectedType,
  onSelectType,
  selectedClassification,
  onSelectClassification,
  filterVendor,
  onFilterVendor,
  filterTrainer,
  onFilterTrainer,
}: CreatureFiltersProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 sticky top-4">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </CardTitle>
        <CardDescription className="text-slate-400">
          Filter creatures by type and classification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Creature Type Filter */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Creature Type
            </div>

            {/* All Types */}
            <Badge
              variant="outline"
              className={`w-full cursor-pointer transition-colors text-center justify-center mb-2 ${
                selectedType === null
                  ? "bg-green-500/20 text-green-400 border-green-500/50"
                  : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
              }`}
              onClick={() => onSelectType(null)}
            >
              All Types
            </Badge>

            {/* Individual Types */}
            <div className="space-y-2">
              {creatureTypes.map((type) => (
                <Badge
                  key={type.id}
                  variant="outline"
                  className={`w-full cursor-pointer transition-colors text-center justify-center ${
                    selectedType === type.id
                      ? type.color
                      : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
                  }`}
                  onClick={() => onSelectType(type.id)}
                >
                  {type.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Classification Filter */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Classification
            </div>

            {/* All Classifications */}
            <Badge
              variant="outline"
              className={`w-full cursor-pointer transition-colors text-center justify-center mb-2 ${
                selectedClassification === null
                  ? "bg-green-500/20 text-green-400 border-green-500/50"
                  : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
              }`}
              onClick={() => onSelectClassification(null)}
            >
              All Classifications
            </Badge>

            {/* Individual Classifications */}
            <div className="space-y-2">
              {creatureClassifications.map((classification) => (
                <Badge
                  key={classification.id}
                  variant="outline"
                  className={`w-full cursor-pointer transition-colors text-center justify-center ${
                    selectedClassification === classification.id
                      ? classification.color
                      : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
                  }`}
                  onClick={() => onSelectClassification(classification.id)}
                >
                  {classification.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* NPC Type Filters */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              NPC Type
            </div>

            <div className="space-y-3">
              {/* Vendor Filter */}
              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <Label htmlFor="vendor-filter" className="text-slate-300 flex items-center gap-2 cursor-pointer">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                  Vendors Only
                </Label>
                <Switch
                  id="vendor-filter"
                  checked={filterVendor}
                  onCheckedChange={onFilterVendor}
                />
              </div>

              {/* Trainer Filter */}
              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <Label htmlFor="trainer-filter" className="text-slate-300 flex items-center gap-2 cursor-pointer">
                  <GraduationCap className="w-4 h-4 text-purple-400" />
                  Trainers Only
                </Label>
                <Switch
                  id="trainer-filter"
                  checked={filterTrainer}
                  onCheckedChange={onFilterTrainer}
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedType !== null || selectedClassification !== null || filterVendor || filterTrainer) && (
            <button
              onClick={() => {
                onSelectType(null);
                onSelectClassification(null);
                onFilterVendor(false);
                onFilterTrainer(false);
              }}
              className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
