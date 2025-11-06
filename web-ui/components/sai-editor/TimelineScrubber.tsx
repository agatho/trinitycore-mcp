/**
 * Timeline Scrubber Component
 *
 * Interactive timeline for replaying and scrubbing through simulation history.
 * Provides video-player-like controls for debugging execution flow.
 * Phase 3 revolutionary feature.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Film,
  Filter,
  Download,
  Zap,
  Activity,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SimulationEvent } from '@/lib/sai-unified/simulator';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineScrubberProps {
  /** Complete simulation history */
  history: SimulationEvent[];
  /** Current playback position (event index) */
  currentPosition: number;
  /** Callback when position changes */
  onPositionChange: (position: number) => void;
  /** Is playback active */
  isPlaying: boolean;
  /** Callback when play/pause toggled */
  onPlayPauseToggle: () => void;
  /** Callback when reset requested */
  onReset: () => void;
}

export interface TimelineMarker {
  position: number;
  event: SimulationEvent;
  color: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  history,
  currentPosition,
  onPositionChange,
  isPlaying,
  onPlayPauseToggle,
  onReset,
}) => {
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [eventTypeFilters, setEventTypeFilters] = useState<Set<string>>(new Set());
  const [isHoveringTimeline, setIsHoveringTimeline] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate timeline dimensions
  const timelineWidth = 800;
  const timelineHeight = 80;
  const minTimestamp = history.length > 0 ? history[0].timestamp : 0;
  const maxTimestamp =
    history.length > 0 ? history[history.length - 1].timestamp : 1000;
  const duration = maxTimestamp - minTimestamp || 1000;

  // Get unique event types for filtering
  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    history.forEach((event) => types.add(event.type));
    return Array.from(types);
  }, [history]);

  // Filter history based on event type filters
  const filteredHistory = useMemo(() => {
    if (eventTypeFilters.size === 0) return history;
    return history.filter((event) => eventTypeFilters.has(event.type));
  }, [history, eventTypeFilters]);

  // Convert timestamp to canvas X position
  const timestampToX = useCallback(
    (timestamp: number): number => {
      const progress = (timestamp - minTimestamp) / duration;
      return progress * timelineWidth;
    },
    [minTimestamp, duration, timelineWidth]
  );

  // Convert canvas X position to timestamp
  const xToTimestamp = useCallback(
    (x: number): number => {
      const progress = x / timelineWidth;
      return minTimestamp + progress * duration;
    },
    [minTimestamp, duration, timelineWidth]
  );

  // Draw timeline
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, timelineWidth, timelineHeight);

    // Draw time markers
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const numMarkers = 10;
    for (let i = 0; i <= numMarkers; i++) {
      const x = (i / numMarkers) * timelineWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 10);
      ctx.stroke();

      // Draw time label
      const timestamp = minTimestamp + (i / numMarkers) * duration;
      const seconds = Math.floor(timestamp / 1000);
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText(`${seconds}s`, x - 10, 22);
    }

    // Draw event markers
    filteredHistory.forEach((event) => {
      const x = timestampToX(event.timestamp);
      const color = getEventTypeColor(event.type);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, 40, 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw vertical line
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 28);
      ctx.lineTo(x, 52);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Draw current position indicator
    if (currentPosition >= 0 && currentPosition < history.length) {
      const currentEvent = history[currentPosition];
      const x = timestampToX(currentEvent.timestamp);

      // Draw vertical line
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();

      // Draw playhead
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 6, 12);
      ctx.lineTo(x + 6, 12);
      ctx.closePath();
      ctx.fill();
    }

    // Draw hover indicator
    if (isHoveringTimeline && hoverPosition !== null) {
      const x = hoverPosition;
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    filteredHistory,
    currentPosition,
    history,
    timestampToX,
    isHoveringTimeline,
    hoverPosition,
    minTimestamp,
    duration,
    timelineWidth,
    timelineHeight,
  ]);

  // Redraw timeline on changes
  useEffect(() => {
    drawTimeline();
  }, [drawTimeline]);

  // Get event type color
  const getEventTypeColor = (type: SimulationEvent['type']): string => {
    switch (type) {
      case 'event_triggered':
        return '#3b82f6';
      case 'action_executed':
        return '#10b981';
      case 'phase_changed':
        return '#8b5cf6';
      case 'combat_changed':
        return '#ef4444';
      case 'health_changed':
        return '#f97316';
      case 'mana_changed':
        return '#06b6d4';
      case 'variable_set':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickedTimestamp = xToTimestamp(x);

    // Find closest event to clicked timestamp
    let closestIndex = 0;
    let closestDiff = Math.abs(history[0].timestamp - clickedTimestamp);

    for (let i = 1; i < history.length; i++) {
      const diff = Math.abs(history[i].timestamp - clickedTimestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    onPositionChange(closestIndex);
  };

  // Handle canvas mouse move
  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setHoverPosition(x);
  };

  // Handle canvas mouse leave
  const handleCanvasMouseLeave = () => {
    setIsHoveringTimeline(false);
    setHoverPosition(null);
  };

  // Handle previous event
  const handlePrevious = useCallback(() => {
    if (currentPosition > 0) {
      onPositionChange(currentPosition - 1);
    }
  }, [currentPosition, onPositionChange]);

  // Handle next event
  const handleNext = useCallback(() => {
    if (currentPosition < history.length - 1) {
      onPositionChange(currentPosition + 1);
    }
  }, [currentPosition, history.length, onPositionChange]);

  // Handle skip to start
  const handleSkipToStart = useCallback(() => {
    onPositionChange(0);
  }, [onPositionChange]);

  // Handle skip to end
  const handleSkipToEnd = useCallback(() => {
    if (history.length > 0) {
      onPositionChange(history.length - 1);
    }
  }, [history.length, onPositionChange]);

  // Toggle event type filter
  const toggleEventTypeFilter = (type: string) => {
    setEventTypeFilters((filters) => {
      const newFilters = new Set(filters);
      if (newFilters.has(type)) {
        newFilters.delete(type);
      } else {
        newFilters.add(type);
      }
      return newFilters;
    });
  };

  // Format timestamp
  const formatTimestamp = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = ms % 1000;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${Math.floor(
      milliseconds / 100
    )}`;
  };

  // Get current event
  const currentEvent = history[currentPosition] || null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Film className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-lg">Timeline</h2>
          <Badge variant="outline" className="ml-auto">
            {currentPosition + 1} / {history.length}
          </Badge>
        </div>

        {/* Playback Controls */}
        <div className="flex gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkipToStart}
            disabled={currentPosition === 0}
            title="Skip to Start"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentPosition === 0}
            title="Previous Event"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant={isPlaying ? 'default' : 'outline'}
            size="sm"
            onClick={onPlayPauseToggle}
            className="flex-1"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Play
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentPosition >= history.length - 1}
            title="Next Event"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkipToEnd}
            disabled={currentPosition >= history.length - 1}
            title="Skip to End"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            title="Reset Timeline"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Playback Speed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              <Zap className="w-3 h-3 inline mr-1" />
              Speed: {playbackSpeed}x
            </Label>
            <div className="flex gap-1">
              {[0.25, 0.5, 1, 2, 4].map((speed) => (
                <Button
                  key={speed}
                  variant={playbackSpeed === speed ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlaybackSpeed(speed)}
                  className="h-6 px-2 text-xs"
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Canvas */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <canvas
          ref={canvasRef}
          width={timelineWidth}
          height={timelineHeight}
          className="w-full border border-gray-300 dark:border-gray-700 rounded cursor-pointer"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseEnter={() => setIsHoveringTimeline(true)}
          onMouseLeave={handleCanvasMouseLeave}
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        {/* Current Timestamp Display */}
        <div className="flex items-center justify-between mt-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-mono font-semibold">
              {currentEvent ? formatTimestamp(currentEvent.timestamp) : '0:00.0'}
            </span>
          </div>
          <span className="text-gray-500 dark:text-gray-400 font-mono">
            / {formatTimestamp(maxTimestamp)}
          </span>
        </div>
      </div>

      {/* Current Event Display */}
      {currentEvent && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <h3 className="font-medium text-sm mb-2">Current Event</h3>
          <Card className="p-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-2 h-2 rounded-full mt-1.5`}
                style={{ backgroundColor: getEventTypeColor(currentEvent.type) }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500">
                    {formatTimestamp(currentEvent.timestamp)}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {currentEvent.type.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{currentEvent.description}</p>
                {currentEvent.eventNode && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Event: {currentEvent.eventNode.label}
                  </div>
                )}
                {currentEvent.actionNode && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Action: {currentEvent.actionNode.label}
                  </div>
                )}
                {currentEvent.targetNode && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Target: {currentEvent.targetNode.label}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Event Type Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="w-full"
        >
          <Filter className="w-4 h-4 mr-2" />
          Event Filters ({eventTypeFilters.size} active)
        </Button>

        {showFilters && (
          <div className="mt-3 space-y-2">
            {eventTypes.map((type) => (
              <button
                key={type}
                onClick={() => toggleEventTypeFilter(type)}
                className={`w-full p-2 text-left text-sm rounded border ${
                  eventTypeFilters.has(type)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getEventTypeColor(type as SimulationEvent['type']) }}
                  />
                  <span className="flex-1">{type.replace('_', ' ')}</span>
                  <Badge variant="outline" className="text-xs">
                    {history.filter((e) => e.type === type).length}
                  </Badge>
                </div>
              </button>
            ))}

            {eventTypeFilters.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEventTypeFilters(new Set())}
                className="w-full"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="p-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex justify-between mb-1">
          <span>Total Events:</span>
          <span className="font-mono font-semibold">{history.length}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Filtered Events:</span>
          <span className="font-mono font-semibold">{filteredHistory.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Duration:</span>
          <span className="font-mono font-semibold">
            {formatTimestamp(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TimelineScrubber;
