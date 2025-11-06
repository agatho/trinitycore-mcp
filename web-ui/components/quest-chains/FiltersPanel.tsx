'use client';

import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { QuestFilters } from '@/lib/quest-chain-utils';

interface FiltersPanelProps {
  filters: QuestFilters;
  onFiltersChange: (filters: QuestFilters) => void;
  zones: string[];
  categories: string[];
}

export function FiltersPanel({
  filters,
  onFiltersChange,
  zones,
  categories,
}: FiltersPanelProps) {
  const updateFilter = (key: keyof QuestFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      faction: 'All',
      showBroken: true,
      showOrphaned: true,
    });
  };

  const hasActiveFilters =
    filters.minLevel ||
    filters.maxLevel ||
    (filters.faction && filters.faction !== 'All') ||
    filters.category ||
    filters.zone ||
    filters.searchTerm ||
    filters.showBroken === false ||
    filters.showOrphaned === false;

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Filters</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Level Range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-400">Min Level</Label>
            <Input
              type="number"
              placeholder="1"
              value={filters.minLevel || ''}
              onChange={(e) => updateFilter('minLevel', parseInt(e.target.value) || undefined)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Max Level</Label>
            <Input
              type="number"
              placeholder="80"
              value={filters.maxLevel || ''}
              onChange={(e) => updateFilter('maxLevel', parseInt(e.target.value) || undefined)}
              className="mt-1"
            />
          </div>
        </div>

        {/* Faction */}
        <div>
          <Label className="text-xs text-slate-400">Faction</Label>
          <Select
            value={filters.faction || 'All'}
            onValueChange={(value) => updateFilter('faction', value)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Factions</SelectItem>
              <SelectItem value="Alliance">Alliance</SelectItem>
              <SelectItem value="Horde">Horde</SelectItem>
              <SelectItem value="Neutral">Neutral</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div>
            <Label className="text-xs text-slate-400">Category</Label>
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) => updateFilter('category', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Zone */}
        {zones.length > 0 && (
          <div>
            <Label className="text-xs text-slate-400">Zone</Label>
            <Select
              value={filters.zone || 'all'}
              onValueChange={(value) => updateFilter('zone', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Search */}
        <div>
          <Label className="text-xs text-slate-400">Search</Label>
          <Input
            placeholder="Quest name or ID..."
            value={filters.searchTerm || ''}
            onChange={(e) => updateFilter('searchTerm', e.target.value || undefined)}
            className="mt-1"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-300">Show Broken Chains</Label>
            <Switch
              checked={filters.showBroken !== false}
              onCheckedChange={(checked) => updateFilter('showBroken', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-300">Show Orphaned Quests</Label>
            <Switch
              checked={filters.showOrphaned !== false}
              onCheckedChange={(checked) => updateFilter('showOrphaned', checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
