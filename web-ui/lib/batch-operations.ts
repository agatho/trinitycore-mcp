/**
 * Batch Operations & Scripting
 *
 * Automate repetitive tasks with batch editing, macro recording,
 * and JavaScript/TypeScript scripting API.
 */

import type { MapCoordinate, Road, WaypointPath } from './map-editor';
import { getUndoRedoManager, BatchCommand, type Command } from './undo-redo-system';

export interface BatchEditOperation {
  type: 'update-property' | 'transform' | 'delete' | 'duplicate' | 'rotate' | 'mirror';
  targets: string[]; // Spawn IDs
  params: Record<string, any>;
}

export interface MacroAction {
  timestamp: number;
  action: string;
  params: any;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  code: string;
  category: 'transform' | 'generate' | 'export' | 'utility';
  lastRun?: number;
}

/**
 * Batch Operations Manager
 */
export class BatchOperationsManager {
  private recording: boolean = false;
  private recordedActions: MacroAction[] = [];
  private scripts: Map<string, Script> = new Map();

  constructor() {
    this.loadBuiltInScripts();
  }

  /**
   * Load built-in scripts
   */
  private loadBuiltInScripts(): void {
    // Mirror spawns script
    this.scripts.set('mirror-x', {
      id: 'mirror-x',
      name: 'Mirror Along X-Axis',
      description: 'Mirror selected spawns along the X-axis',
      code: `
        // Mirror along X-axis
        for (const spawn of selectedSpawns) {
          const mirrored = {
            ...spawn,
            id: 'mirrored-' + spawn.id,
            x: -spawn.x,
            orientation: Math.PI - spawn.orientation,
          };
          addSpawn(mirrored);
        }
      `,
      category: 'transform',
    });

    // Rotate group script
    this.scripts.set('rotate-group', {
      id: 'rotate-group',
      name: 'Rotate Group',
      description: 'Rotate selected spawns around their center',
      code: `
        // Get center point
        const centerX = selectedSpawns.reduce((sum, s) => sum + s.x, 0) / selectedSpawns.length;
        const centerY = selectedSpawns.reduce((sum, s) => sum + s.y, 0) / selectedSpawns.length;

        const angle = params.angle * (Math.PI / 180); // degrees to radians

        // Rotate each spawn
        for (const spawn of selectedSpawns) {
          const dx = spawn.x - centerX;
          const dy = spawn.y - centerY;

          const rotatedX = centerX + dx * Math.cos(angle) - dy * Math.sin(angle);
          const rotatedY = centerY + dx * Math.sin(angle) + dy * Math.cos(angle);

          updateSpawn(spawn.id, {
            x: rotatedX,
            y: rotatedY,
            orientation: (spawn.orientation + angle) % (Math.PI * 2),
          });
        }
      `,
      category: 'transform',
    });

    // Distribute evenly script
    this.scripts.set('distribute-evenly', {
      id: 'distribute-evenly',
      name: 'Distribute Evenly',
      description: 'Distribute spawns evenly between first and last',
      code: `
        if (selectedSpawns.length < 2) return;

        // Sort by X coordinate
        selectedSpawns.sort((a, b) => a.x - b.x);

        const first = selectedSpawns[0];
        const last = selectedSpawns[selectedSpawns.length - 1];
        const count = selectedSpawns.length;

        // Distribute evenly
        for (let i = 1; i < count - 1; i++) {
          const t = i / (count - 1);
          updateSpawn(selectedSpawns[i].id, {
            x: first.x + (last.x - first.x) * t,
            y: first.y + (last.y - first.y) * t,
          });
        }
      `,
      category: 'transform',
    });
  }

  /**
   * Execute batch edit operation
   */
  public executeBatchEdit(
    operation: BatchEditOperation,
    getCoordinates: () => MapCoordinate[],
    updateCoordinate: (id: string, updates: Partial<MapCoordinate>) => void,
    removeCoordinate: (id: string) => void,
    addCoordinate: (coord: MapCoordinate) => void
  ): void {
    const undoManager = getUndoRedoManager();
    const commands: Command[] = [];

    const targets = getCoordinates().filter(c => operation.targets.includes(c.id));

    switch (operation.type) {
      case 'update-property':
        for (const target of targets) {
          // Create update command
          const oldState = { ...target };
          const newState = { ...operation.params };

          updateCoordinate(target.id, newState);

          // Store for undo
          commands.push({
            id: `batch-update-${Date.now()}-${Math.random()}`,
            description: `Update ${operation.targets.length} spawns`,
            timestamp: Date.now(),
            execute: () => updateCoordinate(target.id, newState),
            undo: () => updateCoordinate(target.id, oldState),
            redo: function() { this.execute(); },
          });
        }
        break;

      case 'transform':
        // Apply transformation matrix
        const { offsetX = 0, offsetY = 0, offsetZ = 0, scale = 1 } = operation.params;

        for (const target of targets) {
          const newState = {
            x: target.x * scale + offsetX,
            y: target.y * scale + offsetY,
            z: target.z * scale + offsetZ,
          };
          updateCoordinate(target.id, newState);
        }
        break;

      case 'delete':
        for (const target of targets) {
          removeCoordinate(target.id);
        }
        break;

      case 'duplicate':
        const { offsetX: dupX = 10, offsetY: dupY = 0, offsetZ: dupZ = 0 } = operation.params;

        for (const target of targets) {
          const duplicate: MapCoordinate = {
            ...target,
            id: `dup-${target.id}-${Date.now()}`,
            x: target.x + dupX,
            y: target.y + dupY,
            z: target.z + dupZ,
            label: `Copy of ${target.label}`,
          };
          addCoordinate(duplicate);
        }
        break;

      case 'rotate':
        const angle = operation.params.angle * (Math.PI / 180);
        const centerX = targets.reduce((sum, t) => sum + t.x, 0) / targets.length;
        const centerY = targets.reduce((sum, t) => sum + t.y, 0) / targets.length;

        for (const target of targets) {
          const dx = target.x - centerX;
          const dy = target.y - centerY;

          const rotatedX = centerX + dx * Math.cos(angle) - dy * Math.sin(angle);
          const rotatedY = centerY + dx * Math.sin(angle) + dy * Math.cos(angle);

          updateCoordinate(target.id, {
            x: rotatedX,
            y: rotatedY,
            orientation: (target.orientation || 0) + angle,
          });
        }
        break;

      case 'mirror':
        const axis = operation.params.axis || 'x';
        const center = targets.reduce((sum, t) => sum + (axis === 'x' ? t.x : t.y), 0) / targets.length;

        for (const target of targets) {
          if (axis === 'x') {
            updateCoordinate(target.id, {
              x: 2 * center - target.x,
              orientation: Math.PI - (target.orientation || 0),
            });
          } else {
            updateCoordinate(target.id, {
              y: 2 * center - target.y,
              orientation: -(target.orientation || 0),
            });
          }
        }
        break;
    }

    // Record as single batch command
    if (commands.length > 0) {
      const batchCmd = new BatchCommand(commands, `Batch: ${operation.type} on ${commands.length} items`);
      undoManager.execute(batchCmd);
    }
  }

