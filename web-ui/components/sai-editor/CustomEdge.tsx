/**
 * Custom Edge Component - Animated Connections
 *
 * Professional animated edges for SAI connections with status indicators.
 * Features: Flow animations, status colors, interaction feedback.
 */

'use client';

import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeProps,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from 'reactflow';

interface CustomEdgeData {
  animated?: boolean;
  status?: 'active' | 'inactive' | 'error' | 'warning';
  executionCount?: number;
  lastExecuted?: number;
  label?: string;
  isLinkEdge?: boolean; // Special styling for event link chains
}

const CustomEdge: React.FC<EdgeProps<CustomEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  selected,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine path type based on connection
  const getPathFunction = () => {
    if (data?.animated) {
      return getStraightPath;
    }
    return getBezierPath;
  };

  const pathFunction = getPathFunction();
  const [edgePath, labelX, labelY] = pathFunction({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get edge color based on status
  const getEdgeColor = () => {
    // Link edges are always orange
    if (data?.isLinkEdge) {
      if (selected) return '#fb923c'; // Lighter orange for selected
      if (isHovered) return '#fdba74'; // Even lighter orange for hover
      return '#f97316'; // Standard orange for link edges
    }

    if (selected) return '#3b82f6'; // Blue
    if (isHovered) return '#60a5fa'; // Light blue

    switch (data?.status) {
      case 'active':
        return '#10b981'; // Green
      case 'error':
        return '#ef4444'; // Red
      case 'warning':
        return '#f59e0b'; // Amber
      case 'inactive':
        return '#6b7280'; // Gray
      default:
        return '#94a3b8'; // Slate
    }
  };

  // Get stroke width based on state
  const getStrokeWidth = () => {
    if (selected) return 3;
    if (isHovered) return 2.5;
    return 2;
  };

  const edgeColor = getEdgeColor();
  const strokeWidth = getStrokeWidth();

  return (
    <>
      {/* Background glow for selected/hovered */}
      {(selected || isHovered) && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            ...style,
            stroke: edgeColor,
            strokeWidth: strokeWidth + 4,
            opacity: 0.3,
            filter: 'blur(4px)',
          }}
        />
      )}

      {/* Main edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth,
          strokeLinecap: 'round',
          strokeDasharray: data?.isLinkEdge ? '8 4' : 'none', // Dashed for link edges
          transition: 'all 0.3s ease-in-out',
        }}
      />

      {/* Animated flow dots */}
      {data?.animated && !data?.isLinkEdge && (
        <>
          <circle r="3" fill={edgeColor}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="3" fill={edgeColor} opacity="0.6">
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} begin="0.5s" />
          </circle>
        </>
      )}

      {/* Special animated dash for link edges */}
      {data?.isLinkEdge && data?.animated && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray="8 4"
          strokeLinecap="round"
          opacity="0.6"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="12"
            to="0"
            dur="1s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Interactive hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      {/* Edge label with stats */}
      {(data?.label || data?.executionCount) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`
              px-2 py-1 rounded-md text-xs font-medium transition-all duration-200
              ${selected || isHovered ? 'opacity-100 scale-110' : 'opacity-75'}
              bg-white dark:bg-gray-800 border-2 shadow-lg
            `}
            style={{ borderColor: edgeColor }}
          >
            {data?.label && <div className="text-gray-700 dark:text-gray-300">{data.label}</div>}
            {data?.executionCount !== undefined && (
              <div className="text-gray-500 dark:text-gray-400 text-[10px]">
                Executions: {data.executionCount}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Execution pulse effect */}
      {data?.lastExecuted && Date.now() - data.lastExecuted < 1000 && (
        <circle r="6" fill={edgeColor} opacity="0.8">
          <animateMotion dur="1s" path={edgePath} />
          <animate attributeName="r" from="6" to="12" dur="1s" />
          <animate attributeName="opacity" from="0.8" to="0" dur="1s" />
        </circle>
      )}
    </>
  );
};

export default CustomEdge;
