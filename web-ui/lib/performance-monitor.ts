/**
 * Performance Monitoring System
 *
 * Tracks FPS, memory usage, draw calls, and provides performance insights
 * for the World Editor.
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number; // ms
  memoryUsed: number; // MB
  memoryLimit: number; // MB
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

export interface PerformanceHistory {
  timestamp: number;
  fps: number;
  frameTime: number;
  memory: number;
}

export interface PerformanceRecommendation {
  severity: 'info' | 'warning' | 'critical';
  category: 'fps' | 'memory' | 'drawCalls' | 'assets';
  message: string;
  action?: string;
}

export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private currentFPS = 60;
  private frameTimeMs = 16.67;
  private history: PerformanceHistory[] = [];
  private maxHistoryLength = 300; // 5 minutes at 1 sample/sec

  private recommendations: PerformanceRecommendation[] = [];

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring() {
    setInterval(() => {
      this.updateRecommendations();
    }, 5000); // Update recommendations every 5 seconds
  }

  /**
   * Update frame statistics (call every frame)
   */
  public updateFrame(renderer?: THREE.WebGLRenderer): void {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    // Update FPS every second
    if (deltaTime >= 1000) {
      this.currentFPS = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameTimeMs = deltaTime / this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;

      // Add to history
      const metrics = this.getMetrics(renderer);
      this.history.push({
        timestamp: Date.now(),
        fps: metrics.fps,
        frameTime: metrics.frameTime,
        memory: metrics.memoryUsed,
      });

      // Trim history
      if (this.history.length > this.maxHistoryLength) {
        this.history.shift();
      }
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(renderer?: THREE.WebGLRenderer): PerformanceMetrics {
    const memory = this.getMemoryInfo();
    const renderInfo = this.getRenderInfo(renderer);

    return {
      fps: this.currentFPS,
      frameTime: this.frameTimeMs,
      memoryUsed: memory.used,
      memoryLimit: memory.limit,
      ...renderInfo,
    };
  }

  /**
   * Get memory information
   */
  private getMemoryInfo(): { used: number; limit: number } {
    if ('memory' in performance && (performance as any).memory) {
      const mem = (performance as any).memory;
      return {
        used: Math.round(mem.usedJSHeapSize / 1024 / 1024),
        limit: Math.round(mem.jsHeapSizeLimit / 1024 / 1024),
      };
    }
    return { used: 0, limit: 0 };
  }

  /**
   * Get rendering information from Three.js renderer
   */
  private getRenderInfo(renderer?: THREE.WebGLRenderer): {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
    programs: number;
  } {
    if (!renderer) {
      return {
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
        programs: 0,
      };
    }

    const info = renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length || 0,
    };
  }

  /**
   * Get performance history
   */
  public getHistory(): PerformanceHistory[] {
    return [...this.history];
  }

  /**
   * Get performance recommendations
   */
  public getRecommendations(): PerformanceRecommendation[] {
    return [...this.recommendations];
  }

  /**
   * Update performance recommendations based on metrics
   */
  private updateRecommendations(): void {
    this.recommendations = [];

    const avgFPS = this.calculateAverageFPS();
    const metrics = this.getMetrics();

    // FPS recommendations
    if (avgFPS < 30) {
      this.recommendations.push({
        severity: 'critical',
        category: 'fps',
        message: `Critical: FPS below 30 (current: ${avgFPS.toFixed(0)})`,
        action: 'Reduce visible tiles or disable shadows',
      });
    } else if (avgFPS < 45) {
      this.recommendations.push({
        severity: 'warning',
        category: 'fps',
        message: `Warning: FPS below 45 (current: ${avgFPS.toFixed(0)})`,
        action: 'Consider reducing visual quality settings',
      });
    }

    // Memory recommendations
    if (metrics.memoryLimit > 0) {
      const memoryUsage = (metrics.memoryUsed / metrics.memoryLimit) * 100;
      if (memoryUsage > 90) {
        this.recommendations.push({
          severity: 'critical',
          category: 'memory',
          message: `Critical: Memory usage at ${memoryUsage.toFixed(0)}%`,
          action: 'Clear unused collision data or restart editor',
        });
      } else if (memoryUsage > 75) {
        this.recommendations.push({
          severity: 'warning',
          category: 'memory',
          message: `Warning: Memory usage at ${memoryUsage.toFixed(0)}%`,
          action: 'Consider unloading unused map tiles',
        });
      }
    }

    // Draw call recommendations
    if (metrics.drawCalls > 1000) {
      this.recommendations.push({
        severity: 'warning',
        category: 'drawCalls',
        message: `High draw calls: ${metrics.drawCalls}`,
        action: 'Enable mesh instancing or reduce visible objects',
      });
    }

    // Asset recommendations
    if (metrics.textures > 200) {
      this.recommendations.push({
        severity: 'info',
        category: 'assets',
        message: `Many textures loaded: ${metrics.textures}`,
        action: 'Consider texture atlas optimization',
      });
    }

    if (metrics.geometries > 500) {
      this.recommendations.push({
        severity: 'info',
        category: 'assets',
        message: `Many geometries loaded: ${metrics.geometries}`,
        action: 'Consider geometry merging or LOD system',
      });
    }
  }

  /**
   * Calculate average FPS over last 30 samples
   */
  private calculateAverageFPS(): number {
    if (this.history.length === 0) return this.currentFPS;

    const recent = this.history.slice(-30);
    const sum = recent.reduce((acc, h) => acc + h.fps, 0);
    return sum / recent.length;
  }

  /**
   * Reset performance monitoring
   */
  public reset(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.currentFPS = 60;
    this.frameTimeMs = 16.67;
    this.history = [];
    this.recommendations = [];
  }

  /**
   * Get performance grade
   */
  public getPerformanceGrade(): { grade: string; color: string; message: string } {
    const avgFPS = this.calculateAverageFPS();

    if (avgFPS >= 55) {
      return {
        grade: 'Excellent',
        color: 'text-green-400',
        message: 'Performance is optimal',
      };
    } else if (avgFPS >= 45) {
      return {
        grade: 'Good',
        color: 'text-blue-400',
        message: 'Performance is good',
      };
    } else if (avgFPS >= 30) {
      return {
        grade: 'Fair',
        color: 'text-yellow-400',
        message: 'Performance could be improved',
      };
    } else {
      return {
        grade: 'Poor',
        color: 'text-red-400',
        message: 'Performance needs attention',
      };
    }
  }
}

// Singleton instance
let monitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }
  return monitorInstance;
}
