'use client';

/**
 * Time of Day Control Component
 *
 * UI controls for adjusting lighting and time of day in the 3D view
 */

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Sunrise, Sunset, Clock, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface TimeOfDayControlProps {
  currentTime: number; // 0-24 hours
  onTimeChange: (time: number) => void;
  autoProgress: boolean;
  onAutoProgressChange: (enabled: boolean) => void;
  timeSpeed: number;
  onTimeSpeedChange: (speed: number) => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function TimeOfDayControl({
  currentTime,
  onTimeChange,
  autoProgress,
  onAutoProgressChange,
  timeSpeed,
  onTimeSpeedChange,
  position = 'top-left',
}: TimeOfDayControlProps) {
  const [localTime, setLocalTime] = useState(currentTime);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed

  useEffect(() => {
    setLocalTime(currentTime);
  }, [currentTime]);

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  const getTimePeriod = (time: number): string => {
    if (time >= 5 && time < 7) return 'Dawn';
    if (time >= 7 && time < 12) return 'Morning';
    if (time >= 12 && time < 17) return 'Afternoon';
    if (time >= 17 && time < 19) return 'Dusk';
    if (time >= 19 && time < 22) return 'Evening';
    return 'Night';
  };

  const getTimeIcon = (time: number) => {
    const period = getTimePeriod(time);
    if (period === 'Dawn') return <Sunrise className="w-4 h-4 text-orange-400" />;
    if (period === 'Morning' || period === 'Afternoon') return <Sun className="w-4 h-4 text-yellow-400" />;
    if (period === 'Dusk') return <Sunset className="w-4 h-4 text-orange-600" />;
    return <Moon className="w-4 h-4 text-blue-300" />;
  };

  const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleSliderChange = (value: number[]) => {
    setLocalTime(value[0]);
  };

  const handleSliderCommit = () => {
    onTimeChange(localTime);
  };

  const handlePreset = (preset: number) => {
    setLocalTime(preset);
    onTimeChange(preset);
  };

  // Collapsed view - just show icon and time
  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className={`absolute ${positionClasses[position]} z-40 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg px-3 py-2 flex items-center gap-2 hover:bg-slate-700 transition-colors`}
        title="Time of Day (click to expand)"
      >
        {getTimeIcon(localTime)}
        <span className="text-sm text-white font-medium">{formatTime(localTime)}</span>
      </button>
    );
  }

  return (
    <div
      className={`absolute ${positionClasses[position]} z-40 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-2xl min-w-[280px]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Time of Day</span>
        </div>
        <div className="flex items-center gap-2">
          {getTimeIcon(localTime)}
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-slate-400 hover:text-white p-1"
            title="Minimize"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Time Display */}
        <div className="text-center space-y-1">
          <div className="text-xl font-bold text-white">{formatTime(localTime)}</div>
          <div className="text-xs text-slate-400">{getTimePeriod(localTime)}</div>
        </div>

        {/* Time Slider */}
        <div className="space-y-1">
          <Slider
            value={[localTime]}
            onValueChange={handleSliderChange}
            onValueCommit={handleSliderCommit}
            min={0}
            max={24}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* Presets - Compact */}
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => handlePreset(6)} className="flex-1 p-1" title="Sunrise">
            <Sunrise className="w-3 h-3 text-orange-400" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePreset(12)} className="flex-1 p-1" title="Noon">
            <Sun className="w-3 h-3 text-yellow-400" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePreset(18)} className="flex-1 p-1" title="Sunset">
            <Sunset className="w-3 h-3 text-orange-600" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePreset(0)} className="flex-1 p-1" title="Midnight">
            <Moon className="w-3 h-3 text-blue-300" />
          </Button>
        </div>

        {/* Auto Progress */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <Label className="text-xs text-slate-300">Auto</Label>
          <div className="flex items-center gap-2">
            <Switch checked={autoProgress} onCheckedChange={onAutoProgressChange} />
            {autoProgress && (
              <span className="text-xs text-slate-400">{timeSpeed.toFixed(1)}x</span>
            )}
          </div>
        </div>

        {/* Time Speed - only when auto progress is enabled */}
        {autoProgress && (
          <Slider
            value={[timeSpeed]}
            onValueChange={(v) => onTimeSpeedChange(v[0])}
            min={0.1}
            max={10}
            step={0.1}
            className="w-full"
          />
        )}
      </div>
    </div>
  );
}
