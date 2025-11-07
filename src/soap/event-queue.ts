/**
 * Event Queue System
 *
 * Advanced event buffering, prioritization, and backpressure handling
 * for real-time SOAP event streaming.
 *
 * @module event-queue
 */

import { EventEmitter } from "events";
import type { SOAPEvent } from "./websocket-server";
import fs from "fs/promises";
import path from "path";

// ============================================================================
// Types
// ============================================================================

/**
 * Event priority levels
 */
export enum EventPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

/**
 * Queued event with metadata
 */
export interface QueuedEvent {
  event: SOAPEvent;
  priority: EventPriority;
  queuedAt: number;
  retries: number;
  id: string;
}

/**
 * Event queue configuration
 */
export interface EventQueueConfig {
  /** Maximum queue size */
  maxSize?: number;

  /** Maximum wait time in queue (ms) */
  maxWaitTime?: number;

  /** Enable persistence to disk */
  persistence?: boolean;

  /** Persistence file path */
  persistencePath?: string;

  /** Batch size for processing */
  batchSize?: number;

  /** Process interval (ms) */
  processInterval?: number;

  /** Max retry attempts */
  maxRetries?: number;

  /** Enable dead letter queue */
  deadLetterQueue?: boolean;
}

/**
 * Queue statistics
 */
export interface QueueStatistics {
  size: number;
  processed: number;
  dropped: number;
  failed: number;
  avgWaitTime: number;
  maxWaitTime: number;
  priorityCounts: Record<EventPriority, number>;
}

// ============================================================================
// Event Queue
// ============================================================================

export class EventQueue extends EventEmitter {
  private config: Required<EventQueueConfig>;
  private queue: QueuedEvent[] = [];
  private deadLetterQueue: QueuedEvent[] = [];
  private processTimer: NodeJS.Timeout | null = null;
  private processing = false;

  // Statistics
  private stats = {
    processed: 0,
    dropped: 0,
    failed: 0,
    totalWaitTime: 0,
    maxWaitTime: 0,
  };

  constructor(config: EventQueueConfig = {}) {
    super();

    // Set defaults
    this.config = {
      maxSize: config.maxSize ?? 10000,
      maxWaitTime: config.maxWaitTime ?? 60000, // 1 minute
      persistence: config.persistence ?? false,
      persistencePath: config.persistencePath ?? "./data/event-queue.json",
      batchSize: config.batchSize ?? 100,
      processInterval: config.processInterval ?? 100, // 100ms
      maxRetries: config.maxRetries ?? 3,
      deadLetterQueue: config.deadLetterQueue ?? true,
    };
  }

  /**
   * Start queue processing
   */
  public async start(): Promise<void> {
    if (this.processTimer) {
      throw new Error("Event queue is already running");
    }

    // Load persisted events
    if (this.config.persistence) {
      await this.loadFromDisk();
    }

    // Start processing loop
    this.processTimer = setInterval(() => {
      this.process().catch((error) => {
        this.emit("error", error);
      });
    }, this.config.processInterval);

    this.emit("started");
  }

  /**
   * Stop queue processing
   */
  public async stop(): Promise<void> {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }

    // Wait for current processing to complete
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Persist remaining events
    if (this.config.persistence) {
      await this.saveToDisk();
    }

