/**
 * Batch Query & Comparison Tool
 * Side-by-side comparison of spells, items, or creatures
 */

"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, GitCompare, X, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useCompare } from "@/hooks/useCompare";
import { compareItems, formatComparisonTable, highlightDifferences } from "@/lib/comparison";
import { exportData } from "@/lib/export";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function ComparePage() {
  const { items, removeItem, clearItems, itemCount } = useCompare();
  const [viewMode, setViewMode] = useState<'side-by-side' | 'table'>('side-by-side');
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);

  useEffect(() => {
    if (items.length > 0) {
      const table = formatComparisonTable(items);
      const highlighted = highlightDifferences(items);
      setComparisonData({ table, highlighted });
    } else {
      setComparisonData(null);
    }
  }, [items]);

  const handleExport = (format: 'csv' | 'excel' | 'json') => {
    if (!comparisonData) return;

    const exportRows = comparisonData.table.rows.map((row: any) => {
      const obj: any = { field: row.field };
      row.values.forEach((value: any, index: number) => {
        obj[`Item ${index + 1}`] = value;
      });
      return obj;
    });

    exportData({
      format,
      data: exportRows,
      filename: `comparison-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`,
      title: 'Item Comparison',
    });
  };

  const filteredRows = comparisonData?.table.rows.filter((row: any) => {
    if (showOnlyDifferences) {
      return row.isDifferent;
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <GitCompare className="w-8 h-8 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold text-white">
                    Comparison Tool
                  </h1>
                  <p className="text-xl text-slate-300 mt-2">
                    Compare <span className="text-orange-400 font-semibold">{itemCount} items</span> side-by-side
                  </p>
                </div>
              </div>

              {itemCount > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
                  >
                    {showOnlyDifferences ? (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Show All
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Only Differences
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('excel')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearItems}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Empty State */}
          {itemCount === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No Items to Compare</CardTitle>
                <CardDescription>
                  Add items to comparison from the Spells, Items, or Creatures browsers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12">
                  <GitCompare className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-6">
                    Click the "Add to Compare" button on any item to start comparing
                  </p>
                  <div className="flex gap-4">
                    <Link href="/spells">
                      <Button variant="outline">Browse Spells</Button>
                    </Link>
                    <Link href="/items">
                      <Button variant="outline">Browse Items</Button>
                    </Link>
                    <Link href="/creatures">
                      <Button variant="outline">Browse Creatures</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comparison View */}
          {itemCount > 0 && comparisonData && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList className="mb-6">
                <TabsTrigger value="side-by-side">Side-by-Side</TabsTrigger>
                <TabsTrigger value="table">Table View</TabsTrigger>
              </TabsList>

              {/* Side-by-Side View */}
              <TabsContent value="side-by-side">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((item, index) => (
                    <Card key={item.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">
                            Item {index + 1}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardDescription className="font-mono">
                          ID: {item.id}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {filteredRows?.map((row: any) => {
                            const isDifferent = comparisonData.highlighted.has(row.field) &&
                              comparisonData.highlighted.get(row.field)?.includes(index);

                            return (
                              <div
                                key={row.field}
                                className={`text-sm ${
                                  isDifferent ? 'bg-yellow-500/10 p-2 rounded' : ''
                                }`}
                              >
                                <div className="font-medium text-muted-foreground">
                                  {row.field}
                                </div>
                                <div className="text-white">
                                  {String(row.values[index] ?? 'N/A')}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Table View */}
              <TabsContent value="table">
                <Card>
                  <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-semibold">Field</th>
                            {items.map((item, index) => (
                              <th key={item.id} className="text-left p-2 font-semibold">
                                <div className="flex items-center justify-between">
                                  <span>Item {index + 1}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(item.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="text-xs font-normal text-muted-foreground">
                                  ID: {item.id}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows?.map((row: any) => (
                            <tr
                              key={row.field}
                              className={`border-b ${
                                row.isDifferent ? 'bg-yellow-500/5' : ''
                              }`}
                            >
                              <td className="p-2 font-medium">
                                {row.isDifferent && (
                                  <span className="text-yellow-500 mr-2">⚠️</span>
                                )}
                                {row.field}
                              </td>
                              {row.values.map((value: any, index: number) => (
                                <td key={index} className="p-2">
                                  {String(value ?? 'N/A')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </main>
  );
}