  /**
   * Start recording macro
   */
  public startRecording(): void {
    this.recording = true;
    this.recordedActions = [];
    console.log('[BatchOperations] Recording started');
  }

  /**
   * Stop recording macro
   */
  public stopRecording(): MacroAction[] {
    this.recording = false;
    console.log('[BatchOperations] Recording stopped:', this.recordedActions.length, 'actions');
    return [...this.recordedActions];
  }

  /**
   * Record an action (call this from editor actions)
   */
  public recordAction(action: string, params: any): void {
    if (!this.recording) return;

    this.recordedActions.push({
      timestamp: Date.now(),
      action,
      params,
    });
  }

  /**
   * Replay recorded macro
   */
  public replayMacro(
    macro: MacroAction[],
    executeAction: (action: string, params: any) => void
  ): void {
    console.log('[BatchOperations] Replaying macro:', macro.length, 'actions');

    for (const action of macro) {
      executeAction(action.action, action.params);
    }
  }

  /**
   * Execute script
   */
  public executeScript(
    scriptId: string,
    context: {
      selectedSpawns: MapCoordinate[];
      allSpawns: MapCoordinate[];
      params?: Record<string, any>;
      addSpawn: (spawn: MapCoordinate) => void;
      updateSpawn: (id: string, updates: Partial<MapCoordinate>) => void;
      removeSpawn: (id: string) => void;
    }
  ): void {
    const script = this.scripts.get(scriptId);
    if (!script) {
      console.error('[BatchOperations] Script not found:', scriptId);
      return;
    }

    try {
      // Create sandboxed execution context
      const sandboxedFunction = new Function(
        'selectedSpawns',
        'allSpawns',
        'params',
        'addSpawn',
        'updateSpawn',
        'removeSpawn',
        script.code
      );

      sandboxedFunction(
        context.selectedSpawns,
        context.allSpawns,
        context.params || {},
        context.addSpawn,
        context.updateSpawn,
        context.removeSpawn
      );

      script.lastRun = Date.now();
      console.log('[BatchOperations] Script executed:', script.name);
    } catch (error) {
      console.error('[BatchOperations] Script execution error:', error);
      throw error;
    }
  }

  /**
   * Add custom script
   */
  public addScript(script: Script): void {
    this.scripts.set(script.id, script);
  }

  /**
   * Get all scripts
   */
  public getScripts(): Script[] {
    return Array.from(this.scripts.values());
  }

  /**
   * Get scripts by category
   */
  public getScriptsByCategory(category: Script['category']): Script[] {
    return Array.from(this.scripts.values()).filter(s => s.category === category);
  }

  /**
   * Export script as file
   */
  public exportScript(scriptId: string): string {
    const script = this.scripts.get(scriptId);
    if (!script) throw new Error('Script not found');

    return JSON.stringify(script, null, 2);
  }

  /**
   * Import script from file
   */
  public importScript(json: string): Script {
    const script = JSON.parse(json) as Script;
    this.scripts.set(script.id, script);
    return script;
  }
}

// Singleton
let batchOps: BatchOperationsManager | null = null;

export function getBatchOperations(): BatchOperationsManager {
  if (!batchOps) {
    batchOps = new BatchOperationsManager();
  }
  return batchOps;
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. UI Components:
 *    - BatchEditPanel: Property editor for multiple selections
 *    - ScriptLibrary: Grid of available scripts
 *    - ScriptEditor: Monaco editor for custom scripts
 *    - MacroRecorder: Record/stop/replay controls
 *
 * 2. Common Batch Operations:
 *    - Change faction for all selected
 *    - Set movement type (idle, random, patrol)
 *    - Adjust spawn timer
 *    - Copy/paste with offset
 *    - Find and replace (by template ID)
 *
 * 3. Script API:
 *    - Expose helper functions: distance(), getHeight(), etc.
 *    - Access to map data structures
 *    - Integration with undo/redo
 *    - Type definitions for autocomplete
 *
 * 4. Safety:
 *    - Sandbox script execution (use Web Workers?)
 *    - Limit execution time (timeout)
 *    - Validate script before execution
 *    - Confirm before destructive operations
 *
 * 5. Script Library:
 *    - Share scripts with community
 *    - Import from GitHub gists
 *    - Categories: transform, generate, export, utility
 *    - Rate and favorite scripts
 */
