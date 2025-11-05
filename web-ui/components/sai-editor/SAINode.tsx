/**
 * SAI Node Component
 *
 * Visual representation of SAI nodes (events, actions, targets) in the graph editor.
 * Uses ReactFlow for node rendering and interaction.
 */

'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SAINode as SAINodeType } from '@/lib/sai-unified/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface SAINodeData extends SAINodeType {
  validation?: {
    hasErrors?: boolean;
    hasWarnings?: boolean;
    hasInfo?: boolean;
  };
  isSelected?: boolean;
}

interface SAINodeComponentProps extends NodeProps {
  data: SAINodeData;
}

const SAINodeComponent: React.FC<SAINodeComponentProps> = memo(({ data, selected }) => {
  const { type, label, typeName, parameters, validation, chance, phase } = data;

  // Color scheme based on node type
  const getNodeColors = () => {
    switch (type) {
      case 'event':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950',
          border: 'border-blue-500',
          text: 'text-blue-700 dark:text-blue-300',
          badge: 'bg-blue-500',
        };
      case 'action':
        return {
          bg: 'bg-green-50 dark:bg-green-950',
          border: 'border-green-500',
          text: 'text-green-700 dark:text-green-300',
          badge: 'bg-green-500',
        };
      case 'target':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950',
          border: 'border-purple-500',
          text: 'text-purple-700 dark:text-purple-300',
          badge: 'bg-purple-500',
        };
      case 'comment':
        return {
          bg: 'bg-gray-50 dark:bg-gray-800',
          border: 'border-gray-400',
          text: 'text-gray-700 dark:text-gray-300',
          badge: 'bg-gray-500',
        };
      default:
        return {
          bg: 'bg-white dark:bg-gray-900',
          border: 'border-gray-300',
          text: 'text-gray-700 dark:text-gray-300',
          badge: 'bg-gray-500',
        };
    }
  };

  const colors = getNodeColors();

  // Validation status icon
  const getValidationIcon = () => {
    if (validation?.hasErrors) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (validation?.hasWarnings) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    if (validation?.hasInfo) {
      return <Info className="h-4 w-4 text-blue-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  // Get non-zero parameters for display
  const getRelevantParams = () => {
    return parameters
      .filter(p => p.value !== 0 || p.required)
      .slice(0, 3); // Show max 3 parameters
  };

  const relevantParams = getRelevantParams();

  return (
    <Card
      className={`
        ${colors.bg}
        ${colors.border}
        border-2
        ${selected ? 'ring-2 ring-blue-400 shadow-lg' : 'shadow-md'}
        transition-all duration-200 hover:shadow-lg
        min-w-[240px] max-w-[320px]
      `}
    >
      {/* Input Handle (for actions and targets) */}
      {(type === 'action' || type === 'target') && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
        />
      )}

      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${colors.badge} text-white text-xs px-2 py-0.5`}>
                {type.toUpperCase()}
              </Badge>
              {getValidationIcon()}
            </div>
            <h3 className={`font-semibold text-sm ${colors.text} truncate`}>
              {label}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {typeName}
            </p>
          </div>
        </div>

        {/* Parameters */}
        {relevantParams.length > 0 && (
          <div className="space-y-1 text-xs">
            {relevantParams.map((param, idx) => (
              <div key={idx} className="flex justify-between text-gray-600 dark:text-gray-400">
                <span className="font-medium truncate mr-2">{param.name}:</span>
                <span className="text-gray-800 dark:text-gray-200 truncate">
                  {typeof param.value === 'number' ? param.value : String(param.value)}
                  {param.units && ` ${param.units}`}
                </span>
              </div>
            ))}
            {parameters.length > 3 && (
              <div className="text-gray-500 italic">
                +{parameters.length - 3} more...
              </div>
            )}
          </div>
        )}

        {/* Metadata (phase, chance) */}
        <div className="flex gap-2 flex-wrap">
          {phase !== undefined && phase > 0 && (
            <Badge variant="outline" className="text-xs">
              Phase {phase}
            </Badge>
          )}
          {chance !== undefined && chance < 100 && (
            <Badge variant="outline" className="text-xs">
              {chance}% chance
            </Badge>
          )}
        </div>
      </div>

      {/* Output Handle (for events and actions) */}
      {(type === 'event' || type === 'action') && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
        />
      )}
    </Card>
  );
});

SAINodeComponent.displayName = 'SAINode';

export default SAINodeComponent;
