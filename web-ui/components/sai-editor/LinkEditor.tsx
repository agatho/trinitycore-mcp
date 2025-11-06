/**
 * Link Editor Component
 *
 * Visual editor for event link chains (event chaining via link field).
 * Displays available events and allows creating/editing/removing links.
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2, Unlink, AlertTriangle, Info } from 'lucide-react';
import { SAINode } from '@/lib/sai-unified/types';

interface LinkEditorProps {
  /** Current node being edited */
  currentNode: SAINode;
  /** All event nodes in the script (for link target selection) */
  allEventNodes: SAINode[];
  /** Current link value (event ID to link to) */
  value: number;
  /** Callback when link changes */
  onChange: (link: number) => void;
}

export const LinkEditor: React.FC<LinkEditorProps> = ({
  currentNode,
  allEventNodes,
  value,
  onChange,
}) => {
  // Filter out current node and non-event nodes
  const availableEvents = allEventNodes.filter(
    (node) => node.type === 'event' && node.id !== currentNode.id
  );

  // Find the linked event node
  const linkedEvent = availableEvents.find((node) => {
    // Try matching by ID (if link is a number)
    const nodeIdNum = parseInt(node.id.replace('event-', ''));
    return nodeIdNum === value;
  });

  // Detect circular links (A -> B -> A)
  const hasCircularLink = linkedEvent && linkedEvent.link === parseInt(currentNode.id.replace('event-', ''));

  // Clear link
  const handleClearLink = () => {
    onChange(0);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-orange-500" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Event Link Chain</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Link this event to execute another event immediately after
            </p>
          </div>
        </div>

        {/* Link Selector */}
        <div className="space-y-2">
          <Label htmlFor="link-select" className="text-xs font-medium">
            Link to Event ID
          </Label>
          <div className="flex gap-2">
            <Select
              value={value.toString()}
              onValueChange={(val) => onChange(parseInt(val) || 0)}
            >
              <SelectTrigger id="link-select" className="flex-1">
                <SelectValue placeholder="No link (standalone event)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">
                  <span className="text-gray-500 italic">No link (standalone event)</span>
                </SelectItem>
                {availableEvents.map((event) => {
                  const eventIdNum = parseInt(event.id.replace('event-', ''));
                  return (
                    <SelectItem key={event.id} value={eventIdNum.toString()}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          ID {eventIdNum}
                        </Badge>
                        <span className="truncate">{event.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {value > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLink}
                title="Remove link"
              >
                <Unlink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Link Status */}
        {value > 0 && (
          <div className="space-y-2">
            {linkedEvent ? (
              <>
                {/* Successfully linked */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div className="flex-1 text-xs space-y-1">
                      <p className="font-medium text-blue-700 dark:text-blue-300">
                        Linked to: {linkedEvent.label}
                      </p>
                      <p className="text-blue-600 dark:text-blue-400">
                        When this event fires, event ID {value} will execute immediately after.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Circular link warning */}
                {hasCircularLink && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                      <div className="flex-1 text-xs space-y-1">
                        <p className="font-medium text-yellow-700 dark:text-yellow-300">
                          Circular Link Detected!
                        </p>
                        <p className="text-yellow-600 dark:text-yellow-400">
                          Event {value} links back to this event (ID {parseInt(currentNode.id.replace('event-', ''))}),
                          creating an infinite loop. This may cause performance issues.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Link target not found */
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                  <div className="flex-1 text-xs space-y-1">
                    <p className="font-medium text-red-700 dark:text-red-300">
                      Link Target Not Found
                    </p>
                    <p className="text-red-600 dark:text-red-400">
                      Event ID {value} does not exist in this script.
                      This link will not execute anything.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Link Chain Visualization */}
        {value > 0 && linkedEvent && (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Execution Chain:
            </p>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="default" className="bg-blue-500">
                {currentNode.label}
              </Badge>
              <span className="text-orange-500">→</span>
              <Badge variant="default" className="bg-orange-500">
                {linkedEvent.label}
              </Badge>
              {linkedEvent.link && linkedEvent.link > 0 && (
                <>
                  <span className="text-orange-500">→</span>
                  <Badge variant="outline" className="text-xs">
                    Event {linkedEvent.link}
                  </Badge>
                  <span className="text-gray-500">...</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Info Box */}
        {availableEvents.length === 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-500 mt-0.5" />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                No other event nodes available to link to.
                Add more event nodes to create link chains.
              </p>
            </div>
          </div>
        )}

        {value === 0 && availableEvents.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-500 mt-0.5" />
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p className="font-medium">About Event Links:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Links force another event to execute immediately</li>
                  <li>Only works for events in the same script</li>
                  <li>The linked event bypasses its normal trigger conditions</li>
                  <li>Can create chains: Event A → Event B → Event C</li>
                  <li>Avoid circular links (A → B → A) to prevent infinite loops</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default LinkEditor;
