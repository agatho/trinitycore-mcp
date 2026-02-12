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
  minCol?: number;
  minRow?: number;
  maxCol?: number;
  maxRow?: number;
  totalTiles: number;
  zoomLevels?: number[];
  format: string;
  existingTiles?: string[]; // List of existing tile keys (e.g., "17_37")
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

  // Mouse drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollX: 0, scrollY: 0 });

  /**
   * Load tile metadata
   */
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/tile-data/${mapId}/metadata.json`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Map ${mapId} not extracted. Please extract the map first.`);
        }
        return res.json();
      })
      .then(data => {
        console.log('[TiledMapViewer] Raw metadata loaded:', data);

        // Validate and provide defaults for required fields
        const tileSize = data.tileSize || 256;
        const cols = data.cols || 32;
        const rows = data.rows || 32;
        const validatedMetadata: TileMetadata = {
          originalWidth: data.originalWidth || (cols * tileSize) || 8192,
          originalHeight: data.originalHeight || (rows * tileSize) || 8192,
          tileSize,
          cols,
          rows,
          minCol: data.minCol,
          minRow: data.minRow,
          maxCol: data.maxCol,
          maxRow: data.maxRow,
          totalTiles: data.totalTiles || data.tileCount || 0,
          zoomLevels: data.zoomLevels,
          format: data.format || 'png',
          existingTiles: data.existingTiles, // Array of existing tile keys
        };

        console.log('[TiledMapViewer] Validated metadata:', validatedMetadata);
        console.log('[TiledMapViewer] Existing tiles count:', data.existingTiles?.length || 0);

        setMetadata(validatedMetadata);
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

    // Calculate tile range with padding, accounting for min/max bounds
    const minCol = metadata.minCol ?? 0;
    const minRow = metadata.minRow ?? 0;
    const maxCol = metadata.maxCol ?? (metadata.cols - 1);
    const maxRow = metadata.maxRow ?? (metadata.rows - 1);

    console.log('[TiledMapViewer] Metadata bounds:', { minCol, minRow, maxCol, maxRow, cols: metadata.cols, rows: metadata.rows });

    // Calculate visible display tile range (0-based relative to display)
    const displayStartCol = Math.floor(viewportLeft / scaledTileSize) - tilePadding;
    const displayEndCol = Math.ceil(viewportRight / scaledTileSize) + tilePadding;
    const displayStartRow = Math.floor(viewportTop / scaledTileSize) - tilePadding;
    const displayEndRow = Math.ceil(viewportBottom / scaledTileSize) + tilePadding;

    console.log('[TiledMapViewer] Display tile range:', { displayStartCol, displayEndCol, displayStartRow, displayEndRow });

    // Convert to actual tile coordinates by adding minCol/minRow offset
    const startCol = Math.max(minCol, displayStartCol + minCol);
    const endCol = Math.min(maxCol, displayEndCol + minCol);
    const startRow = Math.max(minRow, displayStartRow + minRow);
    const endRow = Math.min(maxRow, displayEndRow + minRow);

    console.log('[TiledMapViewer] Actual tile range:', { startCol, endCol, startRow, endRow });

    // Create a set of existing tiles for fast lookup
    const existingTilesSet = metadata.existingTiles
      ? new Set(metadata.existingTiles)
      : null;

    // Generate tile keys - only include tiles that exist
    const tiles = new Set<string>();
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const tileKey = `${col}_${row}`;
        // If we have an existing tiles list, check if this tile exists
        if (!existingTilesSet || existingTilesSet.has(tileKey)) {
          tiles.add(`${zoom}_${col}_${row}`);
        }
      }
    }

    console.log('[TiledMapViewer] Generated tile keys:', Array.from(tiles).slice(0, 5), `... (${tiles.size} total, filtered: ${existingTilesSet ? 'yes' : 'no'})`);

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
   * Scroll to center of existing tiles on initial load
   */
  useEffect(() => {
    if (!metadata || !containerRef.current) return;

    const container = containerRef.current;
    const { tileSize, existingTiles, minCol = 0, minRow = 0 } = metadata;

    // Find center of existing tiles
    if (existingTiles && existingTiles.length > 0) {
      let sumCol = 0, sumRow = 0;
      existingTiles.forEach(key => {
        const [col, row] = key.split('_').map(Number);
        sumCol += col;
        sumRow += row;
      });
      const centerCol = sumCol / existingTiles.length;
      const centerRow = sumRow / existingTiles.length;

      // Calculate scroll position to center on these tiles
      const scale = Math.pow(2, -zoom);
      const scaledTileSize = tileSize * scale;

      // Position in display coordinates
      const centerX = (centerCol - minCol) * scaledTileSize;
      const centerY = (centerRow - minRow) * scaledTileSize;

      // Scroll to center
      container.scrollLeft = centerX - container.clientWidth / 2;
      container.scrollTop = centerY - container.clientHeight / 2;

      console.log('[TiledMapViewer] Scrolled to center:', { centerCol, centerRow, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop });
    }
  }, [metadata]); // Only run on initial metadata load

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
    setZoom(Math.max(-2, zoom - 1)); // Allow zoom in up to 4x
  };

  const zoomOut = () => {
    setZoom(Math.min(3, zoom + 1)); // Allow zoom out to 12.5%
  };

  /**
   * Mouse drag handlers for panning
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      scrollX: containerRef.current?.scrollLeft || 0,
      scrollY: containerRef.current?.scrollTop || 0,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    containerRef.current.scrollLeft = dragStart.scrollX - deltaX;
    containerRef.current.scrollTop = dragStart.scrollY - deltaY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  /**
   * Wheel zoom handler
   */
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    if (!containerRef.current) return;

    const container = containerRef.current;

    // Get mouse position relative to container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate position in map coordinates before zoom
    const scale = Math.pow(2, -zoom);
    const mapX = (container.scrollLeft + mouseX) / scale;
    const mapY = (container.scrollTop + mouseY) / scale;

    // Calculate new zoom
    const delta = e.deltaY > 0 ? 1 : -1;
    const newZoom = Math.max(-2, Math.min(3, zoom + delta * 0.5));

    if (newZoom !== zoom) {
      setZoom(newZoom);

      // Calculate new scale and adjust scroll to keep mouse position fixed
      const newScale = Math.pow(2, -newZoom);
      const newScrollLeft = mapX * newScale - mouseX;
      const newScrollTop = mapY * newScale - mouseY;

      // Use requestAnimationFrame to apply scroll after zoom render
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = newScrollLeft;
          containerRef.current.scrollTop = newScrollTop;
        }
      });
    }
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

  // Defensive guard: Ensure metadata fields are valid numbers
  const tileSize = metadata.tileSize || 256;
  const cols = metadata.cols || 32;
  const rows = metadata.rows || 32;
  const originalWidth = metadata.originalWidth || (cols * tileSize) || 8192;
  const originalHeight = metadata.originalHeight || (rows * tileSize) || 8192;

  const scale = Math.pow(2, -zoom);
  const displayWidth = originalWidth * scale;
  const displayHeight = originalHeight * scale;
  const scaledTileSize = tileSize * scale;

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
      <div className="absolute bottom-4 left-4 z-10 bg-gray-800 text-white text-xs p-2 rounded space-y-1">
        <div>Tiles loaded: {visibleTiles.size} / {metadata.totalTiles}</div>
        <div>Bounds: col {metadata.minCol ?? 0}-{metadata.maxCol ?? (metadata.cols - 1)}, row {metadata.minRow ?? 0}-{metadata.maxRow ?? (metadata.rows - 1)}</div>
        <div>First tile: {Array.from(visibleTiles)[0] || 'none'}</div>
      </div>

      {/* Map container with scroll */}
      <div
        ref={containerRef}
        className="overflow-auto w-full bg-gray-900"
        style={{
          height: '100%',
          cursor: isDragging ? 'grabbing' : (onTileClick ? 'crosshair' : 'grab')
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <div
          ref={mapRef}
          className="relative"
          style={{
            width: displayWidth,
            height: displayHeight
          }}
          onClick={handleMapClick}
        >
          {/* Render visible tiles */}
          {Array.from(visibleTiles).map(tileKey => {
            const [, col, row] = tileKey.split('_').map(Number);

            // Adjust position based on minCol/minRow offset
            const minCol = metadata.minCol ?? 0;
            const minRow = metadata.minRow ?? 0;
            const displayCol = col - minCol;
            const displayRow = row - minRow;

            // Always request tiles at zoom level 0 (the base tiles)
            // Visual scaling is handled by CSS, not by tile pyramids
            return (
              <div
                key={tileKey}
                className="absolute"
                style={{
                  left: displayCol * scaledTileSize,
                  top: displayRow * scaledTileSize,
                  width: scaledTileSize,
                  height: scaledTileSize
                }}
              >
                <img
                  src={`/tile-data/${mapId}/0/${col}_${row}.${metadata.format}`}
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
