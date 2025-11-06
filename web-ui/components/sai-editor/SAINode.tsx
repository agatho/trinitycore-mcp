/**
 * SAI Node Component - Enhanced n8n-Style
 *
 * Visual representation of SAI nodes with professional n8n-inspired design.
 * Features: Gradients, animations, status indicators, hover effects.
 */

'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SAINode as SAINodeType } from '@/lib/sai-unified/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Info, Zap, Target, Flag, MessageSquare, Clock, TrendingUp } from 'lucide-react';

interface SAINodeData extends SAINodeType {
  validation?: {
    hasErrors?: boolean;
    hasWarnings?: boolean;
    hasInfo?: boolean;
  };
  isSelected?: boolean;
  isHovered?: boolean;
  isPotentialTarget?: boolean;
  isExecuting?: boolean;
  executionTime?: number;
  collaborators?: string[];
  locked?: boolean;
  lockedBy?: string;
}

interface SAINodeComponentProps extends NodeProps {
  data: SAINodeData;
}

const SAINodeComponent: React.FC<SAINodeComponentProps> = memo(({ data, selected }) => {
  const {
    type,
    label,
    typeName,
    parameters,
    validation,
    chance,
    phase,
    isHovered,
    isPotentialTarget,
    isExecuting,
    executionTime,
    collaborators = [],
    locked,
    lockedBy,
  } = data;

  const [showTooltip, setShowTooltip] = useState(false);

  // Enhanced n8n-style color scheme with gradients
  const getNodeColors = () => {
    switch (type) {
      case 'event':
        return {
          gradient: 'from-blue-500 via-blue-600 to-indigo-600',
          bg: 'bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-blue-950 dark:via-gray-900 dark:to-indigo-950',
          border: 'border-blue-500',
          glow: 'shadow-blue-500/50',
          text: 'text-blue-700 dark:text-blue-300',
          badge: 'bg-gradient-to-r from-blue-500 to-indigo-500',
          icon: Zap,
          handleColor: '#3b82f6',
        };
      case 'action':
        return {
          gradient: 'from-green-500 via-emerald-600 to-teal-600',
          bg: 'bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-green-950 dark:via-gray-900 dark:to-teal-950',
          border: 'border-green-500',
          glow: 'shadow-green-500/50',
          text: 'text-green-700 dark:text-green-300',
          badge: 'bg-gradient-to-r from-green-500 to-emerald-500',
          icon: Target,
          handleColor: '#10b981',
        };
      case 'target':
        return {
          gradient: 'from-purple-500 via-violet-600 to-fuchsia-600',
          bg: 'bg-gradient-to-br from-purple-50 via-white to-violet-50 dark:from-purple-950 dark:via-gray-900 dark:to-fuchsia-950',
          border: 'border-purple-500',
          glow: 'shadow-purple-500/50',
          text: 'text-purple-700 dark:text-purple-300',
          badge: 'bg-gradient-to-r from-purple-500 to-fuchsia-500',
          icon: Flag,
          handleColor: '#a855f7',
        };
      case 'comment':
        return {
          gradient: 'from-gray-400 via-slate-500 to-gray-600',
          bg: 'bg-gradient-to-br from-gray-50 via-white to-slate-50 dark:from-gray-800 dark:via-gray-900 dark:to-slate-900',
          border: 'border-gray-400',
          glow: 'shadow-gray-500/50',
          text: 'text-gray-700 dark:text-gray-300',
          badge: 'bg-gradient-to-r from-gray-400 to-slate-500',
          icon: MessageSquare,
          handleColor: '#6b7280',
        };
      default:
        return {
          gradient: 'from-gray-500 via-slate-600 to-gray-700',
          bg: 'bg-white dark:bg-gray-900',
          border: 'border-gray-300',
          glow: 'shadow-gray-500/50',
          text: 'text-gray-700 dark:text-gray-300',
          badge: 'bg-gray-500',
          icon: Info,
          handleColor: '#6b7280',
        };
    }
  };

  const colors = getNodeColors();
  const NodeIcon = colors.icon;

  // Validation status icon
  const getValidationIcon = () => {
    if (validation?.hasErrors) {
      return <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />;
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
    <div className="relative group">
      {/* Glow effect on hover/select */}
      {(selected || isHovered) && (
        <div className={`absolute inset-0 rounded-xl ${colors.glow} blur-xl opacity-50 transition-opacity duration-300`} />
      )}

      {/* Potential connection target indicator */}
      {isPotentialTarget && (
        <div className="absolute inset-0 rounded-xl border-4 border-yellow-400 animate-pulse" />
      )}

      {/* Execution animation */}
      {isExecuting && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-400 animate-ping" />
      )}

      <Card
        className={`
          relative
          ${colors.bg}
          ${colors.border}
          border-2
          ${selected ? 'ring-4 ring-blue-400 ring-offset-2 shadow-2xl scale-105' : 'shadow-lg'}
          ${isHovered ? 'shadow-xl scale-102' : ''}
          ${locked ? 'opacity-75' : ''}
          transition-all duration-300 ease-in-out
          min-w-[260px] max-w-[340px]
          hover:scale-105
          cursor-pointer
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Locked indicator */}
        {locked && lockedBy && (
          <div className="absolute top-0 right-0 -mt-2 -mr-2">
            <Badge variant="destructive" className="text-xs animate-bounce">
              🔒 {lockedBy}
            </Badge>
          </div>
        )}

        {/* Collaborator avatars */}
        {collaborators.length > 0 && (
          <div className="absolute top-0 left-0 -mt-2 -ml-2 flex -space-x-2">
            {collaborators.slice(0, 3).map((collab, idx) => (
              <div
                key={idx}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-bold text-white"
                title={collab}
              >
                {collab[0].toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Input Handle (for actions and targets) */}
        {(type === 'action' || type === 'target') && (
          <Handle
            type="target"
            position={Position.Left}
            className="!w-4 !h-4 !border-2 !border-white dark:!border-gray-800 transition-all duration-200 hover:!w-5 hover:!h-5"
            style={{ background: colors.handleColor }}
          />
        )}

        <div className="p-4 space-y-3">
          {/* Header with gradient badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${colors.badge} text-white text-xs px-3 py-1 shadow-md`}>
                  <NodeIcon className="w-3 h-3 mr-1 inline" />
                  {type.toUpperCase()}
                </Badge>
                {getValidationIcon()}
              </div>
              <h3 className={`font-bold text-base ${colors.text} truncate leading-tight`}>
                {label}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 font-mono">
                {typeName}
              </p>
            </div>
          </div>

          {/* Parameters with better styling */}
          {relevantParams.length > 0 && (
            <div className="space-y-1.5 text-xs bg-white/50 dark:bg-black/20 rounded-lg p-2 backdrop-blur-sm">
              {relevantParams.map((param, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <span className="font-semibold truncate mr-2">{param.name}:</span>
                  <span className="text-gray-800 dark:text-gray-200 truncate font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {typeof param.value === 'number' ? param.value : String(param.value)}
                    {param.units && ` ${param.units}`}
                  </span>
                </div>
              ))}
              {parameters.length > 3 && (
                <div className="text-gray-500 italic text-center pt-1 border-t border-gray-200 dark:border-gray-700">
                  +{parameters.length - 3} more parameters...
                </div>
              ))}
            </div>
          )}

          {/* Metadata footer with icons */}
          <div className="flex gap-2 flex-wrap items-center">
            {phase !== undefined && phase > 0 && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Flag className="w-3 h-3" />
                Phase {phase}
              </Badge>
            )}
            {chance !== undefined && chance < 100 && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {chance}%
              </Badge>
            )}
            {executionTime !== undefined && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {executionTime}ms
              </Badge>
            )}
          </div>
        </div>

        {/* Output Handle (for events and actions) */}
        {(type === 'event' || type === 'action') && (
          <Handle
            type="source"
            position={Position.Right}
            className="!w-4 !h-4 !border-2 !border-white dark:!border-gray-800 transition-all duration-200 hover:!w-5 hover:!h-5"
            style={{ background: colors.handleColor }}
          />
        )}

        {/* Hover tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg shadow-xl whitespace-nowrap z-50 animate-in fade-in duration-200">
            {label}
            <div className="text-gray-400 dark:text-gray-600 mt-0.5">{typeName}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
});

SAINodeComponent.displayName = 'SAINode';

export default SAINodeComponent;
