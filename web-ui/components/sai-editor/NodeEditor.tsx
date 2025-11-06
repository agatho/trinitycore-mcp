/**
 * Node Editor Component
 *
 * Comprehensive editor for SAI nodes including parameters and advanced fields.
 * Integrates all Phase 1 components for complete database field coverage.
 */

'use client';

import React from 'react';
import { SAINode } from '@/lib/sai-unified/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import ParameterEditor from './ParameterEditor';
import DifficultySelector from './DifficultySelector';
import CooldownEditor from './CooldownEditor';
import CoordinateEditor from './CoordinateEditor';
import EventFlagEditor from './EventFlagEditor';
import PhaseEditor from './PhaseEditor';

interface NodeEditorProps {
  node: SAINode;
  onChange: (node: SAINode) => void;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onChange }) => {
  // Handle parameter changes
  const handleParametersChange = (parameters: typeof node.parameters) => {
    onChange({ ...node, parameters });
  };

  // Handle node field updates
  const updateNode = (updates: Partial<SAINode>) => {
    onChange({ ...node, ...updates });
  };

  // Determine which tabs to show based on node type
  const showAdvancedTab = node.type === 'event';
  const showCoordinatesTab = node.type === 'target' || node.type === 'action';
  const showTimingTab = node.type === 'event';

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="basic" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b">
          <TabsTrigger value="basic">Parameters</TabsTrigger>
          {showAdvancedTab && <TabsTrigger value="advanced">Advanced</TabsTrigger>}
          {showCoordinatesTab && <TabsTrigger value="coordinates">Coordinates</TabsTrigger>}
          {showTimingTab && <TabsTrigger value="timing">Timing</TabsTrigger>}
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Basic Parameters Tab */}
          <TabsContent value="basic" className="p-4 m-0">
            <ParameterEditor
              parameters={node.parameters}
              onChange={handleParametersChange}
              title={node.label}
              description={`${node.typeName} - ${node.type.toUpperCase()}`}
            />
          </TabsContent>

          {/* Advanced Tab (Event nodes only) */}
          {showAdvancedTab && (
            <TabsContent value="advanced" className="p-4 m-0 space-y-4">
              {/* Event Flags Editor */}
              <EventFlagEditor
                value={node.flags || 0}
                onChange={(flags) => updateNode({ flags })}
              />

              {/* Difficulty Selector */}
              <DifficultySelector
                value={node.difficulties || ''}
                onChange={(difficulties) => updateNode({ difficulties })}
              />

              {/* Phase Editor */}
              <PhaseEditor
                value={node.phase || 0}
                onChange={(phase) => updateNode({ phase })}
              />
            </TabsContent>
          )}

          {/* Coordinates Tab (Target/Action nodes) */}
          {showCoordinatesTab && (
            <TabsContent value="coordinates" className="p-4 m-0">
              <CoordinateEditor
                value={node.targetPosition || { x: 0, y: 0, z: 0, o: 0 }}
                onChange={(targetPosition) => updateNode({ targetPosition })}
              />
            </TabsContent>
          )}

          {/* Timing Tab (Event nodes only) */}
          {showTimingTab && (
            <TabsContent value="timing" className="p-4 m-0">
              <CooldownEditor
                cooldownMin={node.cooldownMin || 0}
                cooldownMax={node.cooldownMax || 0}
                onChange={(cooldownMin, cooldownMax) =>
                  updateNode({ cooldownMin, cooldownMax })
                }
              />
            </TabsContent>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default NodeEditor;
