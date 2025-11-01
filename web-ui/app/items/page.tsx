"use client";

import { useState } from "react";
import { ArrowLeft, Search, Database, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useMCPTool } from "@/hooks/useMCP";
import { ItemCard } from "./components/ItemCard";
import { ItemFilters } from "./components/ItemFilters";

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

const POPULAR_ITEMS = [
  { id: 19019, name: "Thunderfury, Blessed Blade of the Windseeker" },
  { id: 17182, name: "Sulfuras, Hand of Ragnaros" },
  { id: 40395, name: "Torch of Holy Fire" },
  { id: 2589, name: "Linen Cloth" },
];

export default function ItemsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const { callTool, loading, error } = useMCPTool<Item>();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setItems([]);
      return;
    }

    try {
      const itemId = parseInt(searchQuery);

      if (!isNaN(itemId)) {
        const result = await callTool("mcp__trinitycore__get-item-info", { itemId });

        if (result) {
          setItems([{
            id: itemId,
            name: (result as any).name || "Unknown Item",
            description: (result as any).description || "",
            quality: (result as any).quality || 0,
            itemLevel: (result as any).itemLevel || 0,
            requiredLevel: (result as any).requiredLevel || 0,
            itemClass: (result as any).class || 0,
            itemSubclass: (result as any).subclass || 0,
            inventoryType: (result as any).inventoryType || 0,
            vendorPrice: (result as any).vendorPrice || 0,
          }]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch item:", err);
      setItems([]);
    }
  };

  const filteredItems = items.filter(item => {
    if (selectedQuality !== null && item.quality !== selectedQuality) {
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
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Database className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-5xl font-bold text-white">
                  Item Database
                </h1>
                <p className="text-xl text-slate-300 mt-2">
                  Explore <span className="text-blue-400 font-semibold">100,000+ items</span> from World of Warcraft
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
                  placeholder="Search items by ID (e.g., 19019 for Thunderfury)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-6 text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="px-8 py-6 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </form>

            <div className="mt-3 text-sm text-slate-400">
              <p>💡 Tip: Enter an item ID to view item details. Popular item IDs:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {POPULAR_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSearchQuery(item.id.toString())}
                    className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors text-xs"
                  >
                    {item.id} - {item.name}
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
              <ItemFilters
                selectedQuality={selectedQuality}
                onSelectQuality={setSelectedQuality}
              />
            </div>

            {/* Main Content - Item List */}
            <div className="lg:col-span-3">
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-slate-400">Searching items...</p>
                  </div>
                </div>
              ) : filteredItems.length === 0 && searchQuery ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-24 text-center">
                    <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      No items found
                    </h3>
                    <p className="text-slate-400">
                      Try searching with a different item ID
                    </p>
                  </CardContent>
                </Card>
              ) : filteredItems.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-24 text-center">
                    <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Start searching
                    </h3>
                    <p className="text-slate-400">
                      Enter an item ID above to explore item data
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-slate-400 mb-4">
                    Showing {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
                  </div>
                  {filteredItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
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
