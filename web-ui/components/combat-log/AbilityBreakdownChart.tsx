/**
 * Ability Breakdown Chart Component
 *
 * Horizontal bar chart showing ability damage/healing breakdown
 */

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export interface AbilityData {
  name: string;
  value: number; // Damage or healing
  percentage: number;
  casts: number;
  color?: string;
}

export interface AbilityBreakdownChartProps {
  data: AbilityData[];
  title?: string;
  width?: number;
  height?: number;
  maxItems?: number;
  showPercentage?: boolean;
  className?: string;
}

export const AbilityBreakdownChart: React.FC<AbilityBreakdownChartProps> = ({
  data,
  title = "Ability Breakdown",
  width = 600,
  height = 400,
  maxItems = 10,
  showPercentage = true,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredAbility, setHoveredAbility] = useState<AbilityData | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Take top N items
    const chartData = data
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems);

    // Set up dimensions
    const margin = { top: 40, right: 100, bottom: 40, left: 150 };
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
      .text(title);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(chartData, (d) => d.value) || 0])
      .range([0, chartWidth]);

    const yScale = d3
      .scaleBand()
      .domain(chartData.map((d) => d.name))
      .range([0, chartHeight])
      .padding(0.2);

    // Color scale
    const colorScale = d3
      .scaleSequential()
      .domain([0, chartData.length - 1])
      .interpolator(d3.interpolateBlues);

    // Bars
    const bars = g
      .selectAll(".bar")
      .data(chartData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", (d) => yScale(d.name) || 0)
      .attr("height", yScale.bandwidth())
      .attr("rx", 4)
      .attr("fill", (d, i) => d.color || colorScale(i))
      .attr("opacity", 0.8)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("opacity", 1).attr("stroke", "#3b82f6").attr("stroke-width", 2);
        setHoveredAbility(d);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 0.8).attr("stroke", "none");
        setHoveredAbility(null);
      });

    // Animate bars
    bars
      .attr("width", 0)
      .transition()
      .duration(1000)
      .delay((d, i) => i * 50)
      .ease(d3.easeCubicOut)
      .attr("width", (d) => xScale(d.value));

    // Labels
    g.selectAll(".label")
      .data(chartData)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", -5)
      .attr("y", (d) => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dy", "0.35em")
      .attr("font-size", "12px")
      .attr("fill", "currentColor")
      .text((d) => d.name);

    // Values
    const valueLabels = g
      .selectAll(".value")
      .data(chartData)
      .enter()
      .append("text")
      .attr("class", "value")
      .attr("x", 0)
      .attr("y", (d) => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
      .attr("dx", "5")
      .attr("dy", "0.35em")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "#1f2937")
      .attr("opacity", 0);

    valueLabels
      .transition()
      .duration(1000)
      .delay((d, i) => i * 50 + 500)
      .attr("x", (d) => xScale(d.value))
      .attr("opacity", 1)
      .tween("text", function (d) {
        const interpolate = d3.interpolate(0, d.value);
        return function (t) {
          const value = interpolate(t);
          const text = showPercentage
            ? `${d.percentage.toFixed(1)}% (${Math.round(value).toLocaleString()})`
            : Math.round(value).toLocaleString();
          d3.select(this).text(text);
        };
      });

    // X-axis
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat((d) => {
      const num = Number(d);
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
      return num.toString();
    });

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(
        d3.axisBottom(xScale).ticks(5).tickSize(chartHeight).tickFormat(() => "")
      );
  }, [data, width, height, maxItems, title, showPercentage]);

  return (
    <div className={`relative ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
      {hoveredAbility && (
        <div
          className="absolute bg-gray-900 text-white px-4 py-3 rounded shadow-lg text-sm pointer-events-none z-10"
          style={{
            right: "10px",
            top: "50px",
          }}
        >
          <div className="font-bold text-lg mb-2">{hoveredAbility.name}</div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Total:</span>
              <span className="font-semibold">{hoveredAbility.value.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Percentage:</span>
              <span className="font-semibold">{hoveredAbility.percentage.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Casts:</span>
              <span className="font-semibold">{hoveredAbility.casts}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Per Cast:</span>
              <span className="font-semibold">
                {(hoveredAbility.value / hoveredAbility.casts).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
