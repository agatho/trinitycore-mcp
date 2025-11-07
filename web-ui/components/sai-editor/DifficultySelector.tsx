/**
 * Difficulty Selector Component
 *
 * Visual checkbox selector for dungeon/raid difficulty restrictions.
 * Manages the `Difficulties` field in smart_scripts table.
 */

'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface DifficultyOption {
  id: string;
  label: string;
  description: string;
  category: 'dungeon' | 'raid' | 'other';
}

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  // Dungeon difficulties
  { id: '0', label: 'Normal (10-player)', description: '10-player dungeon normal mode', category: 'dungeon' },
  { id: '1', label: 'Normal (25-player)', description: '25-player dungeon normal mode', category: 'dungeon' },
  { id: '2', label: 'Heroic (10-player)', description: '10-player dungeon heroic mode', category: 'dungeon' },
  { id: '3', label: 'Heroic (25-player)', description: '25-player dungeon heroic mode', category: 'dungeon' },

  // Raid difficulties
  { id: '4', label: 'Normal (Raid)', description: 'Raid normal difficulty', category: 'raid' },
  { id: '5', label: 'Heroic (Raid)', description: 'Raid heroic difficulty', category: 'raid' },
  { id: '6', label: 'Mythic (Raid)', description: 'Raid mythic difficulty', category: 'raid' },
  { id: '7', label: 'LFR (Looking for Raid)', description: 'Raid finder difficulty', category: 'raid' },

  // Other
  { id: '8', label: 'Mythic Keystone', description: 'Mythic+ dungeon difficulty', category: 'other' },
  { id: '23', label: 'Mythic+', description: 'Mythic+ dungeon difficulty (alternative)', category: 'other' },
];

interface DifficultySelectorProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  value = '',
  onChange,
  className,
}) => {
  // Parse comma-separated string into Set of IDs
  const selectedIds = React.useMemo(() => {
    if (!value || value.trim() === '') return new Set<string>();
    return new Set(value.split(',').map(id => id.trim()).filter(Boolean));
  }, [value]);

  // Handle checkbox toggle
  const handleToggle = (id: string, checked: boolean) => {
    const newIds = new Set(selectedIds);
    if (checked) {
      newIds.add(id);
    } else {
      newIds.delete(id);
    }

    // Convert back to comma-separated string
    const newValue = Array.from(newIds).sort((a, b) => parseInt(a) - parseInt(b)).join(',');
    onChange(newValue);
  };

  // Check if any difficulty is selected
  const hasSelection = selectedIds.size > 0;

  // Get selected labels for display
  const selectedLabels = Array.from(selectedIds)
    .map(id => DIFFICULTY_OPTIONS.find(opt => opt.id === id)?.label)
    .filter(Boolean);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Difficulty Restrictions</CardTitle>
          {hasSelection && (
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {hasSelection ? (
            <span>Active in: {selectedLabels.join(', ')}</span>
          ) : (
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Empty = active in all difficulties
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Dungeon Difficulties */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Dungeon Difficulties
          </Label>
          <div className="space-y-2 pl-2">
            {DIFFICULTY_OPTIONS.filter(opt => opt.category === 'dungeon').map((option) => (
              <div key={option.id} className="flex items-start space-x-2">
                <Checkbox
                  id={`diff-${option.id}`}
                  checked={selectedIds.has(option.id)}
                  onCheckedChange={(checked) => handleToggle(option.id, checked === true)}
                />
                <div className="grid gap-0.5 leading-none">
                  <label
                    htmlFor={`diff-${option.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raid Difficulties */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Raid Difficulties
          </Label>
          <div className="space-y-2 pl-2">
            {DIFFICULTY_OPTIONS.filter(opt => opt.category === 'raid').map((option) => (
              <div key={option.id} className="flex items-start space-x-2">
                <Checkbox
                  id={`diff-${option.id}`}
                  checked={selectedIds.has(option.id)}
                  onCheckedChange={(checked) => handleToggle(option.id, checked === true)}
                />
                <div className="grid gap-0.5 leading-none">
                  <label
                    htmlFor={`diff-${option.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Difficulties */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Other Difficulties
          </Label>
          <div className="space-y-2 pl-2">
            {DIFFICULTY_OPTIONS.filter(opt => opt.category === 'other').map((option) => (
              <div key={option.id} className="flex items-start space-x-2">
                <Checkbox
                  id={`diff-${option.id}`}
                  checked={selectedIds.has(option.id)}
                  onCheckedChange={(checked) => handleToggle(option.id, checked === true)}
                />
                <div className="grid gap-0.5 leading-none">
                  <label
                    htmlFor={`diff-${option.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Output Display */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">SQL Value:</span>
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
              {value || '(empty)'}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DifficultySelector;
