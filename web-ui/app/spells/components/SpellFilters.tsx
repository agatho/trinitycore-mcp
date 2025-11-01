"use client";

import { Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SpellFiltersProps {
  selectedSchool: string | null;
  onSelectSchool: (school: string | null) => void;
}

const spellSchools = [
  { name: "Physical", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  { name: "Fire", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { name: "Frost", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { name: "Arcane", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { name: "Nature", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { name: "Shadow", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { name: "Holy", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
];

export function SpellFilters({ selectedSchool, onSelectSchool }: SpellFiltersProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 sticky top-4">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </CardTitle>
        <CardDescription className="text-slate-400">
          Filter spells by school
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Spell School
          </div>

          {/* All Schools */}
          <Badge
            variant="outline"
            className={`w-full cursor-pointer transition-colors text-center justify-center ${
              selectedSchool === null
                ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
            }`}
            onClick={() => onSelectSchool(null)}
          >
            All Schools
          </Badge>

          {/* Individual Schools */}
          {spellSchools.map((school) => (
            <Badge
              key={school.name}
              variant="outline"
              className={`w-full cursor-pointer transition-colors text-center justify-center ${
                selectedSchool === school.name
                  ? school.color
                  : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
              }`}
              onClick={() => onSelectSchool(school.name)}
            >
              {school.name}
            </Badge>
          ))}
        </div>

        {/* Clear Filter */}
        {selectedSchool && (
          <button
            onClick={() => onSelectSchool(null)}
            className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear filter
          </button>
        )}
      </CardContent>
    </Card>
  );
}
