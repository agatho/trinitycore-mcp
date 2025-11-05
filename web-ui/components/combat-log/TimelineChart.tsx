/**
 * Timeline Chart Component
 *
 * Interactive timeline showing combat events, cooldowns, and phases
 */

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface TimelineEvent {
  timestamp: number;
  type: "cast" | "cooldown" | "phase" | "death" | "interrupt" | "buff" | "debuff";
  name: string;
  duration?: number;
  importance?: "high" | "medium" | "low";
  color?: string;
}

export interface TimelineChartProps {
  events: TimelineEvent[];
  duration: number; // Total combat duration in seconds
  width?: number;
  height?: number;
  className?: string;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  events,
  duration,
  width = 800,
  height = 300,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!svgRef.current || events.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 40, right: 30, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .attr("fill", "currentColor")
      .text("Combat Timeline");

    // Scales
    const xScale = d3.scaleLinear().domain([0, duration]).range([0, chartWidth]);

    // Event types with lane assignments
    const eventLanes: Record<string, number> = {
      phase: 0,
      cooldown: 1,
      buff: 2,
      debuff: 3,
      interrupt: 4,
      cast: 5,
      death: 6,
    };

    const laneHeight = chartHeight / Object.keys(eventLanes).length;

    // Color mapping
    const colorMap: Record<string, string> = {
      phase: "#ef4444",
      cooldown: "#3b82f6",
      buff: "#10b981",
      debuff: "#f59e0b",
      interrupt: "#8b5cf6",
      cast: "#6b7280",
      death: "#dc2626",
    };

    // Draw lane backgrounds
    Object.keys(eventLanes).forEach((type) => {
      const lane = eventLanes[type];
      g.append("rect")
        .attr("x", 0)
        .attr("y", lane * laneHeight)
        .attr("width", chartWidth)
        .attr("height", laneHeight)
        .attr("fill", lane % 2 === 0 ? "#f9fafb" : "#ffffff")
        .attr("opacity", 0.3);

      // Lane label
      g.append("text")
        .attr("x", -5)
        .attr("y", lane * laneHeight + laneHeight / 2)
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .attr("font-size", "11px")
        .attr("fill", "#6b7280")
        .text(type.charAt(0).toUpperCase() + type.slice(1));
    });

    // Group events by type
    const groupedEvents = d3.group(events, (d) => d.type);

