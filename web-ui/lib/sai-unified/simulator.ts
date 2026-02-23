/**
 * TrinityCore SAI Unified Editor - Script Simulator
 *
 * Execution engine for simulating SAI script behavior.
 * Tracks events, actions, targets, and state changes.
 *
 * @module sai-unified/simulator
 * @version 3.0.0
 */

import { SAIScript, SAINode, SAIConnection } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface SimulationState {
  /** Current timestamp in simulation (milliseconds) */
  timestamp: number;

  /** Current phase (1-12) */
  phase: number;

  /** Current health percentage (0-100) */
  healthPercent: number;

  /** Current mana percentage (0-100) */
  manaPercent: number;

  /** Is in combat */
  inCombat: boolean;

  /** Active events (event IDs that have fired) */
  activeEvents: Set<string>;

  /** Event cooldowns (event ID -> timestamp when available) */
  eventCooldowns: Map<string, number>;

  /** Execution history */
  history: SimulationEvent[];

  /** Variable storage (for custom data) */
  variables: Map<string, any>;
}

export interface SimulationEvent {
  /** Unique event ID */
  id: string;

  /** Timestamp when this occurred */
  timestamp: number;

  /** Event type */
  type: 'event_triggered' | 'action_executed' | 'phase_changed' | 'combat_changed' | 'health_changed' | 'mana_changed' | 'variable_set';

  /** Event node (if applicable) */
  eventNode?: SAINode;

  /** Action node (if applicable) */
  actionNode?: SAINode;

  /** Target node (if applicable) */
  targetNode?: SAINode;

  /** Additional data */
  data?: any;

  /** Human-readable description */
  description: string;
}

export interface EventTrigger {
  /** Event type ID */
  typeId: string;

  /** Trigger condition check */
  condition: (state: SimulationState) => boolean;

  /** Trigger description */
  description: string;
}

// ============================================================================
// SIMULATOR ENGINE
// ============================================================================

export class SAISimulator {
  private script: SAIScript;
  private state: SimulationState;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private updateRate: number = 1000; // ms per update

  constructor(script: SAIScript) {
    this.script = script;
    this.state = this.createInitialState();
  }

  /**
   * Create initial simulation state
   */
  private createInitialState(): SimulationState {
    return {
      timestamp: 0,
      phase: 1,
      healthPercent: 100,
      manaPercent: 100,
      inCombat: false,
      activeEvents: new Set(),
      eventCooldowns: new Map(),
      history: [],
      variables: new Map(),
    };
  }

  /**
   * Get current simulation state (read-only)
   */
  getState(): Readonly<SimulationState> {
    return { ...this.state };
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    this.stop();
    this.state = this.createInitialState();
  }

  /**
   * Start simulation
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.update();
    }, this.updateRate);
  }

  /**
   * Stop simulation
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Single-step update
   */
  step(): void {
    this.update();
  }

  /**
   * Main update loop
   */
  private update(): void {
    // Increment timestamp
    this.state.timestamp += this.updateRate;

    // Check all event nodes for triggers
    const eventNodes = this.script.nodes.filter((node) => node.type === 'event');

    for (const eventNode of eventNodes) {
      if (this.shouldEventTrigger(eventNode)) {
        this.triggerEvent(eventNode);
      }
    }
  }

  /**
   * Check if an event should trigger
   */
  private shouldEventTrigger(eventNode: SAINode): boolean {
    // Check phase mask
    if (eventNode.phase && eventNode.phase > 0) {
      const phaseBit = 1 << (this.state.phase - 1);
      if ((eventNode.phase & phaseBit) === 0) {
        return false; // Not in active phase
      }
    }

    // Check chance
    if (eventNode.chance && eventNode.chance < 100) {
      if (Math.random() * 100 > eventNode.chance) {
        return false; // Failed chance roll
      }
    }

    // Check flags
    const flags = eventNode.flags || 0;
    const NOT_REPEATABLE = 0x01;
    const COMBAT_ONLY = 0x80;

    // Check not repeatable flag
    if (flags & NOT_REPEATABLE) {
      if (this.state.activeEvents.has(eventNode.id)) {
        return false; // Already triggered once
      }
    }

    // Check combat only flag
    if (flags & COMBAT_ONLY) {
      if (!this.state.inCombat) {
        return false; // Not in combat
      }
    }

    // Check cooldown
    if (eventNode.cooldownMin && eventNode.cooldownMin > 0) {
      const cooldownEnd = this.state.eventCooldowns.get(eventNode.id);
      if (cooldownEnd && this.state.timestamp < cooldownEnd) {
        return false; // Still on cooldown
      }
    }

    // Check event-specific conditions
    const trigger = this.getEventTrigger(eventNode);
    if (trigger && !trigger.condition(this.state)) {
      return false;
    }

    return true;
  }

