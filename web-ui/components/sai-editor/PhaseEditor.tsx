/**
 * Phase Editor Component
 *
 * Visual phase mask editor with timeline visualization.
 * Makes phase configuration intuitive and prevents bit mask calculation errors.
 */

'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Info } from 'lucide-react';

interface PhaseEditorProps {
  value?: number;
  onChange: (value: number) => void;
  className?: string;
}

export const PhaseEditor: React.FC<PhaseEditorProps> = ({
  value = 0,
  onChange,
  className,
}) => {
  // Check if a phase is active
  const isPhaseActive = (phase: number): boolean => {
    if (value === 0) return true; // 0 = all phases
    return (value & (1 << (phase - 1))) !== 0;
  };

  // Toggle a phase
  const togglePhase = (phase: number, checked: boolean) => {
    let newValue = value;
    const phaseBit = 1 << (phase - 1);

    if (checked) {
      newValue |= phaseBit; // Set bit
    } else {
      newValue &= ~phaseBit; // Clear bit
    }

    onChange(newValue);
  };

  // Convert to binary string
  const toBinary = (num: number): string => {
    if (num === 0) return '0 (all phases)';
    return '0b' + num.toString(2).padStart(12, '0');
  };

  // Get active phases
  const activePhases = value === 0
    ? ['All Phases']
    : Array.from({ length: 12 }, (_, i) => i + 1)
        .filter(phase => isPhaseActive(phase))
        .map(phase => `Phase ${phase}`);

  // All phases (1-12)
  const phases = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Event Phase Mask
          </CardTitle>
          <Badge variant={value === 0 ? 'secondary' : 'default'}>
            {activePhases.length === 1 ? activePhases[0] : `${activePhases.length} phases`}
          </Badge>
        </div>
        <CardDescription className="text-xs flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            {value === 0 ? (
              'Event active in all phases (default)'
            ) : (
              `Active in: ${activePhases.join(', ')}`
            )}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Checkboxes (3 columns of 4) */}
        <div className="grid grid-cols-3 gap-4">
          {phases.map((phase) => (
            <div key={phase} className="flex items-center space-x-2">
              <Checkbox
                id={`phase-${phase}`}
                checked={isPhaseActive(phase)}
                onCheckedChange={(checked) => togglePhase(phase, checked === true)}
                disabled={value === 0}
              />
              <label
                htmlFor={`phase-${phase}`}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Phase {phase}
              </label>
            </div>
          ))}
        </div>

        {/* Phase Timeline Visualization */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Phase Timeline
          </Label>
          <div className="grid grid-cols-12 gap-1">
            {phases.map((phase) => {
              const active = isPhaseActive(phase);
              return (
                <div
                  key={phase}
                  className={`
                    h-12 rounded flex items-center justify-center text-xs font-medium
                    transition-all cursor-pointer
                    ${active
                      ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'
                    }
                  `}
                  onClick={() => togglePhase(phase, !active)}
                  title={`Phase ${phase}`}
                >
                  {phase}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 text-center">
            Click on phase blocks to toggle activation
          </div>
        </div>

        {/* Example Phase Presets */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Quick Presets
          </Label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onChange(0)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              All Phases
            </button>
            <button
              onClick={() => onChange(1)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Phase 1 Only
            </button>
            <button
              onClick={() => onChange(3)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Phases 1-2
            </button>
            <button
              onClick={() => onChange(15)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Phases 1-4
            </button>
            <button
              onClick={() => onChange(0xAAA)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Even Phases (2,4,6,8,10,12)
            </button>
            <button
              onClick={() => onChange(0x555)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Odd Phases (1,3,5,7,9,11)
            </button>
          </div>
        </div>

        {/* Value Display */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Phase Mask Value:</span>
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono">
              {value}
            </code>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Binary:</span>
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">
              {toBinary(value)}
            </code>
          </div>
        </div>

        {/* Info Display */}
        {value !== 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs space-y-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Phase Behavior:
            </p>
            <p className="text-blue-800 dark:text-blue-200">
              Event will only trigger when the creature is in {activePhases.join(' or ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PhaseEditor;
