/**
 * Performance Gauge Component
 *
 * Radial gauge showing performance rating with D3.js
 */

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface PerformanceGaugeProps {
  score: number; // 0-100
  label: string;
  grade?: "S" | "A" | "B" | "C" | "D" | "F";
  size?: number;
  showDetails?: boolean;
  className?: string;
}

export const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({
  score,
  label,
  grade,
  size = 200,
  showDetails = true,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous gauge
    d3.select(svgRef.current).selectAll("*").remove();

    const radius = size / 2;
    const strokeWidth = size * 0.15;
    const innerRadius = radius - strokeWidth;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", size)
      .attr("height", size);

    const g = svg
      .append("g")
      .attr("transform", `translate(${radius},${radius})`);

    // Color scale
    const colorScale = d3
      .scaleLinear<string>()
      .domain([0, 50, 70, 85, 95, 100])
      .range(["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981"]);

    // Background arc
    const backgroundArc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2);

    g.append("path")
      .attr("d", backgroundArc as any)
      .attr("fill", "#1f2937")
      .attr("opacity", 0.3);

    // Foreground arc (animated)
    const angle = ((score / 100) * Math.PI) - (Math.PI / 2);

    const foregroundArc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2);

    const path = g
      .append("path")
      .datum({ endAngle: -Math.PI / 2 })
      .attr("d", foregroundArc as any)
      .attr("fill", colorScale(score));

    // Animate
    path
      .transition()
      .duration(1500)
      .ease(d3.easeCubicOut)
      .attrTween("d", function (d: any) {
        const interpolate = d3.interpolate(d.endAngle, angle);
        return function (t: number) {
          d.endAngle = interpolate(t);
          return foregroundArc(d as any) || "";
        };
      });

    // Score text
    const scoreText = g
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("font-size", `${size * 0.2}px`)
      .attr("font-weight", "bold")
      .attr("fill", colorScale(score))
      .text("0");

    scoreText
      .transition()
      .duration(1500)
      .ease(d3.easeCubicOut)
      .tween("text", function () {
        const interpolate = d3.interpolate(0, score);
        return function (t: number) {
          d3.select(this).text(Math.round(interpolate(t)));
        };
      });

    // Label
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("font-size", `${size * 0.08}px`)
      .attr("fill", "#9ca3af")
      .text(label);

    // Grade badge
    if (grade) {
      const gradeColors: Record<string, string> = {
        S: "#FFD700",
        A: "#00FF00",
        B: "#7FFF00",
        C: "#FFFF00",
        D: "#FFA500",
        F: "#FF0000",
      };

      g.append("circle")
        .attr("cx", radius * 0.7)
        .attr("cy", -radius * 0.7)
        .attr("r", size * 0.12)
        .attr("fill", gradeColors[grade])
        .attr("opacity", 0)
        .transition()
        .delay(1000)
        .duration(500)
        .attr("opacity", 1);

      g.append("text")
        .attr("x", radius * 0.7)
        .attr("y", -radius * 0.7)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", `${size * 0.1}px`)
        .attr("font-weight", "bold")
        .attr("fill", "#000")
        .attr("opacity", 0)
        .text(grade)
        .transition()
        .delay(1000)
        .duration(500)
        .attr("opacity", 1);
    }

    // Tick marks
    const numTicks = 11;
    for (let i = 0; i <= numTicks; i++) {
      const tickAngle = -Math.PI / 2 + (i / numTicks) * Math.PI;
      const tickLength = i % 2 === 0 ? strokeWidth * 0.4 : strokeWidth * 0.2;

      g.append("line")
        .attr("x1", Math.cos(tickAngle) * (radius - strokeWidth - 5))
        .attr("y1", Math.sin(tickAngle) * (radius - strokeWidth - 5))
        .attr("x2", Math.cos(tickAngle) * (radius - strokeWidth - 5 - tickLength))
        .attr("y2", Math.sin(tickAngle) * (radius - strokeWidth - 5 - tickLength))
        .attr("stroke", "#4b5563")
        .attr("stroke-width", 2)
        .attr("opacity", 0.5);

      if (i % 2 === 0) {
        const labelRadius = radius - strokeWidth - 20;
        const labelValue = (i / numTicks) * 100;

        g.append("text")
          .attr("x", Math.cos(tickAngle) * labelRadius)
          .attr("y", Math.sin(tickAngle) * labelRadius)
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("font-size", `${size * 0.06}px`)
          .attr("fill", "#6b7280")
          .text(Math.round(labelValue));
      }
    }
  }, [score, label, grade, size]);

  const getGradeLabel = (grade?: string): string => {
    const labels: Record<string, string> = {
      S: "Exceptional",
      A: "Excellent",
      B: "Good",
      C: "Average",
      D: "Below Average",
      F: "Poor",
    };
    return grade ? labels[grade] : "";
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg ref={svgRef} className="drop-shadow-lg" />
      {showDetails && grade && (
        <div className="mt-2 text-center">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Grade {grade}
          </div>
          <div className="text-xs text-gray-500">{getGradeLabel(grade)}</div>
        </div>
      )}
    </div>
  );
};