  /**
   * Get event trigger definition
   */
  private getEventTrigger(eventNode: SAINode): EventTrigger | null {
    const typeId = eventNode.typeId;

    // Event type definitions (simplified)
    const triggers: Record<string, EventTrigger> = {
      '0': {
        // UPDATE_IC (In Combat Update)
        typeId: '0',
        condition: (state) => state.inCombat,
        description: 'Updates every tick while in combat',
      },
      '1': {
        // UPDATE_OOC (Out of Combat Update)
        typeId: '1',
        condition: (state) => !state.inCombat,
        description: 'Updates every tick while out of combat',
      },
      '2': {
        // HEALTH_PCT (Health Percentage)
        typeId: '2',
        condition: (state) => {
          const param1 = Number(eventNode.parameters[0]?.value) || 0;
          const param2 = Number(eventNode.parameters[1]?.value) || 100;
          return state.healthPercent >= param1 && state.healthPercent <= param2;
        },
        description: 'Triggers when health is within range',
      },
      '3': {
        // MANA_PCT (Mana Percentage)
        typeId: '3',
        condition: (state) => {
          const param1 = Number(eventNode.parameters[0]?.value) || 0;
          const param2 = Number(eventNode.parameters[1]?.value) || 100;
          return state.manaPercent >= param1 && state.manaPercent <= param2;
        },
        description: 'Triggers when mana is within range',
      },
      '4': {
        // AGGRO (Enter Combat)
        typeId: '4',
        condition: (state) => state.inCombat,
        description: 'Triggers on aggro',
      },
      '25': {
        // RESET (Leave Combat)
        typeId: '25',
        condition: (state) => !state.inCombat,
        description: 'Triggers on reset',
      },
    };

    return triggers[typeId] || null;
  }

  /**
   * Trigger an event
   */
  private triggerEvent(eventNode: SAINode): void {
    // Mark event as active
    this.state.activeEvents.add(eventNode.id);

    // Set cooldown
    if (eventNode.cooldownMax && eventNode.cooldownMax > 0) {
      const cooldownDuration =
        eventNode.cooldownMin && eventNode.cooldownMax > eventNode.cooldownMin
          ? eventNode.cooldownMin +
            Math.random() * (eventNode.cooldownMax - eventNode.cooldownMin)
          : eventNode.cooldownMax;

      this.state.eventCooldowns.set(eventNode.id, this.state.timestamp + cooldownDuration);
    }

    // Log event trigger
    this.addHistoryEvent({
      id: `event-${this.state.timestamp}-${eventNode.id}`,
      timestamp: this.state.timestamp,
      type: 'event_triggered',
      eventNode,
      description: `Event triggered: ${eventNode.label}`,
    });

    // Execute connected actions
    this.executeActions(eventNode);

    // Check for linked events
    if (eventNode.link && eventNode.link > 0) {
      const linkedEventNode = this.script.nodes.find((node) => {
        const nodeIdNum = parseInt(node.id.replace('event-', ''));
        return node.type === 'event' && nodeIdNum === eventNode.link;
      });

      if (linkedEventNode) {
        // Trigger linked event immediately
        setTimeout(() => this.triggerEvent(linkedEventNode), 10);
      }
    }
  }

