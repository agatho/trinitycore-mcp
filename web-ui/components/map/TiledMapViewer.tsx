/**
 * Tiled Map Viewer
 *
 * Efficient viewport-based tile loading for large WoW maps.
 * Only loads visible tiles + surrounding buffer to minimize memory usage.
 *
 * @component TiledMapViewer
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

/**
 * Tile metadata
 */
interface TileMetadata {
  originalWidth: number;
  originalHeight: number;
  tileSize: number;
  cols: number;
  rows: number;
  totalTiles: number;
  zoomLevels?: number[];
  format: string;
}

/**
 * Tile coordinate
 */
interface TileCoord {
  col: number;
  row: number;
  zoom: number;
  key: string;
}

/**
 * Component props
 */
interface TiledMapViewerProps {
  /** Map ID */
  mapId: number;
  /** Initial zoom level */
  initialZoom?: number;
  /** Container height */
  height?: string;
  /** Callback when tile is clicked */
  onTileClick?: (x: number, y: number) => void;
  /** Extra tiles to load around viewport */
  tilePadding?: number;
}

/**
 * Tiled map viewer with viewport culling
 */
export default function TiledMapViewer({
  mapId,
  initialZoom = 0,
  height = '600px',
  onTileClick,
  tilePadding = 2
}: TiledMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const [metadata, setMetadata] = useState<TileMetadata | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [visibleTiles, setVisibleTiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load tile metadata
   */
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/maps/tiles/${mapId}/metadata.json`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Map ${mapId} not extracted. Please extract the map first.`);
        }
        return res.json();
      })
      .then(data => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [mapId]);

  /**
   * Calculate visible tiles based on viewport
   */
  const updateVisibleTiles = useCallback(() => {
    if (!containerRef.current || !metadata) return;

    const container = containerRef.current;
    const { tileSize } = metadata;
    const scale = Math.pow(2, -zoom);
    const scaledTileSize = tileSize * scale;

    // Get viewport bounds
    const viewportLeft = container.scrollLeft;
    const viewportTop = container.scrollTop;
    const viewportRight = viewportLeft + container.clientWidth;
    const viewportBottom = viewportTop + container.clientHeight;

    // Calculate tile range with padding
    const startCol = Math.max(
      0,
      Math.floor(viewportLeft / scaledTileSize) - tilePadding
    );
    const endCol = Math.min(
      metadata.cols - 1,
      Math.ceil(viewportRight / scaledTileSize) + tilePadding
    );
    const startRow = Math.max(
      0,
      Math.floor(viewportTop / scaledTileSize) - tilePadding
    );
    const endRow = Math.min(
      metadata.rows - 1,
      Math.ceil(viewportBottom / scaledTileSize) + tilePadding
    );

    // Generate tile keys
    const tiles = new Set<string>();
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        tiles.add(`${zoom}_${col}_${row}`);
      }
    }

    setVisibleTiles(tiles);
  }, [metadata, zoom, tilePadding]);

  /**
   * Setup scroll listener
   */
  useEffect(() => {
    if (!containerRef.current || !metadata) return;

    const container = containerRef.current;
    let rafId: number;

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateVisibleTiles);
    };

    container.addEventListener('scroll', handleScroll);
    updateVisibleTiles(); // Initial calculation

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [metadata, updateVisibleTiles]);

  /**
   * Recalculate on zoom change
   */
  useEffect(() => {
    updateVisibleTiles();
  }, [zoom, updateVisibleTiles]);

  /**
   * Handle map click
   */
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onTileClick || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0);
    const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);

    onTileClick(x, y);
  };

  /**
   * Zoom controls
   */
  const zoomIn = () => {
    if (!metadata?.zoomLevels) return;
    setZoom(Math.max(0, zoom - 1));
  };

  const zoomOut = () => {
    if (!metadata?.zoomLevels) return;
    const maxZoom = metadata.zoomLevels[metadata.zoomLevels.length - 1];
    setZoom(Math.min(maxZoom, zoom + 1));
  };

  // Rendering states
  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-gray-900"
        style={{ height }}
      >
        <div className="text-white">Loading map {mapId}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-gray-900"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-red-400 mb-2">Failed to load map</div>
          <div className="text-gray-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  const scale = Math.pow(2, -zoom);
  const displayWidth = metadata.originalWidth * scale;
  const displayHeight = metadata.originalHeight * scale;
  const scaledTileSize = metadata.tileSize * scale;

  return (
    <div className="relative" style={{ height }}>
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          disabled={zoom === 0}
          className="bg-gray-800 text-white p-2 rounded hover:bg-gray-700 disabled:opacity-50"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={zoomOut}
          disabled={!metadata.zoomLevels || zoom === metadata.zoomLevels[metadata.zoomLevels.length - 1]}
          className="bg-gray-800 text-white p-2 rounded hover:bg-gray-700 disabled:opacity-50"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="bg-gray-800 text-white text-xs p-2 rounded text-center">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Tile info */}
      <div className="absolute bottom-4 left-4 z-10 bg-gray-800 text-white text-xs p-2 rounded">
        Tiles loaded: {visibleTiles.size} / {metadata.totalTiles}
      </div>

      {/* Map container with scroll */}
      <div
        ref={containerRef}
        className="overflow-auto w-full bg-gray-900"
        style={{ height: '100%' }}
      >
        <div
          ref={mapRef}
          className="relative"
          style={{
            width: displayWidth,
            height: displayHeight,
            cursor: onTileClick ? 'crosshair' : 'default'
          }}
          onClick={handleMapClick}
        >
          {/* Render visible tiles */}
          {Array.from(visibleTiles).map(tileKey => {
            const [z, col, row] = tileKey.split('_').map(Number);

            return (
              <div
                key={tileKey}
                className="absolute"
                style={{
                  left: col * scaledTileSize,
                  top: row * scaledTileSize,
                  width: scaledTileSize,
                  height: scaledTileSize
                }}
              >
                <img
                  src={`/maps/tiles/${mapId}/${z}/${col}_${row}.${metadata.format}`}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    imageRendering: scale > 1 ? 'pixelated' : 'auto'
                  }}
                  loading="lazy"
                  onError={(e) => {
                    // Hide broken images
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
