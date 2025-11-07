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

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-2xl min-w-[320px]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Time of Day</span>
        </div>
        {getTimeIcon(localTime)}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Time Display */}
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold text-white">{formatTime(localTime)}</div>
          <div className="text-sm text-slate-400">{getTimePeriod(localTime)}</div>
        </div>

        {/* Time Slider */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-300">Time (24h)</Label>
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
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-300">Quick Presets</Label>
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset(6)}
              className="flex-col h-auto py-2"
            >
              <Sunrise className="w-4 h-4 mb-1 text-orange-400" />
              <span className="text-xs">Sunrise</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset(12)}
              className="flex-col h-auto py-2"
            >
              <Sun className="w-4 h-4 mb-1 text-yellow-400" />
              <span className="text-xs">Noon</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset(18)}
              className="flex-col h-auto py-2"
            >
              <Sunset className="w-4 h-4 mb-1 text-orange-600" />
              <span className="text-xs">Sunset</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset(0)}
              className="flex-col h-auto py-2"
            >
              <Moon className="w-4 h-4 mb-1 text-blue-300" />
              <span className="text-xs">Midnight</span>
            </Button>
          </div>
        </div>

        {/* Auto Progress */}
        <div className="space-y-3 border-t border-slate-700 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-300">Auto Progress</Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={autoProgress}
                onCheckedChange={onAutoProgressChange}
              />
              {autoProgress ? (
                <Play className="w-4 h-4 text-green-400" />
              ) : (
                <Pause className="w-4 h-4 text-slate-500" />
              )}
            </div>
          </div>

          {/* Time Speed */}
          {autoProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-300">Speed</Label>
                <span className="text-xs text-slate-400">
                  {timeSpeed.toFixed(1)}x
                </span>
              </div>
              <Slider
                value={[timeSpeed]}
                onValueChange={(v) => onTimeSpeedChange(v[0])}
                min={0.1}
                max={10}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-slate-800/50 rounded p-2">
          <div className="text-xs text-slate-400 space-y-1">
            <div>• Sunrise: 6:00 AM</div>
            <div>• Sunset: 6:00 PM</div>
            {autoProgress && (
              <div className="text-blue-400 mt-2">
                Time progressing at {timeSpeed.toFixed(1)}x speed
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
