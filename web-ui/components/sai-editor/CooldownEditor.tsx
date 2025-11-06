/**
 * Cooldown Editor Component
 *
 * Editor for event cooldown min/max fields with smart time formatting.
 * Prevents events from triggering repeatedly without cooldown.
 */

'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Info } from 'lucide-react';

interface CooldownEditorProps {
  cooldownMin?: number;
  cooldownMax?: number;
  onChange: (cooldownMin: number, cooldownMax: number) => void;
  className?: string;
}

export const CooldownEditor: React.FC<CooldownEditorProps> = ({
  cooldownMin = 0,
  cooldownMax = 0,
  onChange,
  className,
}) => {
  const [minMs, setMinMs] = React.useState(cooldownMin);
  const [maxMs, setMaxMs] = React.useState(cooldownMax);

  // Update local state when props change
  React.useEffect(() => {
    setMinMs(cooldownMin);
    setMaxMs(cooldownMax);
  }, [cooldownMin, cooldownMax]);

  // Convert milliseconds to seconds for display
  const msToSeconds = (ms: number): string => {
    return (ms / 1000).toFixed(1);
  };

  // Convert seconds to milliseconds
  const secondsToMs = (seconds: string): number => {
    const num = parseFloat(seconds);
    return isNaN(num) ? 0 : Math.round(num * 1000);
  };

  // Handle min change
  const handleMinChange = (value: string) => {
    const ms = secondsToMs(value);
    setMinMs(ms);
    onChange(ms, maxMs);
  };

  // Handle max change
  const handleMaxChange = (value: string) => {
    const ms = secondsToMs(value);
    setMaxMs(ms);
    onChange(minMs, ms);
  };

  // Preset buttons
  const presets = [
    { label: '5s', min: 5000, max: 5000 },
    { label: '10s', min: 10000, max: 10000 },
    { label: '15-20s', min: 15000, max: 20000 },
    { label: '30s', min: 30000, max: 30000 },
    { label: '1min', min: 60000, max: 60000 },
  ];

  const handlePreset = (min: number, max: number) => {
    setMinMs(min);
    setMaxMs(max);
    onChange(min, max);
  };

  // Check if cooldown is active
  const hasCooldown = minMs > 0 || maxMs > 0;

  // Validation: max should be >= min
  const isValid = maxMs >= minMs;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Event Cooldown
          </CardTitle>
          {hasCooldown && (
            <Badge variant={isValid ? 'default' : 'destructive'}>
              {isValid ? 'Active' : 'Invalid'}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            Event will not trigger again until cooldown expires. Leave at 0 for no cooldown.
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cooldown-min" className="text-xs">
              Minimum (seconds)
            </Label>
            <div className="relative">
              <Input
                id="cooldown-min"
                type="number"
                min="0"
                step="0.1"
                value={msToSeconds(minMs)}
                onChange={(e) => handleMinChange(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-500">s</span>
            </div>
            <p className="text-xs text-gray-500">{minMs} ms</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cooldown-max" className="text-xs">
              Maximum (seconds)
            </Label>
            <div className="relative">
              <Input
                id="cooldown-max"
                type="number"
                min="0"
                step="0.1"
                value={msToSeconds(maxMs)}
                onChange={(e) => handleMaxChange(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-500">s</span>
            </div>
            <p className="text-xs text-gray-500">{maxMs} ms</p>
          </div>
        </div>

        {/* Validation Message */}
        {!isValid && hasCooldown && (
          <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Maximum cooldown must be greater than or equal to minimum
          </div>
        )}

        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-600 dark:text-gray-400">
            Quick Presets
          </Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handlePreset(preset.min, preset.max)}
                className="text-xs h-7"
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset(0, 0)}
              className="text-xs h-7"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Info Display */}
        {hasCooldown && isValid && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs space-y-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Cooldown Behavior:
            </p>
            {minMs === maxMs ? (
              <p className="text-blue-800 dark:text-blue-200">
                Event will have a fixed {msToSeconds(minMs)}s cooldown
              </p>
            ) : (
              <p className="text-blue-800 dark:text-blue-200">
                Event will have a random {msToSeconds(minMs)}-{msToSeconds(maxMs)}s cooldown
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CooldownEditor;
