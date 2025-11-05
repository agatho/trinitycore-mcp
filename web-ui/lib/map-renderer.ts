/**
 * TrinityCore Map Renderer
 *
 * Renders parsed .map files to HTML5 Canvas with support for:
 * - Heightmap visualization (grayscale, colored elevation, contour lines)
 * - Liquid overlay (water, lava, slime)
 * - Area boundaries
 * - Holes/gaps in terrain
 * - Interactive tooltips
 *
 * Features:
 * - Multiple color schemes
 * - Adjustable height exaggeration
 * - Layer blending
 * - Export to PNG
 */

import {
  ParsedMapFile,
  MapData,
  getHeightAt,
  getAreaAt,
  hasHoleAt,
  getLiquidTypeName,
  V9_SIZE,
  V8_SIZE,
  MapHeightHeaderFlags,
} from './map-file-parser';

// ============================================================================
// TYPES
// ============================================================================

export type ColorScheme =
  | 'grayscale'
  | 'elevation'
  | 'terrain'
  | 'heatmap'
  | 'custom';

export type RenderMode =
  | 'heightmap'
  | 'contours'
  | 'wireframe'
  | 'shaded';

export interface RenderOptions {
  colorScheme: ColorScheme;
  renderMode: RenderMode;
  showLiquid: boolean;
  showAreas: boolean;
  showHoles: boolean;
  showContours: boolean;
  heightExaggeration: number;
  contourInterval: number; // meters between contour lines
  opacity: number;
  customColors?: ColorGradient;
}

