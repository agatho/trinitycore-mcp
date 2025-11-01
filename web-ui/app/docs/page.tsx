"use client";

import { useState, useEffect } from "react";
import { Search, BookOpen, Filter, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface APIMethod {
  method: string;
  className: string;
  methodName: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returns?: {
    type: string;
    description: string;
  };
}

interface APIDocsStats {
  totalMethods: number;
  totalClasses: number;
  methodsWithParameters: number;
  methodsWithReturns: number;
  methodsWithUsageExamples: number;
  methodsWithNotes: number;
}

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [methods, setMethods] = useState<APIMethod[]>([]);
  const [stats, setStats] = useState<APIDocsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Load classes and stats on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/docs?classes=true").then(r => r.json()),
      fetch("/api/docs?stats=true").then(r => r.json()),
      fetch("/api/docs?limit=50").then(r => r.json()),
    ]).then(([classesData, statsData, methodsData]) => {
      setClasses(classesData.classes || []);
      setStats(statsData.stats || null);
      setMethods(methodsData.methods || []);
      setIsLoading(false);
    });
  }, []);

  // Search methods
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      // Reset to all methods
      const response = await fetch("/api/docs?limit=50");
      const data = await response.json();
      setMethods(data.methods || []);
      setSelectedClass(null);
      return;
    }

    setIsSearching(true);
    const response = await fetch(`/api/docs?search=${encodeURIComponent(searchQuery)}`);
    const data = await response.json();
    setMethods(data.results || []);
    setSelectedClass(null);
    setIsSearching(false);
  };

  // Filter by class
  const handleClassFilter = async (className: string) => {
    setSelectedClass(className);
    setSearchQuery("");
    setIsLoading(true);

    const response = await fetch(`/api/docs?class=${encodeURIComponent(className)}`);
    const data = await response.json();
    setMethods(data.methods || []);
    setIsLoading(false);
  };

  // Clear filters
  const handleClearFilters = async () => {
    setSelectedClass(null);
    setSearchQuery("");
    setIsLoading(true);

    const response = await fetch("/api/docs?limit=50");
    const data = await response.json();
    setMethods(data.methods || []);
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              API Documentation
            </h1>
            <p className="text-xl text-slate-300">
              Complete reference for <span className="text-blue-400 font-semibold">{stats?.totalMethods || "7,770"} TrinityCore API methods</span> across {stats?.totalClasses || "100+"} classes
            </p>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-blue-400">{stats.totalMethods.toLocaleString()}</div>
                  <div className="text-sm text-slate-400 mt-1">Total Methods</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-purple-400">{stats.totalClasses}</div>
                  <div className="text-sm text-slate-400 mt-1">Classes</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-green-400">{stats.methodsWithUsageExamples}</div>
                  <div className="text-sm text-slate-400 mt-1">With Examples</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-orange-400">{stats.methodsWithReturns}</div>
                  <div className="text-sm text-slate-400 mt-1">With Returns</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search and Filter */}
          <div className="mb-8">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search methods... (e.g., Player::CastSpell, GetHealth, Aura)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-6 text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" disabled={isSearching} className="px-8 py-6 bg-blue-600 hover:bg-blue-700">
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </form>

            {/* Active Filters */}
            {(selectedClass || searchQuery) && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-slate-400">Active filters:</span>
                {selectedClass && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                    Class: {selectedClass}
                  </span>
                )}
                {searchQuery && (
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                    Search: {searchQuery}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-slate-400 hover:text-white"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Class Filter */}
            <div className="lg:col-span-1">
              <Card className="bg-slate-800/50 border-slate-700 sticky top-4">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filter by Class
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {classes.length} classes available
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-[600px] overflow-y-auto">
                    {classes.slice(0, 50).map((className) => (
                      <button
                        key={className}
                        onClick={() => handleClassFilter(className)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          selectedClass === className
                            ? "bg-blue-500/20 text-blue-400"
                            : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                        }`}
                      >
                        {className}
                      </button>
                    ))}
                    {classes.length > 50 && (
                      <div className="text-xs text-slate-500 pt-2 text-center">
                        + {classes.length - 50} more classes
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content - Methods List */}
            <div className="lg:col-span-3">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="text-slate-400">Loading methods...</div>
                </div>
              ) : methods.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No methods found</h3>
                    <p className="text-slate-400">
                      Try adjusting your search query or filters
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-slate-400 mb-4">
                    Showing {methods.length} method{methods.length !== 1 ? "s" : ""}
                  </div>
                  {methods.map((method) => (
                    <Link
                      key={method.method}
                      href={`/docs/${encodeURIComponent(method.method)}`}
                    >
                      <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-white group-hover:text-blue-400 transition-colors font-mono text-lg">
                                {method.method}
                              </CardTitle>
                              <CardDescription className="text-slate-400 mt-2">
                                {method.description}
                              </CardDescription>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded">
                              {method.className}
                            </span>
                            {method.parameters && method.parameters.length > 0 && (
                              <span className="text-slate-500">
                                {method.parameters.length} parameter{method.parameters.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {method.returns && (
                              <span className="text-slate-500">
                                Returns: {method.returns.type}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
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
