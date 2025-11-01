"use client";

import { ShoppingBag, DollarSign, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Item {
  id: number;
  name: string;
  description: string;
  quality: number;
  itemLevel: number;
  requiredLevel: number;
  itemClass: number;
  itemSubclass: number;
  inventoryType: number;
  vendorPrice: number;
}

interface ItemCardProps {
  item: Item;
}

const qualityColors: Record<number, string> = {
  0: "bg-gray-500/20 text-gray-400 border-gray-500/30", // Poor
  1: "bg-white/20 text-white border-white/30", // Common
  2: "bg-green-500/20 text-green-400 border-green-500/30", // Uncommon
  3: "bg-blue-500/20 text-blue-400 border-blue-500/30", // Rare
  4: "bg-purple-500/20 text-purple-400 border-purple-500/30", // Epic
  5: "bg-orange-500/20 text-orange-400 border-orange-500/30", // Legendary
};

const qualityNames: Record<number, string> = {
  0: "Poor",
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Epic",
  5: "Legendary",
};

export function ItemCard({ item }: ItemCardProps) {
  const qualityColor = qualityColors[item.quality] || qualityColors[1];
  const qualityName = qualityNames[item.quality] || "Common";

  const formatPrice = (copper: number) => {
    if (copper === 0) return "0c";

    const gold = Math.floor(copper / 10000);
    const silver = Math.floor((copper % 10000) / 100);
    const remainingCopper = copper % 100;

    const parts = [];
    if (gold > 0) parts.push(`${gold}g`);
    if (silver > 0) parts.push(`${silver}s`);
    if (remainingCopper > 0 || parts.length === 0) parts.push(`${remainingCopper}c`);

    return parts.join(" ");
  };

  return (
    <Link href={`/items/${item.id}`}>
      <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-white group-hover:text-blue-400 transition-colors text-xl">
                  {item.name}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`${qualityColor} text-xs px-2 py-0.5`}
                >
                  {qualityName}
                </Badge>
              </div>
              <CardDescription className="text-slate-400 mt-2">
                {item.description || "No description available"}
              </CardDescription>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className="w-12 h-12 bg-slate-700/50 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <ShoppingBag className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Item Level */}
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Item Level</div>
                <div className="text-white font-medium">
                  {item.itemLevel > 0 ? item.itemLevel : "N/A"}
                </div>
              </div>
            </div>

            {/* Required Level */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Req. Level</div>
                <div className="text-white font-medium">
                  {item.requiredLevel > 0 ? item.requiredLevel : "1"}
                </div>
              </div>
            </div>

            {/* Vendor Price */}
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Vendor Price</div>
                <div className="text-white font-medium">
                  {formatPrice(item.vendorPrice)}
                </div>
              </div>
            </div>

            {/* Class/Subclass */}
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500 text-xs">Type</div>
                <div className="text-white font-medium">
                  {item.itemClass}.{item.itemSubclass}
                </div>
              </div>
            </div>
          </div>

          {/* Item ID */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Item ID: {item.id}</span>
              <span className="text-slate-500">
                Inventory Type: {item.inventoryType}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
