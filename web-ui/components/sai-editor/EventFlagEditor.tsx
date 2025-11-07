/**
 * Event Flag Editor Component
 *
 * Visual checkbox editor for event_flags bit flags.
 * Makes complex bit flag configuration intuitive and error-free.
 */

'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flag, Info } from 'lucide-react';

interface FlagOption {
  value: number;
  label: string;
  description: string;
  category: 'repeat' | 'difficulty' | 'combat' | 'other';
}

const FLAG_OPTIONS: FlagOption[] = [
  // Repeat flags
  { value: 0x01, label: 'Not Repeatable', description: 'Event executes only once', category: 'repeat' },
  { value: 0x20, label: 'Don\'t Reset', description: 'Event doesn\'t reset on respawn', category: 'repeat' },

  // Difficulty flags
  { value: 0x02, label: 'Normal Difficulty Only', description: 'Only in normal difficulty', category: 'difficulty' },
  { value: 0x04, label: 'Heroic Difficulty Only', description: 'Only in heroic difficulty', category: 'difficulty' },
  { value: 0x08, label: 'Hard Mode Only', description: 'Only in hard mode', category: 'difficulty' },

  // Combat flags
  { value: 0x100, label: 'Combat Move Disabled', description: 'Disable movement during this event', category: 'combat' },
  { value: 0x40, label: 'While Charmed', description: 'Event can trigger while charmed', category: 'combat' },

  // Other flags
  { value: 0x10, label: 'Debug Only', description: 'Event only triggers in debug mode', category: 'other' },
  { value: 0x200, label: 'Reserved Flag (0x200)', description: 'Reserved for future use', category: 'other' },
];

interface EventFlagEditorProps {
  value?: number;
  onChange: (value: number) => void;
  className?: string;
}

export const EventFlagEditor: React.FC<EventFlagEditorProps> = ({
  value = 0,
  onChange,
  className,
}) => {
  // Check if a flag is set
  const isFlagSet = (flagValue: number): boolean => {
    return (value & flagValue) !== 0;
  };

  // Toggle a flag
  const toggleFlag = (flagValue: number, checked: boolean) => {
    let newValue = value;
    if (checked) {
      newValue |= flagValue; // Set bit
    } else {
      newValue &= ~flagValue; // Clear bit
    }
    onChange(newValue);
  };

  // Convert to binary string
  const toBinary = (num: number): string => {
    return '0b' + num.toString(2).padStart(16, '0');
  };

  // Convert to hex string
  const toHex = (num: number): string => {
    return '0x' + num.toString(16).toUpperCase().padStart(4, '0');
  };

  // Check if any flags are set
  const hasFlags = value > 0;

  // Get active flag labels
  const activeFlags = FLAG_OPTIONS.filter(opt => isFlagSet(opt.value)).map(opt => opt.label);

  // Group flags by category
  const groupedFlags = {
    repeat: FLAG_OPTIONS.filter(opt => opt.category === 'repeat'),
    difficulty: FLAG_OPTIONS.filter(opt => opt.category === 'difficulty'),
    combat: FLAG_OPTIONS.filter(opt => opt.category === 'combat'),
    other: FLAG_OPTIONS.filter(opt => opt.category === 'other'),
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Event Flags
          </CardTitle>
          {hasFlags && (
            <Badge variant="default">{activeFlags.length} active</Badge>
          )}
        </div>
        <CardDescription className="text-xs flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            {hasFlags ? (
              `Active: ${activeFlags.join(', ')}`
            ) : (
              'No flags set (default behavior)'
            )}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Repeat Flags */}
        {groupedFlags.repeat.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Repeat Behavior
            </Label>
            <div className="space-y-2 pl-2">
              {groupedFlags.repeat.map((option) => (
                <div key={option.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`flag-${option.value}`}
                    checked={isFlagSet(option.value)}
                    onCheckedChange={(checked) => toggleFlag(option.value, checked === true)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <label
                      htmlFor={`flag-${option.value}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option.label}
                    </label>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Difficulty Flags */}
        {groupedFlags.difficulty.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Difficulty Restrictions
            </Label>
            <div className="space-y-2 pl-2">
              {groupedFlags.difficulty.map((option) => (
                <div key={option.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`flag-${option.value}`}
                    checked={isFlagSet(option.value)}
                    onCheckedChange={(checked) => toggleFlag(option.value, checked === true)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <label
                      htmlFor={`flag-${option.value}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option.label}
                    </label>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Combat Flags */}
        {groupedFlags.combat.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Combat Behavior
            </Label>
            <div className="space-y-2 pl-2">
              {groupedFlags.combat.map((option) => (
                <div key={option.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`flag-${option.value}`}
                    checked={isFlagSet(option.value)}
                    onCheckedChange={(checked) => toggleFlag(option.value, checked === true)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <label
                      htmlFor={`flag-${option.value}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option.label}
                    </label>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Flags */}
        {groupedFlags.other.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Other Flags
            </Label>
            <div className="space-y-2 pl-2">
              {groupedFlags.other.map((option) => (
                <div key={option.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`flag-${option.value}`}
                    checked={isFlagSet(option.value)}
                    onCheckedChange={(checked) => toggleFlag(option.value, checked === true)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <label
                      htmlFor={`flag-${option.value}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option.label}
                    </label>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Value Display */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Decimal:</span>
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono">
              {value}
            </code>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Hexadecimal:</span>
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono">
              {toHex(value)}
            </code>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Binary:</span>
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs">
              {toBinary(value)}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventFlagEditor;