    // Draw events
    groupedEvents.forEach((typeEvents, type) => {
      const lane = eventLanes[type];
      const y = lane * laneHeight + laneHeight * 0.2;
      const eventHeight = laneHeight * 0.6;

      typeEvents.forEach((event) => {
        const x = xScale(event.timestamp);
        const eventWidth = event.duration ? xScale(event.duration) : 3;
        const color = event.color || colorMap[type];

        if (event.duration && event.duration > 0) {
          // Duration event (rectangle)
          const rect = g
            .append("rect")
            .attr("x", x)
            .attr("y", y)
            .attr("width", 0)
            .attr("height", eventHeight)
            .attr("fill", color)
            .attr("opacity", 0.7)
            .attr("rx", 2)
            .style("cursor", "pointer");

          // Animate
          rect
            .transition()
            .duration(500)
            .delay(event.timestamp * 10)
            .attr("width", eventWidth);

          // Hover
          rect
            .on("mouseenter", function (e) {
              d3.select(this).attr("opacity", 1).attr("stroke", "#000").attr("stroke-width", 2);
              setHoveredEvent(event);
              setMousePos({ x: e.pageX, y: e.pageY });
            })
            .on("mouseleave", function () {
              d3.select(this).attr("opacity", 0.7).attr("stroke", "none");
              setHoveredEvent(null);
            });
        } else {
          // Instant event (circle or marker)
          const marker = type === "death" || type === "phase" ? "triangle" : "circle";

          if (marker === "circle") {
            const circle = g
              .append("circle")
              .attr("cx", x)
              .attr("cy", y + eventHeight / 2)
              .attr("r", 0)
              .attr("fill", color)
              .attr("stroke", "#fff")
              .attr("stroke-width", 2)
              .style("cursor", "pointer");

            circle
              .transition()
              .duration(300)
              .delay(event.timestamp * 10)
              .attr("r", 5);

            circle
              .on("mouseenter", function (e) {
                d3.select(this).attr("r", 7);
                setHoveredEvent(event);
                setMousePos({ x: e.pageX, y: e.pageY });
              })
              .on("mouseleave", function () {
                d3.select(this).attr("r", 5);
                setHoveredEvent(null);
              });
          } else {
            // Triangle marker
            const triangleSize = 8;
            const path = g
              .append("path")
              .attr(
                "d",
                d3.symbol().type(d3.symbolTriangle).size(triangleSize * triangleSize) as any
              )
              .attr("transform", `translate(${x},${y + eventHeight / 2})`)
              .attr("fill", color)
              .attr("stroke", "#fff")
              .attr("stroke-width", 2)
              .attr("opacity", 0)
              .style("cursor", "pointer");

            path
              .transition()
              .duration(300)
              .delay(event.timestamp * 10)
              .attr("opacity", 1);

            path
              .on("mouseenter", function (e) {
                d3.select(this).attr("transform", `translate(${x},${y + eventHeight / 2}) scale(1.3)`);
                setHoveredEvent(event);
                setMousePos({ x: e.pageX, y: e.pageY });
              })
              .on("mouseleave", function () {
                d3.select(this).attr("transform", `translate(${x},${y + eventHeight / 2})`);
                setHoveredEvent(null);
              });
          }
        }
      });
    });

    // X-axis
    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat((d) => `${d}s`);

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", chartWidth / 2)
      .attr("y", 35)
      .attr("fill", "currentColor")
      .attr("text-anchor", "middle")
      .text("Time (seconds)");

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(20)
          .tickSize(chartHeight)
          .tickFormat(() => "")
      );

    // Current time indicator (optional - for live tracking)
    const currentTimeIndicator = g
      .append("line")
      .attr("class", "current-time")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", 0)
      .attr("y2", chartHeight)
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 2)
      .attr("opacity", 0);
  }, [events, duration, width, height]);

  const getEventTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      cast: "Ability Cast",
      cooldown: "Cooldown Usage",
      phase: "Phase Change",
      death: "Death",
      interrupt: "Interrupt",
      buff: "Buff Applied",
      debuff: "Debuff Applied",
    };
    return labels[type] || type;
  };

  return (
    <div className={`relative ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
      {hoveredEvent && (
        <div
          className="fixed bg-gray-900 text-white px-4 py-3 rounded shadow-xl text-sm pointer-events-none z-50"
          style={{
            left: `${mousePos.x + 10}px`,
            top: `${mousePos.y - 10}px`,
            transform: "translateY(-100%)",
          }}
        >
          <div className="font-bold text-base mb-1">{hoveredEvent.name}</div>
          <div className="space-y-0.5">
            <div className="text-xs text-gray-400">
              {getEventTypeLabel(hoveredEvent.type)}
            </div>
            <div className="text-xs">
              Time: <span className="font-semibold">{hoveredEvent.timestamp.toFixed(2)}s</span>
            </div>
            {hoveredEvent.duration && (
              <div className="text-xs">
                Duration:{" "}
                <span className="font-semibold">{hoveredEvent.duration.toFixed(2)}s</span>
              </div>
            )}
            {hoveredEvent.importance && (
              <div className="text-xs">
                Importance:{" "}
                <span
                  className={`font-semibold ${
                    hoveredEvent.importance === "high"
                      ? "text-red-400"
                      : hoveredEvent.importance === "medium"
                      ? "text-yellow-400"
                      : "text-gray-400"
                  }`}
                >
                  {hoveredEvent.importance}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
