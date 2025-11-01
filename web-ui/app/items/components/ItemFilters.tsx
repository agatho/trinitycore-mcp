"use client";

import { Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ItemFiltersProps {
  selectedQuality: number | null;
  onSelectQuality: (quality: number | null) => void;
}

const itemQualities = [
  { level: 0, name: "Poor", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  { level: 1, name: "Common", color: "bg-white/20 text-white border-white/30" },
  { level: 2, name: "Uncommon", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { level: 3, name: "Rare", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { level: 4, name: "Epic", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { level: 5, name: "Legendary", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
];

export function ItemFilters({ selectedQuality, onSelectQuality }: ItemFiltersProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 sticky top-4">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </CardTitle>
        <CardDescription className="text-slate-400">
          Filter items by quality
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Item Quality
          </div>

          {/* All Qualities */}
          <Badge
            variant="outline"
            className={`w-full cursor-pointer transition-colors text-center justify-center ${
              selectedQuality === null
                ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
            }`}
            onClick={() => onSelectQuality(null)}
          >
            All Qualities
          </Badge>

          {/* Individual Qualities */}
          {itemQualities.map((quality) => (
            <Badge
              key={quality.level}
              variant="outline"
              className={`w-full cursor-pointer transition-colors text-center justify-center ${
                selectedQuality === quality.level
                  ? quality.color
                  : "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500"
              }`}
              onClick={() => onSelectQuality(quality.level)}
            >
              {quality.name}
            </Badge>
          ))}
        </div>

        {/* Clear Filter */}
        {selectedQuality !== null && (
          <button
            onClick={() => onSelectQuality(null)}
            className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear filter
          </button>
        )}
      </CardContent>
    </Card>
  );
}
