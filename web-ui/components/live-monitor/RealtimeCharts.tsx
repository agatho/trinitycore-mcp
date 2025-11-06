/**
 * Real-Time Charts Component
 *
 * Real-time visualizations for TrinityCore SOAP events.
 * Displays event rates, player counts, and event distribution.
 *
 * @module RealtimeCharts
 */

"use client";

import React, { useEffect, useState, useRef } from "react";
import type { SOAPEvent } from "../../../src/soap/websocket-server";

// ============================================================================
// Types
// ============================================================================

interface ChartsProps {
  /** Events to visualize */
  events: SOAPEvent[];

  /** Update interval (ms) */
  updateInterval?: number;

  /** Time window (ms) */
  timeWindow?: number;
}

interface DataPoint {
  timestamp: number;
  value: number;
}

interface EventRateData {
  total: DataPoint[];
  byType: Map<string, DataPoint[]>;
}

// ============================================================================
// Component
// ============================================================================

export default function RealtimeCharts({
  events,
  updateInterval = 1000,
  timeWindow = 60000, // 1 minute
}: ChartsProps) {
  const [eventRates, setEventRates] = useState<EventRateData>({
    total: [],
    byType: new Map(),
  });
  const [playerCounts, setPlayerCounts] = useState<DataPoint[]>([]);
  const [eventTypeDistribution, setEventTypeDistribution] = useState<Map<string, number>>(
    new Map(),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerCanvasRef = useRef<HTMLCanvasElement>(null);
  const distributionCanvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Update metrics
   */
  useEffect(() => {
    const interval = setInterval(() => {
      updateMetrics();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [events, updateInterval, timeWindow]);

  /**
   * Update metrics from events
   */
  const updateMetrics = () => {
    const now = Date.now();
    const cutoff = now - timeWindow;

    // Filter recent events
    const recentEvents = events.filter((e) => e.timestamp >= cutoff);

    // Calculate event rate
    const totalRate = recentEvents.length / (timeWindow / 1000); // events per second

    setEventRates((prev) => {
      const newTotal = [
        ...prev.total.filter((p) => p.timestamp >= cutoff),
        { timestamp: now, value: totalRate },
      ];

      // Calculate rates by type
      const byType = new Map<string, DataPoint[]>();
      const typeCounts = new Map<string, number>();

      for (const event of recentEvents) {
        typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
      }

      for (const [type, count] of typeCounts.entries()) {
        const rate = count / (timeWindow / 1000);
        const prevData = prev.byType.get(type) || [];
        byType.set(type, [
          ...prevData.filter((p) => p.timestamp >= cutoff),
          { timestamp: now, value: rate },
        ]);
      }

      return { total: newTotal, byType };
    });

    // Update player counts
    const playerEvents = recentEvents.filter((e) => e.type === "server.players");
    if (playerEvents.length > 0) {
      const latestPlayerEvent = playerEvents[playerEvents.length - 1];
      const count = (latestPlayerEvent.data.count as number) || 0;

      setPlayerCounts((prev) => [
        ...prev.filter((p) => p.timestamp >= cutoff),
        { timestamp: now, value: count },
      ]);
    }

    // Update event type distribution
    const distribution = new Map<string, number>();
    for (const event of recentEvents) {
      distribution.set(event.type, (distribution.get(event.type) || 0) + 1);
    }
    setEventTypeDistribution(distribution);
  };

  /**
   * Draw event rate chart
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw event rate line
    if (eventRates.total.length > 1) {
      drawLine(ctx, eventRates.total, canvas.width, canvas.height, "#3b82f6", 2);
    }

    // Draw legend
    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px sans-serif";
    ctx.fillText("Event Rate (events/sec)", 10, 20);
  }, [eventRates]);

  /**
   * Draw player count chart
   */
  useEffect(() => {
    if (!playerCanvasRef.current) return;

    const canvas = playerCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw player count line
    if (playerCounts.length > 1) {
      drawLine(ctx, playerCounts, canvas.width, canvas.height, "#10b981", 2);
    }

    // Draw legend
    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px sans-serif";
    ctx.fillText("Players Online", 10, 20);
  }, [playerCounts]);

  /**
   * Draw event distribution chart
   */
  useEffect(() => {
    if (!distributionCanvasRef.current) return;

    const canvas = distributionCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw bars
    if (eventTypeDistribution.size > 0) {
      drawBarChart(ctx, eventTypeDistribution, canvas.width, canvas.height);
    }
  }, [eventTypeDistribution]);

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {/* Event Rate Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Event Rate</h3>
        <canvas ref={canvasRef} width={400} height={200} className="w-full" />
        <div className="text-xs text-gray-400 mt-2">
          Current: {eventRates.total.length > 0
            ? eventRates.total[eventRates.total.length - 1].value.toFixed(2)
            : "0.00"}{" "}
          events/sec
        </div>
      </div>

      {/* Player Count Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Players Online</h3>
        <canvas ref={playerCanvasRef} width={400} height={200} className="w-full" />
        <div className="text-xs text-gray-400 mt-2">
          Current: {playerCounts.length > 0
            ? playerCounts[playerCounts.length - 1].value
            : 0}{" "}
          players
        </div>
      </div>

      {/* Event Distribution Chart */}
      <div className="bg-gray-800 rounded-lg p-4 col-span-2">
        <h3 className="text-sm font-semibold mb-2">Event Type Distribution</h3>
        <canvas ref={distributionCanvasRef} width={800} height={300} className="w-full" />
        <div className="text-xs text-gray-400 mt-2">
          Total: {Array.from(eventTypeDistribution.values()).reduce((a, b) => a + b, 0)} events
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Drawing Functions
// ============================================================================

/**
 * Draw grid lines
 */
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;

  // Horizontal lines
  for (let y = 0; y <= height; y += height / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vertical lines
  for (let x = 0; x <= width; x += width / 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

/**
 * Draw line chart
 */
function drawLine(
  ctx: CanvasRenderingContext2D,
  data: DataPoint[],
  width: number,
  height: number,
  color: string,
  lineWidth: number,
): void {
  if (data.length < 2) return;

  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Find min/max
  const minTime = data[0].timestamp;
  const maxTime = data[data.length - 1].timestamp;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Draw line
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const x = padding + ((point.timestamp - minTime) / (maxTime - minTime)) * chartWidth;
    const y = padding + chartHeight - (point.value / maxValue) * chartHeight;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Draw points
  ctx.fillStyle = color;
  for (const point of data) {
    const x = padding + ((point.timestamp - minTime) / (maxTime - minTime)) * chartWidth;
    const y = padding + chartHeight - (point.value / maxValue) * chartHeight;

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw bar chart
 */
function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: Map<string, number>,
  width: number,
  height: number,
): void {
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const entries = Array.from(data.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10); // Top 10

  if (entries.length === 0) return;

  const maxValue = Math.max(...entries.map(([, count]) => count));
  const barWidth = chartWidth / entries.length - 10;

  // Draw bars
  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
  ];

  for (let i = 0; i < entries.length; i++) {
    const [type, count] = entries[i];
    const x = padding + i * (barWidth + 10);
    const barHeight = (count / maxValue) * chartHeight;
    const y = padding + chartHeight - barHeight;

    // Draw bar
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, barWidth, barHeight);

    // Draw count
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(count.toString(), x + barWidth / 2, y - 5);

    // Draw label
    ctx.save();
    ctx.translate(x + barWidth / 2, height - 10);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(type.split(".").pop() || type, 0, 0);
    ctx.restore();
  }
}
