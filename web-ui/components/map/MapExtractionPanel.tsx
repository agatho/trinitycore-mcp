/**
 * Map Extraction Panel
 *
 * UI for extracting and managing WoW map textures from CASC.
 *
 * @component MapExtractionPanel
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Map info
 */
interface MapInfo {
  id: number;
  name: string;
  extracted: boolean;
}

/**
 * Extraction status
 */
interface ExtractionStatus {
  mapId: number;
  status: 'pending' | 'extracting' | 'converting' | 'tiling' | 'completed' | 'error';
  progress: number;
  error?: string;
}

/**
 * WoW installation info
 */
interface WoWInfo {
  configured: boolean;
  path?: string;
  valid: boolean;
  autoDetected?: string;
}

/**
 * Map extraction panel component
 */
export default function MapExtractionPanel() {
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [wowInfo, setWoWInfo] = useState<WoWInfo | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<Map<number, ExtractionStatus>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState<'low' | 'medium' | 'high' | 'all'>('all');

  /**
   * Load WoW installation info and maps
   */
  useEffect(() => {
    loadWoWInfo();
    loadMaps();
  }, []);

  const loadWoWInfo = async () => {
    try {
      const res = await fetch('/api/maps/wow-info');
      const info = await res.json();
      setWoWInfo(info);
    } catch (error) {
      console.error('Failed to load WoW info:', error);
    }
  };

  const loadMaps = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/maps/list');
      const data = await res.json();
      setMaps(data);
    } catch (error) {
      console.error('Failed to load maps:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extract map
   */
  const extractMap = async (mapId: number) => {
    setExtractionStatus(prev => new Map(prev).set(mapId, {
      mapId,
      status: 'pending',
      progress: 0
    }));

    try {
      const res = await fetch('/api/maps/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapId,
          quality: selectedQuality,
          enableTiling: true,
          tileSize: 256
        })
      });

      const status = await res.json();
      setExtractionStatus(prev => new Map(prev).set(mapId, status));

      // Reload maps list
      if (status.status === 'completed') {
        await loadMaps();
      }
    } catch (error: any) {
      setExtractionStatus(prev => new Map(prev).set(mapId, {
        mapId,
        status: 'error',
        progress: 0,
        error: error.message
      }));
    }
  };

  /**
   * Delete extracted map
   */
  const deleteMap = async (mapId: number) => {
    if (!confirm(`Delete extracted data for ${maps.find(m => m.id === mapId)?.name}?`)) {
      return;
    }

    try {
      await fetch(`/api/maps/${mapId}`, { method: 'DELETE' });
      await loadMaps();
    } catch (error) {
      console.error('Failed to delete map:', error);
    }
  };

  /**
   * Get status label
   */
  const getStatusLabel = (status: ExtractionStatus['status']) => {
    const labels = {
      pending: 'Pending',
      extracting: 'Extracting from CASC',
      converting: 'Converting BLP to PNG',
      tiling: 'Generating tiles',
      completed: 'Completed',
      error: 'Error'
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className="p-4 text-gray-400">Loading...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* WoW Installation Status */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">WoW Installation</h3>

        {!wowInfo ? (
          <div className="text-gray-400">Loading...</div>
        ) : wowInfo.valid ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-400">Valid Installation Found</span>
            </div>
            <div className="text-sm text-gray-400">
              Path: {wowInfo.path || wowInfo.autoDetected}
            </div>
            {!wowInfo.configured && (
              <div className="text-xs text-yellow-400">
                Auto-detected. Set WOW_PATH in .env to persist.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-red-400">No WoW Installation Found</span>
            </div>
            <div className="text-sm text-gray-400">
              Set WOW_PATH in .env to your WoW retail installation directory.
            </div>
            <div className="text-xs text-gray-500">
              Example: WOW_PATH=C:\Program Files (x86)\World of Warcraft\_retail_
            </div>
          </div>
        )}
      </div>

      {/* Quality Selection */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Extraction Settings</h3>
        <div className="space-y-2">
          <label className="block text-sm text-gray-400">
            Texture Quality
          </label>
          <select
            value={selectedQuality}
            onChange={(e) => setSelectedQuality(e.target.value as any)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2"
          >
            <option value="all">All Qualities (Recommended)</option>
            <option value="high">High Quality Only</option>
            <option value="medium">Medium Quality Only</option>
            <option value="low">Low Quality Only</option>
          </select>
          <p className="text-xs text-gray-500">
            Extracting all qualities allows the viewer to adjust quality dynamically.
          </p>
        </div>
      </div>

      {/* Maps List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Available Maps</h3>

        <div className="space-y-2">
          {maps.map(map => {
            const status = extractionStatus.get(map.id);

            return (
              <div
                key={map.id}
                className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium text-white">{map.name}</div>
                  <div className="text-sm text-gray-400">Map ID: {map.id}</div>

                  {status && status.status !== 'completed' && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">
                        {getStatusLabel(status.status)}
                        {status.error && ` - ${status.error}`}
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${status.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {map.extracted ? (
                    <>
                      <div className="px-3 py-1 bg-green-600 text-white text-sm rounded">
                        Extracted
                      </div>
                      <button
                        onClick={() => deleteMap(map.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => extractMap(map.id)}
                      disabled={!wowInfo?.valid || !!status}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded"
                    >
                      {status ? 'Extracting...' : 'Extract'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legal Notice */}
      <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
        <div className="text-yellow-400 text-sm font-medium mb-1">⚠️ Legal Notice</div>
        <div className="text-yellow-300 text-xs">
          Map textures are extracted from your personal WoW installation for development purposes.
          Do not redistribute extracted files. Respect Blizzard's intellectual property.
        </div>
      </div>
    </div>
  );
}
