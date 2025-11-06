/**
 * Simulator Panel Component
 *
 * Control panel for SAI script simulation with state controls and execution history.
 * Foundation for Phase 3 full simulator with debug panel.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Activity,
  Heart,
  Zap,
  Swords,
  Clock,
  Trash2,
} from 'lucide-react';
import { SAIScript } from '@/lib/sai-unified/types';
import { SAISimulator, SimulationEvent } from '@/lib/sai-unified/simulator';

interface SimulatorPanelProps {
  /** Script to simulate */
  script: SAIScript;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({ script }) => {
  const [simulator] = useState(() => new SAISimulator(script));
  const [isRunning, setIsRunning] = useState(false);
  const [state, setState] = useState(simulator.getState());
  const [history, setHistory] = useState<SimulationEvent[]>([]);

  // Update state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(simulator.getState());
      setHistory(simulator.getHistory());
    }, 100);

    return () => clearInterval(interval);
  }, [simulator]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (isRunning) {
      simulator.stop();
      setIsRunning(false);
    } else {
      simulator.start();
      setIsRunning(true);
    }
  }, [isRunning, simulator]);

  // Handle reset
  const handleReset = useCallback(() => {
    simulator.reset();
    setIsRunning(false);
    setState(simulator.getState());
    setHistory([]);
  }, [simulator]);

  // Handle step
  const handleStep = useCallback(() => {
    simulator.step();
    setState(simulator.getState());
    setHistory(simulator.getHistory());
  }, [simulator]);

  // Handle clear history
  const handleClearHistory = useCallback(() => {
    simulator.clearHistory();
    setHistory([]);
  }, [simulator]);

  // Handle combat toggle
  const handleCombatToggle = useCallback(() => {
    simulator.setCombat(!state.inCombat);
    setState(simulator.getState());
  }, [simulator, state.inCombat]);

  // Handle health change
  const handleHealthChange = useCallback(
    (value: number[]) => {
      simulator.setHealth(value[0]);
      setState(simulator.getState());
    },
    [simulator]
  );

  // Handle mana change
  const handleManaChange = useCallback(
    (value: number[]) => {
      simulator.setMana(value[0]);
      setState(simulator.getState());
    },
    [simulator]
  );

  // Handle phase change
  const handlePhaseChange = useCallback(
    (value: number[]) => {
      simulator.setPhase(value[0]);
      setState(simulator.getState());
    },
    [simulator]
  );

  // Format timestamp
  const formatTimestamp = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get event type color
  const getEventTypeColor = (type: SimulationEvent['type']): string => {
    switch (type) {
      case 'event_triggered':
        return 'bg-blue-500';
      case 'action_executed':
        return 'bg-green-500';
      case 'phase_changed':
        return 'bg-purple-500';
      case 'combat_changed':
        return 'bg-red-500';
      case 'health_changed':
        return 'bg-orange-500';
      case 'mana_changed':
        return 'bg-cyan-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-lg">Script Simulator</h2>
          <Badge variant={isRunning ? 'default' : 'outline'} className="ml-auto">
            {isRunning ? 'Running' : 'Paused'}
          </Badge>
        </div>

        {/* Playback Controls */}
        <div className="flex gap-2">
          <Button
            variant={isRunning ? 'default' : 'outline'}
            size="sm"
            onClick={handlePlayPause}
            className="flex-1"
          >
            {isRunning ? (
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
          <Button variant="outline" size="sm" onClick={handleStep} disabled={isRunning}>
            <SkipForward className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* State Controls */}
      <div className="p-4 space-y-4 border-b border-gray-200 dark:border-gray-800">
        {/* Timestamp */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">Time:</span>
          </div>
          <span className="font-mono font-semibold">{formatTimestamp(state.timestamp)}</span>
        </div>

        <Separator />

        {/* Combat State */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-2">
              <Swords className="w-4 h-4" />
              Combat State
            </Label>
            <Button
              variant={state.inCombat ? 'default' : 'outline'}
              size="sm"
              onClick={handleCombatToggle}
              className="h-7"
            >
              {state.inCombat ? 'In Combat' : 'Out of Combat'}
            </Button>
          </div>
        </div>

        {/* Health */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              Health
            </Label>
            <span className="text-xs font-mono">{state.healthPercent.toFixed(0)}%</span>
          </div>
          <Slider
            value={[state.healthPercent]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleHealthChange}
            className="w-full"
          />
        </div>

        {/* Mana */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              Mana
            </Label>
            <span className="text-xs font-mono">{state.manaPercent.toFixed(0)}%</span>
          </div>
          <Slider
            value={[state.manaPercent]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleManaChange}
            className="w-full"
          />
        </div>

        {/* Phase */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Phase</Label>
            <span className="text-xs font-mono">Phase {state.phase}</span>
          </div>
          <Slider
            value={[state.phase]}
            min={1}
            max={12}
            step={1}
            onValueChange={handlePhaseChange}
            className="w-full"
          />
        </div>
      </div>

      {/* Execution History */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-medium text-sm">Execution History</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {history.length} events
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              disabled={history.length === 0}
              className="h-7"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No Events Yet</p>
              <p className="text-sm mt-1">Click Play to start simulation</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {history.slice().reverse().map((event, index) => (
                <Card key={event.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${getEventTypeColor(event.type)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {event.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm">{event.description}</p>
                      {event.eventNode && (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Event: {event.eventNode.label}
                        </div>
                      )}
                      {event.actionNode && (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Action: {event.actionNode.label}
                        </div>
                      )}
                      {event.targetNode && (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Target: {event.targetNode.label}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default SimulatorPanel;