  /**
   * Execute actions for an event
   */
  private executeActions(eventNode: SAINode): void {
    // Find connected action nodes
    const connections = this.script.connections.filter(
      (conn) => conn.source === eventNode.id && conn.type === 'event-to-action'
    );

    for (const connection of connections) {
      const actionNode = this.script.nodes.find((node) => node.id === connection.target);
      if (actionNode && actionNode.type === 'action') {
        this.executeAction(eventNode, actionNode);
      }
    }
  }

  /**
   * Execute a specific action
   */
  private executeAction(eventNode: SAINode, actionNode: SAINode): void {
    // Find target node
    const targetConnection = this.script.connections.find(
      (conn) => conn.source === actionNode.id && conn.type === 'action-to-target'
    );

    const targetNode = targetConnection
      ? this.script.nodes.find((node) => node.id === targetConnection.target)
      : null;

    // Log action execution
    this.addHistoryEvent({
      id: `action-${this.state.timestamp}-${actionNode.id}`,
      timestamp: this.state.timestamp,
      type: 'action_executed',
      eventNode,
      actionNode,
      targetNode: targetNode || undefined,
      description: `Action executed: ${actionNode.label}${
        targetNode ? ` on ${targetNode.label}` : ''
      }`,
    });

    // Execute action-specific logic
    this.executeActionLogic(actionNode);
  }

  /**
   * Execute action-specific logic
   */
  private executeActionLogic(actionNode: SAINode): void {
    const typeId = actionNode.typeId;

    // Action type handlers (simplified)
    switch (typeId) {
      case '24': // SET_PHASE
        const newPhase = (actionNode.parameters[0]?.value as number) || 1;
        this.setPhase(newPhase);
        break;

      // Add more action handlers as needed
    }
  }

  /**
   * Set combat state
   */
  setCombat(inCombat: boolean): void {
    if (this.state.inCombat !== inCombat) {
      this.state.inCombat = inCombat;
      this.addHistoryEvent({
        id: `combat-${this.state.timestamp}`,
        timestamp: this.state.timestamp,
        type: 'combat_changed',
        data: { inCombat },
        description: inCombat ? 'Entered combat' : 'Left combat',
      });
    }
  }

  /**
   * Set health percentage
   */
  setHealth(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    if (this.state.healthPercent !== clamped) {
      this.state.healthPercent = clamped;
      this.addHistoryEvent({
        id: `health-${this.state.timestamp}`,
        timestamp: this.state.timestamp,
        type: 'health_changed',
        data: { healthPercent: clamped },
        description: `Health changed to ${clamped.toFixed(1)}%`,
      });
    }
  }

  /**
   * Set mana percentage
   */
  setMana(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    if (this.state.manaPercent !== clamped) {
      this.state.manaPercent = clamped;
      this.addHistoryEvent({
        id: `mana-${this.state.timestamp}`,
        timestamp: this.state.timestamp,
        type: 'mana_changed',
        data: { manaPercent: clamped },
        description: `Mana changed to ${clamped.toFixed(1)}%`,
      });
    }
  }

  /**
   * Set phase
   */
  setPhase(phase: number): void {
    const clamped = Math.max(1, Math.min(12, phase));
    if (this.state.phase !== clamped) {
      this.state.phase = clamped;
      this.addHistoryEvent({
        id: `phase-${this.state.timestamp}`,
        timestamp: this.state.timestamp,
        type: 'phase_changed',
        data: { phase: clamped },
        description: `Phase changed to ${clamped}`,
      });
    }
  }

  /**
   * Add event to history
   */
  private addHistoryEvent(event: SimulationEvent): void {
    this.state.history.push(event);

    // Limit history size
    if (this.state.history.length > 1000) {
      this.state.history = this.state.history.slice(-1000);
    }
  }

  /**
   * Get execution history
   */
  getHistory(): SimulationEvent[] {
    return [...this.state.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.history = [];
  }

  /**
   * Get update rate (ms per tick)
   */
  getUpdateRate(): number {
    return this.updateRate;
  }

  /**
   * Set update rate (ms per tick)
   */
  setUpdateRate(rate: number): void {
    this.updateRate = Math.max(100, Math.min(5000, rate));

    // Restart interval with new rate if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Check if simulator is running
   */
  isSimulatorRunning(): boolean {
    return this.isRunning;
  }
}
