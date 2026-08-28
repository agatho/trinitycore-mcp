/**
 * WDT MAID Extraction Panel
 *
 * UI for extracting minimap FileDataIDs from WDT MAID chunks.
 * This generates the listfile needed for minimap tile extraction.
 *
 * @component WDTExtractionPanel
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Download, FileText, Loader2 } from 'lucide-react';

/**
 * Extraction result interface
 */
interface ExtractionResult {
  success: boolean;
  processedMaps?: number;
  totalTiles?: number;
  cacheHits?: number;
  duration?: number;
  output?: string;
  error?: string;
}

/**
 * WDT extraction panel component
 */
export default function WDTExtractionPanel() {
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [forceReExtract, setForceReExtract] = useState(false);
  const [mapFilter, setMapFilter] = useState('');

  /**
   * Extract WDT data
   */
  const extractWDT = async () => {
    setExtracting(true);
    setResult(null);

    try {
      const res = await fetch('/api/wdt/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapName: mapFilter || undefined,
          forceReExtract
        })
      });

      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          WDT MAID Extraction
        </CardTitle>
        <CardDescription>
          Extract minimap FileDataIDs from WDT MAID chunks to generate the minimap listfile.
          This is a prerequisite for minimap tile extraction.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="force-extract">Force Re-extract</Label>
              <div className="text-sm text-gray-500">
                Ignore cache and re-process all WDT files
              </div>
            </div>
            <Switch
              id="force-extract"
              checked={forceReExtract}
              onCheckedChange={setForceReExtract}
              disabled={extracting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="map-filter">Map Filter (Optional)</Label>
            <Input
              id="map-filter"
              placeholder="e.g., azeroth"
              value={mapFilter}
              onChange={(e) => setMapFilter(e.target.value)}
              disabled={extracting}
            />
            <div className="text-sm text-gray-500">
              Extract only specific map. Leave empty to extract all maps.
            </div>
          </div>
        </div>

        {/* Extract Button */}
        <Button
          onClick={extractWDT}
          disabled={extracting}
          className="w-full"
        >
          {extracting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Extracting WDT Data...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Extract WDT Data
            </>
          )}
        </Button>

        {/* Result */}
        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.success
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}

              <div className="flex-1 space-y-2">
                {result.success ? (
                  <>
                    <div className="font-semibold text-green-500">
                      WDT Extraction Successful
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>Processed Maps: {result.processedMaps}</div>
                      <div>Total Minimap Tiles: {result.totalTiles?.toLocaleString()}</div>
                      <div>Cache Hits: {result.cacheHits} ({result.processedMaps && result.cacheHits ? ((result.cacheHits / result.processedMaps) * 100).toFixed(1) : '0'}%)</div>
                      <div>Duration: {result.duration?.toFixed(2)}s</div>
                      {result.processedMaps && result.duration && result.duration > 0 && (
                        <div>Speed: {(result.processedMaps / result.duration).toFixed(2)} WDT/s</div>
                      )}
                    </div>

                    <div className="mt-3 p-3 bg-gray-900 rounded text-xs font-mono">
                      <div className="text-gray-400 mb-1">Listfile:</div>
                      <div className="text-gray-300">C:/temp/wow-minimap-listfile-from-wdt-build63906.csv</div>
                    </div>

                    <div className="mt-3 text-sm text-gray-400">
                      The listfile has been generated. You can now extract minimap tiles using the Map Extraction panel.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-red-500">
                      WDT Extraction Failed
                    </div>
                    <div className="text-sm text-red-400">
                      {result.error}
                    </div>
                  </>
                )}

                {result.output && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                      Show Output
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-900 rounded text-xs overflow-x-auto">
                      {result.output}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <div className="font-semibold mb-1">What is WDT MAID Extraction?</div>
              <div className="space-y-1 text-blue-200">
                <div>• WDT files contain map metadata including minimap tile FileDataIDs</div>
                <div>• The MAID chunk stores these FileDataIDs in a 64x64 grid</div>
                <div>• This extraction generates a listfile needed for minimap tile extraction</div>
                <div>• Uses native CascLib for fast extraction (100+ WDT/s)</div>
                <div>• Caches parsed data to avoid re-processing</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
