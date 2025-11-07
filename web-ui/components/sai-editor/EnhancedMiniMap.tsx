/**
 * Enhanced MiniMap Component
 *
 * Professional mini-map with status indicators, validation states, and better visualization.
 * Features: Color-coded nodes, validation indicators, execution status, hover effects.
 */

'use client';

import React from 'react';
import { MiniMap } from 'reactflow';
import { SAINode as SAINodeType } from '@/lib/sai-unified/types';

interface EnhancedMiniMapProps {
  className?: string;
}

export const EnhancedMiniMap: React.FC<EnhancedMiniMapProps> = ({ className }) => {
  // Get node color based on type and status
  const getNodeColor = (node: any): string => {
    const data = node.data as SAINodeType & {
      validation?: {
        hasErrors?: boolean;
        hasWarnings?: boolean;
        hasInfo?: boolean;
      };
      isExecuting?: boolean;
    };

    // Error state takes priority
    if (data.validation?.hasErrors) {
      return '#ef4444'; // Red
    }

    // Warning state
    if (data.validation?.hasWarnings) {
      return '#f59e0b'; // Amber
    }

    // Executing state
    if (data.isExecuting) {
      return '#06b6d4'; // Cyan
    }

    // Normal colors based on type
    switch (data.type) {
      case 'event':
        return '#3b82f6'; // Blue
      case 'action':
        return '#10b981'; // Green
      case 'target':
        return '#a855f7'; // Purple
      case 'comment':
        return '#6b7280'; // Gray
      default:
        return '#94a3b8'; // Slate
    }
  };

  // Get node stroke color for selected/hovered states
  const getNodeStrokeColor = (node: any): string | undefined => {
    if (node.selected) {
      return '#3b82f6'; // Blue stroke for selected
    }

    const data = node.data as SAINodeType & {
      validation?: {
        hasErrors?: boolean;
        hasWarnings?: boolean;
      };
      isHovered?: boolean;
    };

    if (data.isHovered) {
      return '#60a5fa'; // Light blue for hover
    }

    // Validation stroke colors
    if (data.validation?.hasErrors) {
      return '#dc2626'; // Dark red stroke
    }

    if (data.validation?.hasWarnings) {
      return '#d97706'; // Dark amber stroke
    }

    return undefined;
  };

  // Get node class name for additional styling
  const getNodeClassName = (node: any): string => {
    const data = node.data as SAINodeType & {
      validation?: {
        hasErrors?: boolean;
      };
      isExecuting?: boolean;
      locked?: boolean;
    };

    const classes: string[] = [];

    if (node.selected) {
      classes.push('minimap-node-selected');
    }

    if (data.validation?.hasErrors) {
      classes.push('minimap-node-error');
    }

    if (data.isExecuting) {
      classes.push('minimap-node-executing');
    }

    if (data.locked) {
      classes.push('minimap-node-locked');
    }

    return classes.join(' ');
  };

  return (
    <>
      <MiniMap
        nodeColor={getNodeColor}
        nodeStrokeColor={getNodeStrokeColor}
        nodeClassName={getNodeClassName}
        nodeStrokeWidth={3}
        className={`
          ${className}
          !bg-white/90 dark:!bg-gray-900/90
          !border-2 !border-gray-300 dark:!border-gray-700
          !rounded-lg !shadow-2xl
          backdrop-blur-sm
        `}
        style={{
          width: 220,
          height: 160,
        }}
        maskColor="rgb(0, 0, 0, 0.1)"
        pannable
        zoomable
      />

      {/* Custom CSS for minimap animations */}
      <style jsx global>{`
        .react-flow__minimap {
          transition: all 0.3s ease-in-out;
        }

        .react-flow__minimap:hover {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          transform: scale(1.02);
        }

        /* Selected node animation */
        .minimap-node-selected {
          animation: minimap-pulse-selected 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes minimap-pulse-selected {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        /* Error node animation */
        .minimap-node-error {
          animation: minimap-pulse-error 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes minimap-pulse-error {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        /* Executing node animation */
        .minimap-node-executing {
          animation: minimap-pulse-executing 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes minimap-pulse-executing {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }

        /* Locked node styling */
        .minimap-node-locked {
          opacity: 0.5;
        }

        /* Minimap viewport styling */
        .react-flow__minimap-mask {
          transition: fill 0.2s ease-in-out;
        }

        /* Minimap node hover effect */
        .react-flow__minimap-node:hover {
          stroke-width: 4;
          filter: brightness(1.2);
        }
      `}</style>
    </>
  );
};

export default EnhancedMiniMap;