export interface ColorGradient {
  stops: Array<{ position: number; color: string }>;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

// ============================================================================
// COLOR SCHEMES
// ============================================================================

const COLOR_SCHEMES: Record<ColorScheme, ColorGradient> = {
  grayscale: {
    stops: [
      { position: 0, color: '#000000' },
      { position: 1, color: '#ffffff' },
    ],
  },
  elevation: {
    stops: [
      { position: 0.0, color: '#0000aa' }, // Deep water (blue)
      { position: 0.2, color: '#0055ff' }, // Shallow water
      { position: 0.3, color: '#ffff00' }, // Beach/sand (yellow)
      { position: 0.4, color: '#00aa00' }, // Lowlands (green)
      { position: 0.6, color: '#228b22' }, // Forest (dark green)
      { position: 0.7, color: '#8b4513' }, // Hills (brown)
      { position: 0.85, color: '#a0a0a0' }, // Mountains (gray)
      { position: 1.0, color: '#ffffff' }, // Snow peaks (white)
    ],
  },
  terrain: {
    stops: [
      { position: 0.0, color: '#1a4d2e' }, // Deep valleys
      { position: 0.3, color: '#4f772d' }, // Plains
      { position: 0.5, color: '#90a955' }, // Hills
      { position: 0.7, color: '#c8ae7d' }, // Highlands
      { position: 0.9, color: '#e8dcc4' }, // Mountain peaks
      { position: 1.0, color: '#ffffff' }, // Snow
    ],
  },
  heatmap: {
    stops: [
      { position: 0.0, color: '#00ff00' }, // Low (green)
      { position: 0.5, color: '#ffff00' }, // Medium (yellow)
      { position: 0.75, color: '#ff8800' }, // High (orange)
      { position: 1.0, color: '#ff0000' }, // Very high (red)
    ],
  },
  custom: {
    stops: [
      { position: 0, color: '#000000' },
      { position: 1, color: '#ffffff' },
    ],
  },
};

// ============================================================================
// RENDERER CLASS
// ============================================================================

export class MapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private parsedMap: ParsedMapFile | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;
  }

  /**
   * Load and render a parsed map file
   */
  async render(parsedMap: ParsedMapFile, options: Partial<RenderOptions> = {}): Promise<void> {
    this.parsedMap = parsedMap;

    const opts: RenderOptions = {
      colorScheme: options.colorScheme || 'elevation',
      renderMode: options.renderMode || 'heightmap',
      showLiquid: options.showLiquid !== false,
      showAreas: options.showAreas || false,
      showHoles: options.showHoles !== false,
      showContours: options.showContours || false,
      heightExaggeration: options.heightExaggeration || 1.0,
      contourInterval: options.contourInterval || 10,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      customColors: options.customColors,
    };

    // Render based on mode
    switch (opts.renderMode) {
      case 'heightmap':
        this.renderHeightmap(parsedMap, opts);
        break;
      case 'contours':
        this.renderContours(parsedMap, opts);
        break;
      case 'wireframe':
        this.renderWireframe(parsedMap, opts);
        break;
      case 'shaded':
        this.renderShaded(parsedMap, opts);
        break;
    }

    // Overlay layers
    if (opts.showLiquid) {
      this.renderLiquidOverlay(parsedMap, opts);
    }

    if (opts.showAreas) {
      this.renderAreaBoundaries(parsedMap, opts);
    }

    if (opts.showHoles) {
      this.renderHoles(parsedMap, opts);
    }

    if (opts.showContours && opts.renderMode !== 'contours') {
      this.renderContours(parsedMap, { ...opts, opacity: 0.5 });
    }
  }

  /**
   * Render heightmap as colored elevation
   */
  private renderHeightmap(parsedMap: ParsedMapFile, opts: RenderOptions): void {
    const { data, stats } = parsedMap;
    const { heightMap, heightFlags, gridHeight, gridMaxHeight } = data;

    if (!heightMap) {
      this.renderSolidColor('#888888');
      return;
    }

    // Create image data
    const width = V9_SIZE;
    const height = V9_SIZE;
    this.canvas.width = width;
    this.canvas.height = height;
    this.imageData = this.ctx.createImageData(width, height);

    const colorGradient = opts.customColors || COLOR_SCHEMES[opts.colorScheme];
    const minHeight = stats.minHeight;
    const maxHeight = stats.maxHeight;
    const heightRange = maxHeight - minHeight;

    // Render each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const heightValue = getHeightAt(heightMap, heightFlags, gridHeight, gridMaxHeight, x, y);

        // Normalize height to 0-1
        const normalizedHeight = heightRange > 0 ? (heightValue - minHeight) / heightRange : 0.5;

        // Apply height exaggeration
        const exaggerated = Math.pow(normalizedHeight, 1 / opts.heightExaggeration);

        // Get color from gradient
        const color = this.interpolateGradient(colorGradient, exaggerated);

        // Set pixel
        const index = (y * width + x) * 4;
        this.imageData.data[index + 0] = color.r;
        this.imageData.data[index + 1] = color.g;
        this.imageData.data[index + 2] = color.b;
        this.imageData.data[index + 3] = Math.floor(opts.opacity * 255);
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Render contour lines
   */
  private renderContours(parsedMap: ParsedMapFile, opts: RenderOptions): void {
    const { data, stats } = parsedMap;
    const { heightMap, heightFlags, gridHeight, gridMaxHeight } = data;

    if (!heightMap) return;

    // Setup canvas if not already done
    if (!this.imageData) {
      const width = V9_SIZE;
      const height = V9_SIZE;
      this.canvas.width = width;
      this.canvas.height = height;
      this.renderSolidColor('rgba(255, 255, 255, 0)');
    }

    this.ctx.strokeStyle = `rgba(0, 0, 0, ${opts.opacity})`;
    this.ctx.lineWidth = 1;

    const minHeight = stats.minHeight;
    const maxHeight = stats.maxHeight;
    const contourInterval = opts.contourInterval;

    // Generate contour levels
    const contours: number[] = [];
    for (let h = Math.ceil(minHeight / contourInterval) * contourInterval; h <= maxHeight; h += contourInterval) {
      contours.push(h);
    }

    // Draw contour lines using marching squares
    for (const contourHeight of contours) {
      this.drawContourLine(heightMap, heightFlags, gridHeight, gridMaxHeight, contourHeight);
    }
  }

  /**
   * Draw a single contour line at specified height
   */
  private drawContourLine(
    heightMap: Float32Array | Uint16Array | Uint8Array,
    flags: MapHeightHeaderFlags,
    gridHeight: number,
    gridMaxHeight: number,
    contourHeight: number
  ): void {
    // Simplified marching squares implementation
    for (let y = 0; y < V9_SIZE - 1; y++) {
      for (let x = 0; x < V9_SIZE - 1; x++) {
        const h1 = getHeightAt(heightMap, flags, gridHeight, gridMaxHeight, x, y);
        const h2 = getHeightAt(heightMap, flags, gridHeight, gridMaxHeight, x + 1, y);
        const h3 = getHeightAt(heightMap, flags, gridHeight, gridMaxHeight, x + 1, y + 1);
        const h4 = getHeightAt(heightMap, flags, gridHeight, gridMaxHeight, x, y + 1);

        // Check if contour crosses this cell
        const above = [h1 >= contourHeight, h2 >= contourHeight, h3 >= contourHeight, h4 >= contourHeight];
        const crossings = above.filter((a, i, arr) => a !== arr[(i + 1) % 4]).length;

        if (crossings > 0 && crossings < 4) {
          // Draw line segment (simplified)
          this.ctx.beginPath();
          this.ctx.moveTo(x + 0.5, y);
          this.ctx.lineTo(x + 0.5, y + 1);
          this.ctx.stroke();
        }
      }
    }
  }

  /**
   * Render wireframe mesh
   */
  private renderWireframe(parsedMap: ParsedMapFile, opts: RenderOptions): void {
    const { data } = parsedMap;
    const { heightMap, heightFlags, gridHeight, gridMaxHeight } = data;

    if (!heightMap) return;

    const width = V9_SIZE;
    const height = V9_SIZE;
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderSolidColor('rgba(0, 0, 0, 1)');

    this.ctx.strokeStyle = `rgba(0, 255, 0, ${opts.opacity})`;
    this.ctx.lineWidth = 1;

    // Draw grid
    const step = 4; // Draw every 4th line for performance
    for (let y = 0; y < height; y += step) {
      this.ctx.beginPath();
      for (let x = 0; x < width; x++) {
        if (x === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
    }

    for (let x = 0; x < width; x += step) {
      this.ctx.beginPath();
      for (let y = 0; y < height; y++) {
        if (y === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
    }
  }

  /**
   * Render shaded relief (hillshade)
   */
  private renderShaded(parsedMap: ParsedMapFile, opts: RenderOptions): void {
    const { data, stats } = parsedMap;
    const { heightMap, heightFlags, gridHeight, gridMaxHeight } = data;

    if (!heightMap) {
      this.renderSolidColor('#888888');
      return;
    }

    const width = V9_SIZE;
    const height = V9_SIZE;
    this.canvas.width = width;
    this.canvas.height = height;
    this.imageData = this.ctx.createImageData(width, height);

    // Light direction (45° from top-left)
    const lightDir = { x: -0.707, y: -0.707, z: 1.0 };
    const normalize = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
    lightDir.x /= normalize;
    lightDir.y /= normalize;
    lightDir.z /= normalize;

    // Calculate shading for each pixel
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Calculate surface normal using neighboring heights
        const hL = getHeightAt(heightMap, heightFlags, gridHeight, gridMaxHeight, x - 1, y);
        const hR = getHeightAt(heightMap, heightFlags, gridHeight, gridMaxHeight, x + 1, y);
        const hT = getHeightAt(heightMap, heightFlags, gridHeight, gridMaxHeight, x, y - 1);
        const hB = getHeightAt(heightMap, heightFlags, gridHeight, gridMaxHeight, x, y + 1);

        // Calculate gradients
        const dx = (hR - hL) / 2.0;
        const dy = (hB - hT) / 2.0;

        // Surface normal
        const nx = -dx;
        const ny = -dy;
        const nz = 1.0;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);

        // Dot product with light direction
        const dot = (nx * lightDir.x + ny * lightDir.y + nz * lightDir.z) / nLen;
        const shade = Math.max(0, Math.min(1, dot));

        // Apply shade to grayscale
        const intensity = Math.floor(shade * 255);

        const index = (y * width + x) * 4;
        this.imageData.data[index + 0] = intensity;
        this.imageData.data[index + 1] = intensity;
        this.imageData.data[index + 2] = intensity;
        this.imageData.data[index + 3] = Math.floor(opts.opacity * 255);
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Render liquid overlay
   */
  private renderLiquidOverlay(parsedMap: ParsedMapFile, opts: RenderOptions): void {
    const { data } = parsedMap;
    const { liquidMap, liquidHeader, liquidEntry, liquidFlags } = data;

    if (!liquidHeader || !liquidFlags) return;

    const offsetX = liquidHeader.offsetX;
    const offsetY = liquidHeader.offsetY;
    const width = liquidHeader.width;
    const height = liquidHeader.height;

    // Determine liquid color based on type
    let liquidColor = { r: 0, g: 150, b: 255, a: 100 }; // Default water blue
    const liquidTypeName = getLiquidTypeName(liquidHeader.liquidType);

    if (liquidTypeName.includes('Lava') || liquidTypeName.includes('Magma')) {
      liquidColor = { r: 255, g: 100, b: 0, a: 120 }; // Orange
    } else if (liquidTypeName.includes('Slime')) {
      liquidColor = { r: 100, g: 255, b: 0, a: 100 }; // Green
    } else if (liquidTypeName.includes('Dark')) {
      liquidColor = { r: 20, g: 20, b: 60, a: 150 }; // Dark blue
    } else if (liquidTypeName.includes('Ocean')) {
      liquidColor = { r: 0, g: 100, b: 200, a: 120 }; // Deep blue
    }

    // Draw liquid tiles
    this.ctx.fillStyle = `rgba(${liquidColor.r}, ${liquidColor.g}, ${liquidColor.b}, ${liquidColor.a / 255})`;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const flags = liquidFlags[index];

        // Check if this tile has liquid
        if (flags !== 0) {
          const canvasX = offsetX + x;
          const canvasY = offsetY + y;
          this.ctx.fillRect(canvasX, canvasY, 1, 1);
        }
      }
    }
  }

  /**
   * Render area boundaries
   */
  private renderAreaBoundaries(parsedMap: ParsedMapFile, opts: RenderOptions): void {
    const { data } = parsedMap;
    const { areaMap } = data;

    if (!areaMap) return;

    this.ctx.strokeStyle = `rgba(255, 255, 0, ${opts.opacity * 0.7})`;
    this.ctx.lineWidth = 2;

    // Detect area boundaries by checking neighboring cells
    for (let y = 0; y < V8_SIZE - 1; y++) {
      for (let x = 0; x < V8_SIZE - 1; x++) {
        const area1 = getAreaAt(areaMap, x, y);
        const area2 = getAreaAt(areaMap, x + 1, y);
        const area3 = getAreaAt(areaMap, x, y + 1);

        // Draw vertical boundary
        if (area1 !== area2) {
          this.ctx.beginPath();
          this.ctx.moveTo(x + 1, y);
          this.ctx.lineTo(x + 1, y + 1);
          this.ctx.stroke();
        }

        // Draw horizontal boundary
        if (area1 !== area3) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y + 1);
          this.ctx.lineTo(x + 1, y + 1);
          this.ctx.stroke();
        }
      }
    }
  }

  /**
   * Render holes (missing terrain)
   */
  private renderHoles(parsedMap: ParsedMapFile, opts: RenderOptions): void {
    const { data } = parsedMap;
    const { holes } = data;

    if (!holes) return;

    this.ctx.fillStyle = `rgba(255, 0, 0, ${opts.opacity * 0.5})`;

    // Each hole represents a 16x16 block
    const holeSize = V8_SIZE / 8;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (hasHoleAt(holes, row, col)) {
          const x = col * holeSize;
          const y = row * holeSize;
          this.ctx.fillRect(x, y, holeSize, holeSize);
        }
      }
    }
  }

  /**
   * Render solid color background
   */
  private renderSolidColor(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Interpolate color from gradient
   */
  private interpolateGradient(gradient: ColorGradient, position: number): { r: number; g: number; b: number } {
    const stops = gradient.stops;

    // Clamp position
    position = Math.max(0, Math.min(1, position));

    // Find surrounding stops
    let lowerStop = stops[0];
    let upperStop = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
      if (position >= stops[i].position && position <= stops[i + 1].position) {
        lowerStop = stops[i];
        upperStop = stops[i + 1];
        break;
      }
    }

    // Interpolate between stops
    const range = upperStop.position - lowerStop.position;
    const t = range > 0 ? (position - lowerStop.position) / range : 0;

    const lower = this.parseColor(lowerStop.color);
    const upper = this.parseColor(upperStop.color);

    return {
      r: Math.floor(lower.r + (upper.r - lower.r) * t),
      g: Math.floor(lower.g + (upper.g - lower.g) * t),
      b: Math.floor(lower.b + (upper.b - lower.b) * t),
    };
  }

  /**
   * Parse hex color to RGB
   */
  private parseColor(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  /**
   * Export canvas to PNG
   */
  exportToPNG(filename: string = 'map.png'): void {
    this.canvas.toBlob(blob => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Get height at mouse position
   */
  getHeightAtPosition(canvasX: number, canvasY: number): number | null {
    if (!this.parsedMap) return null;

    const { data, stats } = this.parsedMap;
    const { heightMap, heightFlags, gridHeight, gridMaxHeight } = data;

    if (!heightMap) return null;

    // Convert canvas coordinates to grid coordinates
    const gridX = Math.floor(canvasX);
    const gridY = Math.floor(canvasY);

    if (gridX < 0 || gridX >= V9_SIZE || gridY < 0 || gridY >= V9_SIZE) {
      return null;
    }

    return getHeightAt(heightMap, heightFlags, gridHeight, gridMaxHeight, gridX, gridY);
  }

  /**
   * Get area ID at mouse position
   */
  getAreaAtPosition(canvasX: number, canvasY: number): number | null {
    if (!this.parsedMap) return null;

    const { data } = this.parsedMap;
    const { areaMap } = data;

    if (!areaMap) return null;

    const gridX = Math.floor(canvasX);
    const gridY = Math.floor(canvasY);

    return getAreaAt(areaMap, gridX, gridY);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a color gradient
 */
export function createColorGradient(stops: Array<{ position: number; color: string }>): ColorGradient {
  // Sort stops by position
  stops.sort((a, b) => a.position - b.position);
  return { stops };
}

/**
 * Get default render options
 */
export function getDefaultRenderOptions(): RenderOptions {
  return {
    colorScheme: 'elevation',
    renderMode: 'heightmap',
    showLiquid: true,
    showAreas: false,
    showHoles: true,
    showContours: false,
    heightExaggeration: 1.0,
    contourInterval: 10,
    opacity: 1.0,
  };
}
