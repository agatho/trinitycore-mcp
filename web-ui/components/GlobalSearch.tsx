"use client";

import { useEffect, useState } from "react";
import { Search, Zap, ShoppingBag, Users, FileCode, Command } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

type SearchCategory = "spells" | "items" | "creatures" | "playground";

interface SearchResult {
  id: string | number;
  title: string;
  description: string;
  category: SearchCategory;
  url: string;
  icon: React.ReactNode;
}

const categoryIcons: Record<SearchCategory, React.ReactNode> = {
  spells: <Zap className="w-4 h-4" />,
  items: <ShoppingBag className="w-4 h-4" />,
  creatures: <Users className="w-4 h-4" />,
  playground: <FileCode className="w-4 h-4" />,
};

const categoryColors: Record<SearchCategory, string> = {
  spells: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  items: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  creatures: "bg-green-500/20 text-green-400 border-green-500/30",
  playground: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

// Popular/example search results
const POPULAR_RESULTS: SearchResult[] = [
  {
    id: 133,
    title: "Fireball",
    description: "Classic mage spell",
    category: "spells",
    url: "/spells/133",
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: 19019,
    title: "Thunderfury, Blessed Blade of the Windseeker",
    description: "Legendary weapon",
    category: "items",
    url: "/items/19019",
    icon: <ShoppingBag className="w-4 h-4" />,
  },
  {
    id: 6491,
    title: "Spirit Healer",
    description: "Graveyard NPC",
    category: "creatures",
    url: "/creatures/6491",
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: "playground",
    title: "API Playground",
    description: "Interactive MCP tool testing",
    category: "playground",
    url: "/playground",
    icon: <FileCode className="w-4 h-4" />,
  },
];

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Filter results based on search query
  const results = searchQuery.trim()
    ? POPULAR_RESULTS.filter(
        (result) =>
          result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.id.toString().includes(searchQuery)
      )
    : POPULAR_RESULTS;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }

      // Escape to close
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
        setSelectedIndex(0);
      }

      // Arrow navigation when modal is open
      if (isOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        if (e.key === "Enter" && results[selectedIndex]) {
          e.preventDefault();
          router.push(results[selectedIndex].url);
          setIsOpen(false);
          setSearchQuery("");
          setSelectedIndex(0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, router]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setSearchQuery("");
    setSelectedIndex(0);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-all"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Search...</span>
        <kbd className="ml-2 px-2 py-0.5 bg-slate-700/50 border border-slate-600 rounded text-xs">
          <Command className="w-3 h-3 inline mr-1" />K
        </kbd>
      </button>

      {/* Search Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Search className="w-5 h-5" />
              Global Search
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Search spells, items, creatures, and more. Use{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs">
                ↑
              </kbd>{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs">
                ↓
              </kbd>{" "}
              to navigate and{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs">
                Enter
              </kbd>{" "}
              to select
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="pl-12 pr-4 py-6 text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {results.length === 0 ? (
              <div className="py-12 text-center">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No results found</p>
                <p className="text-sm text-slate-500 mt-1">
                  Try searching by spell ID, item ID, or creature ID
                </p>
              </div>
            ) : (
              results.map((result, index) => (
                <button
                  key={`${result.category}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full p-4 rounded-lg border transition-all text-left ${
                    index === selectedIndex
                      ? "bg-slate-700/50 border-slate-600"
                      : "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-slate-700/50 rounded-lg">
                      {categoryIcons[result.category]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium">{result.title}</h4>
                        <Badge
                          variant="outline"
                          className={`${categoryColors[result.category]} text-xs`}
                        >
                          {result.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">{result.description}</p>
                      <p className="text-xs text-slate-500 mt-1">ID: {result.id}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer Hints */}
          <div className="pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded">
                    ↑↓
                  </kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded">
                    Enter
                  </kbd>
                  <span>Select</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded">
                  Esc
                </kbd>
                <span>Close</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
