/**
 * DPS Chart Component
 *
 * Interactive line chart showing DPS over time with D3.js
 */

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface DPSDataPoint {
  timestamp: number;
  dps: number;
  phase?: string;
}

export interface DPSChartProps {
  data: DPSDataPoint[];
  width?: number;
  height?: number;
  showPhases?: boolean;
  interactive?: boolean;
  className?: string;
}

export const DPSChart: React.FC<DPSChartProps> = ({
  data,
  width = 800,
  height = 400,
  showPhases = true,
  interactive = true,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DPSDataPoint | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
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

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.timestamp) || 0])
      .range([0, chartWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.dps) || 0])
      .range([chartHeight, 0])
      .nice();

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat((d) => `${d}s`);
    const yAxis = d3.axisLeft(yScale).ticks(8);

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

    g.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -45)
      .attr("fill", "currentColor")
      .attr("text-anchor", "middle")
      .text("DPS");

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(d3.axisLeft(yScale).ticks(8).tickSize(-chartWidth).tickFormat(() => ""));

    // Area under curve
    const area = d3
      .area<DPSDataPoint>()
      .x((d) => xScale(d.timestamp))
      .y0(chartHeight)
      .y1((d) => yScale(d.dps))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("class", "area")
      .attr("d", area)
      .attr("fill", "url(#gradient)")
      .attr("opacity", 0.3);

    // Gradient
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#93c5fd");

    // Line
    const line = d3
      .line<DPSDataPoint>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d.dps))
      .curve(d3.curveMonotoneX);

    const path = g
      .append("path")
      .datum(data)
      .attr("class", "line")
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2);

    // Animate line
    const totalLength = path.node()?.getTotalLength() || 0;
    path
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    // Phase markers
    if (showPhases) {
      const phases = data.filter((d) => d.phase);
      g.selectAll(".phase-marker")
        .data(phases)
        .enter()
        .append("line")
        .attr("class", "phase-marker")
        .attr("x1", (d) => xScale(d.timestamp))
        .attr("x2", (d) => xScale(d.timestamp))
        .attr("y1", 0)
        .attr("y2", chartHeight)
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.5);

      g.selectAll(".phase-label")
        .data(phases)
        .enter()
        .append("text")
        .attr("class", "phase-label")
        .attr("x", (d) => xScale(d.timestamp) + 5)
        .attr("y", 15)
        .attr("fill", "#ef4444")
        .attr("font-size", "12px")
        .text((d) => d.phase || "");
    }

    // Interactive hover
    if (interactive) {
      const focus = g.append("g").attr("class", "focus").style("display", "none");

      focus
        .append("circle")
        .attr("r", 5)
        .attr("fill", "#3b82f6")
        .attr("stroke", "white")
        .attr("stroke-width", 2);

      focus
        .append("line")
        .attr("class", "x-hover-line")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

      const overlay = g
        .append("rect")
        .attr("class", "overlay")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("opacity", 0)
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => {
          focus.style("display", "none");
          setHoveredPoint(null);
        })
        .on("mousemove", function (event) {
          const [mouseX] = d3.pointer(event);
          const x0 = xScale.invert(mouseX);

          // Find closest data point
          const bisect = d3.bisector<DPSDataPoint, number>((d) => d.timestamp).left;
          const index = bisect(data, x0, 1);
          const d0 = data[index - 1];
          const d1 = data[index];
          const d = !d1 || (d0 && x0 - d0.timestamp < d1.timestamp - x0) ? d0 : d1;

          if (d) {
            focus.attr("transform", `translate(${xScale(d.timestamp)},${yScale(d.dps)})`);
            focus
              .select(".x-hover-line")
              .attr("x1", 0)
              .attr("x2", 0)
              .attr("y1", 0)
              .attr("y2", chartHeight - yScale(d.dps));

            setHoveredPoint(d);
          }
        });
    }

    // Average line
    const avgDPS = d3.mean(data, (d) => d.dps) || 0;
    g.append("line")
      .attr("class", "avg-line")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", yScale(avgDPS))
      .attr("y2", yScale(avgDPS))
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .attr("opacity", 0.6);

    g.append("text")
      .attr("x", chartWidth - 5)
      .attr("y", yScale(avgDPS) - 5)
      .attr("fill", "#10b981")
      .attr("font-size", "12px")
      .attr("text-anchor", "end")
      .text(`Avg: ${avgDPS.toFixed(0)}`);
  }, [data, width, height, showPhases, interactive]);

  return (
    <div className={`relative ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
      {interactive && hoveredPoint && (
        <div
          ref={tooltipRef}
          className="absolute bg-gray-900 text-white px-3 py-2 rounded shadow-lg text-sm pointer-events-none"
          style={{
            left: "50%",
            top: "10px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-bold">{hoveredPoint.dps.toFixed(0)} DPS</div>
          <div className="text-gray-400">Time: {hoveredPoint.timestamp.toFixed(1)}s</div>
          {hoveredPoint.phase && (
            <div className="text-red-400">Phase: {hoveredPoint.phase}</div>
          )}
        </div>
      )}
    </div>
  );
};
