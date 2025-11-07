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
import LinkEditor from './LinkEditor';

interface NodeEditorProps {
  node: SAINode;
  onChange: (node: SAINode) => void;
  /** All event nodes in the script (for link target selection) */
  allEventNodes?: SAINode[];
}

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onChange, allEventNodes = [] }) => {
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
  const showLinksTab = node.type === 'event';

  // Count visible tabs for grid layout
  const tabCount = 1 + // Parameters always shown
    (showAdvancedTab ? 1 : 0) +
    (showCoordinatesTab ? 1 : 0) +
    (showTimingTab ? 1 : 0) +
    (showLinksTab ? 1 : 0);

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="basic" className="flex-1 flex flex-col">
        <TabsList className={`grid w-full grid-cols-${tabCount} rounded-none border-b`}>
          <TabsTrigger value="basic">Parameters</TabsTrigger>
          {showAdvancedTab && <TabsTrigger value="advanced">Advanced</TabsTrigger>}
          {showCoordinatesTab && <TabsTrigger value="coordinates">Coordinates</TabsTrigger>}
          {showTimingTab && <TabsTrigger value="timing">Timing</TabsTrigger>}
          {showLinksTab && <TabsTrigger value="links">Links</TabsTrigger>}
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

          {/* Links Tab (Event nodes only) */}
          {showLinksTab && (
            <TabsContent value="links" className="p-4 m-0">
              <LinkEditor
                currentNode={node}
                allEventNodes={allEventNodes}
                value={node.link || 0}
                onChange={(link) => updateNode({ link })}
              />
            </TabsContent>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default NodeEditor;
