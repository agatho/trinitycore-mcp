"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingBag, DollarSign, Award, TrendingUp, Info, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useItem } from "@/hooks/useMCP";

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

export default function ItemDetailPage() {
  const params = useParams();
  const itemId = parseInt(params.itemId as string);
  const { data, isLoading, error } = useItem(itemId);

  const formatPrice = (copper: number) => {
    if (copper === 0) return "0 copper";

    const gold = Math.floor(copper / 10000);
    const silver = Math.floor((copper % 10000) / 100);
    const remainingCopper = copper % 100;

    const parts = [];
    if (gold > 0) parts.push(`${gold} gold`);
    if (silver > 0) parts.push(`${silver} silver`);
    if (remainingCopper > 0 || parts.length === 0) parts.push(`${remainingCopper} copper`);

    return parts.join(", ");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center py-24">
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400">Loading item data...</p>
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
            <Link href="/items">
              <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Items
              </Button>
            </Link>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Item not found</h3>
                <p className="text-slate-400">
                  {error?.message || `Item ID ${itemId} not found in database`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  const item = data.item || data.result || data;
  const quality = item.quality || 1;
  const qualityColor = qualityColors[quality] || qualityColors[1];
  const qualityName = qualityNames[quality] || "Common";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link href="/items">
            <Button variant="ghost" className="mb-8 text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Items
            </Button>
          </Link>

          {/* Item Header */}
          <div className="mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-4 bg-blue-500/20 rounded-lg">
                <ShoppingBag className="w-12 h-12 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold text-white">
                    {item.name || "Unknown Item"}
                  </h1>
                  <Badge variant="outline" className={qualityColor}>
                    {qualityName}
                  </Badge>
                </div>
                <p className="text-xl text-slate-300">
                  {item.description || "No description available"}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-slate-500">
                    Item ID: {itemId}
                  </span>
                  {item.dataSource && (
                    <Badge
                      variant="outline"
                      className={
                        item.dataSource === "database"
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : item.dataSource === "db2"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                      }
                    >
                      {item.dataSource === "database" && "📊 Database"}
                      {item.dataSource === "db2" && "💾 DB2 Cache"}
                      {item.dataSource === "merged" && "🔄 Merged"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Item Details */}
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
                      <Award className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Item Level</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {item.itemLevel > 0 ? item.itemLevel : "N/A"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Required Level</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {item.requiredLevel > 0 ? item.requiredLevel : "1"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Item Class</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {item.itemClass !== undefined ? item.itemClass : "N/A"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-500">Subclass</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {item.itemSubclass !== undefined ? item.itemSubclass : "N/A"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Information */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-700">
                    <span className="text-slate-400">Vendor Price</span>
                    <span className="text-white font-medium">
                      {formatPrice(item.vendorPrice || 0)}
                    </span>
                  </div>
                  {item.sellPrice !== undefined && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Sell Price</span>
                      <span className="text-white font-medium">
                        {formatPrice(item.sellPrice)}
                      </span>
                    </div>
                  )}
                  {item.buyPrice !== undefined && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-700">
                      <span className="text-slate-400">Buy Price</span>
                      <span className="text-white font-medium">
                        {formatPrice(item.buyPrice)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            {(item.inventoryType !== undefined || item.maxCount !== undefined || item.stackable !== undefined) && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {item.inventoryType !== undefined && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Inventory Type</span>
                        <span className="text-white font-medium">{item.inventoryType}</span>
                      </div>
                    )}
                    {item.maxCount !== undefined && item.maxCount > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Max Count</span>
                        <span className="text-white font-medium">{item.maxCount}</span>
                      </div>
                    )}
                    {item.stackable !== undefined && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Stackable</span>
                        <span className="text-white font-medium">
                          {item.stackable > 1 ? `Yes (${item.stackable})` : "No"}
                        </span>
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
                  Raw Item Data
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Complete item information from database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                  <code className="text-sm text-slate-300 font-mono">
                    {JSON.stringify(item, null, 2)}
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