    this.emit("stopped");
  }

  /**
   * Enqueue an event
   */
  public enqueue(
    event: SOAPEvent,
    priority: EventPriority = EventPriority.NORMAL,
  ): boolean {
    // Check queue size
    if (this.queue.length >= this.config.maxSize) {
      // Drop lowest priority event
      const dropped = this.dropLowestPriority();
      if (!dropped) {
        this.stats.dropped++;
        this.emit("dropped", event);
        return false;
      }
    }

    const queuedEvent: QueuedEvent = {
      event,
      priority,
      queuedAt: Date.now(),
      retries: 0,
      id: this.generateEventId(),
    };

    // Insert in priority order
    this.insertByPriority(queuedEvent);

    this.emit("enqueued", queuedEvent);
    return true;
  }

  /**
   * Dequeue an event (for manual processing)
   */
  public dequeue(): QueuedEvent | undefined {
    return this.queue.shift();
  }

  /**
   * Peek at next event without removing
   */
  public peek(): QueuedEvent | undefined {
    return this.queue[0];
  }

  /**
   * Process queued events
   */
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Clean expired events
      this.cleanExpired();

      // Process batch
      const batch = this.queue.splice(0, Math.min(this.config.batchSize, this.queue.length));

      for (const queuedEvent of batch) {
        try {
          // Calculate wait time
          const waitTime = Date.now() - queuedEvent.queuedAt;
          this.stats.totalWaitTime += waitTime;
          this.stats.maxWaitTime = Math.max(this.stats.maxWaitTime, waitTime);

          // Emit for processing
          this.emit("process", queuedEvent.event);

          this.stats.processed++;
        } catch (error) {
          // Handle processing error
          await this.handleProcessingError(queuedEvent, error as Error);
        }
      }

      this.emit("batchProcessed", { count: batch.length });
    } catch (error) {
      this.emit("error", error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Handle processing error
   */
  private async handleProcessingError(
    queuedEvent: QueuedEvent,
    error: Error,
  ): Promise<void> {
    queuedEvent.retries++;

    if (queuedEvent.retries >= this.config.maxRetries) {
      // Move to dead letter queue
      if (this.config.deadLetterQueue) {
        this.deadLetterQueue.push(queuedEvent);
        this.emit("deadLetter", { event: queuedEvent, error });
      }

      this.stats.failed++;
    } else {
      // Re-enqueue with lower priority
      const newPriority = Math.min(queuedEvent.priority + 1, EventPriority.LOW);
      queuedEvent.priority = newPriority;
      this.insertByPriority(queuedEvent);

      this.emit("retry", queuedEvent);
    }
  }

  /**
   * Insert event by priority
   */
  private insertByPriority(queuedEvent: QueuedEvent): void {
    let insertIndex = this.queue.length;

    // Find insertion point
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority > queuedEvent.priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queuedEvent);
  }

  /**
   * Drop lowest priority event
   */
  private dropLowestPriority(): boolean {
    // Find lowest priority event (from end)
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].priority === EventPriority.LOW) {
        const dropped = this.queue.splice(i, 1)[0];
        this.stats.dropped++;
        this.emit("dropped", dropped.event);
        return true;
      }
    }

    return false;
  }

  /**
   * Clean expired events
   */
  private cleanExpired(): void {
    const now = Date.now();
    const expired: QueuedEvent[] = [];

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const queuedEvent = this.queue[i];
      const age = now - queuedEvent.queuedAt;

      if (age > this.config.maxWaitTime) {
        expired.push(...this.queue.splice(i, 1));
      }
    }

    if (expired.length > 0) {
      this.stats.dropped += expired.length;
      this.emit("expired", { count: expired.length, events: expired });
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  public getStatistics(): QueueStatistics {
    const priorityCounts: Record<EventPriority, number> = {
      [EventPriority.CRITICAL]: 0,
      [EventPriority.HIGH]: 0,
      [EventPriority.NORMAL]: 0,
      [EventPriority.LOW]: 0,
    };

    for (const queuedEvent of this.queue) {
      priorityCounts[queuedEvent.priority]++;
    }

    return {
      size: this.queue.length,
      processed: this.stats.processed,
      dropped: this.stats.dropped,
      failed: this.stats.failed,
      avgWaitTime: this.stats.processed > 0 ? this.stats.totalWaitTime / this.stats.processed : 0,
      maxWaitTime: this.stats.maxWaitTime,
      priorityCounts,
    };
  }

  /**
   * Clear queue
   */
  public clear(): void {
    const count = this.queue.length;
    this.queue = [];
    this.emit("cleared", { count });
  }

  /**
   * Get queue size
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Get dead letter queue size
   */
  public deadLetterSize(): number {
    return this.deadLetterQueue.length;
  }

  /**
   * Get dead letter queue
   */
  public getDeadLetterQueue(): QueuedEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  public clearDeadLetterQueue(): void {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.emit("deadLetterCleared", { count });
  }

  /**
   * Retry dead letter queue
   */
  public retryDeadLetterQueue(): void {
    for (const queuedEvent of this.deadLetterQueue) {
      queuedEvent.retries = 0;
      this.insertByPriority(queuedEvent);
    }

    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.emit("deadLetterRetried", { count });
  }

  /**
   * Save queue to disk
   */
  private async saveToDisk(): Promise<void> {
    try {
      const data = {
        queue: this.queue,
        deadLetterQueue: this.deadLetterQueue,
        stats: this.stats,
        timestamp: Date.now(),
      };

      const dir = path.dirname(this.config.persistencePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.config.persistencePath, JSON.stringify(data, null, 2));

      this.emit("persisted", { count: this.queue.length });
    } catch (error) {
      this.emit("persistError", error);
    }
  }

  /**
   * Load queue from disk
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.config.persistencePath, "utf-8");
      const parsed = JSON.parse(data);

      this.queue = parsed.queue || [];
      this.deadLetterQueue = parsed.deadLetterQueue || [];
      this.stats = parsed.stats || this.stats;

      this.emit("loaded", { count: this.queue.length });
    } catch (error) {
      // File doesn't exist or is corrupted - start fresh
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.emit("loadError", error);
      }
    }
  }

  /**
   * Get events by priority
   */
  public getEventsByPriority(priority: EventPriority): QueuedEvent[] {
    return this.queue.filter((qe) => qe.priority === priority);
  }

  /**
   * Get events by type
   */
  public getEventsByType(type: string): QueuedEvent[] {
    return this.queue.filter((qe) => qe.event.type === type);
  }

  /**
   * Remove event by ID
   */
  public removeEvent(id: string): boolean {
    const index = this.queue.findIndex((qe) => qe.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update event priority
   */
  public updatePriority(id: string, priority: EventPriority): boolean {
    const index = this.queue.findIndex((qe) => qe.id === id);
    if (index !== -1) {
      const queuedEvent = this.queue.splice(index, 1)[0];
      queuedEvent.priority = priority;
      this.insertByPriority(queuedEvent);
      return true;
    }
    return false;
  }
}

// ============================================================================
// Priority-Based Event Processor
// ============================================================================

/**
 * Event processor with priority-based scheduling
 */
export class PriorityEventProcessor extends EventEmitter {
  private queues: Map<EventPriority, EventQueue>;
  private processTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();

    this.queues = new Map([
      [EventPriority.CRITICAL, new EventQueue({ maxSize: 1000, processInterval: 10 })],
      [EventPriority.HIGH, new EventQueue({ maxSize: 5000, processInterval: 50 })],
      [EventPriority.NORMAL, new EventQueue({ maxSize: 10000, processInterval: 100 })],
      [EventPriority.LOW, new EventQueue({ maxSize: 20000, processInterval: 500 })],
    ]);

    // Forward events
    for (const [priority, queue] of this.queues.entries()) {
      queue.on("process", (event) => {
        this.emit("process", { priority, event });
      });

      queue.on("error", (error) => {
        this.emit("queueError", { priority, error });
      });
    }
  }

  /**
   * Start all queues
   */
  public async start(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.start();
    }

    this.emit("started");
  }

  /**
   * Stop all queues
   */
  public async stop(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.stop();
    }

    this.emit("stopped");
  }

  /**
   * Enqueue event
   */
  public enqueue(event: SOAPEvent, priority: EventPriority = EventPriority.NORMAL): boolean {
    const queue = this.queues.get(priority);
    if (!queue) {
      return false;
    }

    return queue.enqueue(event, priority);
  }

  /**
   * Get combined statistics
   */
  public getStatistics(): Record<EventPriority, QueueStatistics> {
    const stats: Record<EventPriority, QueueStatistics> = {} as Record<
      EventPriority,
      QueueStatistics
    >;

    for (const [priority, queue] of this.queues.entries()) {
      stats[priority] = queue.getStatistics();
    }

    return stats;
  }

  /**
   * Clear all queues
   */
  public clearAll(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
  }
}
