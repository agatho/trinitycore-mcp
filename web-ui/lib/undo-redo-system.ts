/**
 * Undo/Redo System - Command Pattern Implementation
 *
 * Provides unlimited undo/redo functionality for all editor operations.
 * Uses the Command pattern for clean, extensible action management.
 */

import type { MapCoordinate, Road, ZoneTransition, WaypointPath } from './map-editor';

/**
 * Base Command interface
 */
export interface Command {
  /** Unique command ID */
  id: string;

  /** Human-readable command description */
  description: string;

  /** Timestamp when command was executed */
  timestamp: number;

  /** Execute the command */
  execute(): void;

  /** Undo the command */
  undo(): void;

  /** Redo the command (usually same as execute) */
  redo(): void;
}

/**
 * Command types for type-safe command creation
 */
export type CommandType =
  | 'add-coordinate'
  | 'update-coordinate'
  | 'delete-coordinate'
  | 'add-road'
  | 'update-road'
  | 'delete-road'
  | 'add-waypoint-path'
  | 'update-waypoint-path'
  | 'delete-waypoint-path'
  | 'add-transition'
  | 'update-transition'
  | 'delete-transition'
  | 'batch';

/**
 * Undo/Redo Manager
 */
export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize: number;
  private listeners: Set<() => void> = new Set();

  constructor(maxStackSize: number = 1000) {
    this.maxStackSize = maxStackSize;
  }

  /**
   * Execute and record a command
   */
  public execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);

    // Clear redo stack when new command is executed
    this.redoStack = [];

    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    this.notifyListeners();
  }

  /**
   * Undo the last command
   */
  public undo(): boolean {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Redo the last undone command
   */
  public redo(): boolean {
    const command = this.redoStack.pop();
    if (command) {
      command.redo();
      this.undoStack.push(command);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Check if undo is available
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo stack
   */
  public getUndoStack(): Command[] {
    return [...this.undoStack];
  }

  /**
   * Get redo stack
   */
  public getRedoStack(): Command[] {
    return [...this.redoStack];
  }

  /**
   * Get last command description
   */
  public getLastCommandDescription(): string | null {
    const last = this.undoStack[this.undoStack.length - 1];
    return last ? last.description : null;
  }

  /**
   * Clear all history
   */
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  /**
   * Get history size
   */
  public getHistorySize(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    };
  }

  /**
   * Subscribe to history changes
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

/**
 * Add Coordinate Command
 */
export class AddCoordinateCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private coordinate: MapCoordinate,
    private addFn: (coord: MapCoordinate) => void,
    private removeFn: (id: string) => void
  ) {
    this.id = `add-coord-${Date.now()}-${Math.random()}`;
    this.description = `Add ${coordinate.type}: ${coordinate.label || coordinate.id}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.addFn(this.coordinate);
  }

  undo(): void {
    this.removeFn(this.coordinate.id);
  }

  redo(): void {
    this.execute();
  }
}

/**
 * Update Coordinate Command
 */
export class UpdateCoordinateCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private coordId: string,
    private oldState: Partial<MapCoordinate>,
    private newState: Partial<MapCoordinate>,
    private updateFn: (id: string, updates: Partial<MapCoordinate>) => void
  ) {
    this.id = `update-coord-${Date.now()}-${Math.random()}`;
    this.description = `Update coordinate: ${coordId}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.updateFn(this.coordId, this.newState);
  }

  undo(): void {
    this.updateFn(this.coordId, this.oldState);
  }

  redo(): void {
    this.execute();
  }
}

/**
 * Delete Coordinate Command
 */
export class DeleteCoordinateCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private coordinate: MapCoordinate,
    private addFn: (coord: MapCoordinate) => void,
    private removeFn: (id: string) => void
  ) {
    this.id = `delete-coord-${Date.now()}-${Math.random()}`;
    this.description = `Delete ${coordinate.type}: ${coordinate.label || coordinate.id}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.removeFn(this.coordinate.id);
  }

  undo(): void {
    this.addFn(this.coordinate);
  }

  redo(): void {
    this.execute();
  }
}

/**
 * Batch Command - execute multiple commands as one
 */
export class BatchCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private commands: Command[],
    description?: string
  ) {
    this.id = `batch-${Date.now()}-${Math.random()}`;
    this.description = description || `Batch operation (${commands.length} actions)`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.commands.forEach(cmd => cmd.execute());
  }

  undo(): void {
    // Undo in reverse order
    [...this.commands].reverse().forEach(cmd => cmd.undo());
  }

  redo(): void {
    this.execute();
  }
}

/**
 * Road Commands
 */
export class AddRoadCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private road: Road,
    private addFn: (road: Road) => void,
    private removeFn: (id: string) => void
  ) {
    this.id = `add-road-${Date.now()}-${Math.random()}`;
    this.description = `Add road: ${road.id}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.addFn(this.road);
  }

  undo(): void {
    this.removeFn(this.road.id);
  }

  redo(): void {
    this.execute();
  }
}

export class DeleteRoadCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private road: Road,
    private addFn: (road: Road) => void,
    private removeFn: (id: string) => void
  ) {
    this.id = `delete-road-${Date.now()}-${Math.random()}`;
    this.description = `Delete road: ${road.id}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.removeFn(this.road.id);
  }

  undo(): void {
    this.addFn(this.road);
  }

  redo(): void {
    this.execute();
  }
}

/**
 * Waypoint Path Commands
 */
export class AddWaypointPathCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private path: WaypointPath,
    private addFn: (path: WaypointPath) => void,
    private removeFn: (id: string) => void
  ) {
    this.id = `add-waypoint-${Date.now()}-${Math.random()}`;
    this.description = `Add waypoint path: ${path.id}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.addFn(this.path);
  }

  undo(): void {
    this.removeFn(this.path.id);
  }

  redo(): void {
    this.execute();
  }
}

export class DeleteWaypointPathCommand implements Command {
  id: string;
  description: string;
  timestamp: number;

  constructor(
    private path: WaypointPath,
    private addFn: (path: WaypointPath) => void,
    private removeFn: (id: string) => void
  ) {
    this.id = `delete-waypoint-${Date.now()}-${Math.random()}`;
    this.description = `Delete waypoint path: ${path.id}`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.removeFn(this.path.id);
  }

  undo(): void {
    this.addFn(this.path);
  }

  redo(): void {
    this.execute();
  }
}

// Singleton instance
let undoRedoManager: UndoRedoManager | null = null;

export function getUndoRedoManager(): UndoRedoManager {
  if (!undoRedoManager) {
    undoRedoManager = new UndoRedoManager(1000);
  }
  return undoRedoManager;
}
