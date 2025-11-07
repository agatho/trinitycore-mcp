/**
 * Session Recorder
 *
 * Records and replays SOAP event sessions for analysis and debugging.
 * Supports recording, playback, editing, and export.
 *
 * @module session-recorder
 */

import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import type { SOAPEvent } from "./websocket-server";

// ============================================================================
// Types
// ============================================================================

/**
 * Recording session
 */
export interface RecordingSession {
  /** Session ID */
  id: string;

  /** Session name */
  name: string;

  /** Start timestamp */
  startTime: number;

  /** End timestamp */
  endTime?: number;

  /** Duration (ms) */
  duration: number;

  /** Recorded events */
  events: SOAPEvent[];

  /** Metadata */
  metadata: {
    serverIds: string[];
    eventTypes: string[];
    eventCount: number;
    description?: string;
    tags?: string[];
  };
}

/**
 * Recorder configuration
 */
export interface RecorderConfig {
  /** Output directory for recordings */
  outputDir?: string;

  /** Auto-save interval (ms) */
  autoSaveInterval?: number;

  /** Maximum events per session */
  maxEvents?: number;

  /** Compress recordings */
  compress?: boolean;
}

/**
 * Playback configuration
 */
export interface PlaybackConfig {
  /** Playback speed multiplier */
  speed?: number;

  /** Start from timestamp */
  startTime?: number;

  /** End at timestamp */
  endTime?: number;

  /** Loop playback */
  loop?: boolean;

  /** Filter event types */
  eventTypes?: string[];
}

/**
 * Playback state
 */
export enum PlaybackState {
  STOPPED = "stopped",
  PLAYING = "playing",
  PAUSED = "paused",
}

// ============================================================================
// Session Recorder
// ============================================================================

export class SessionRecorder extends EventEmitter {
  private config: Required<RecorderConfig>;
  private currentSession: RecordingSession | null = null;
  private isRecording = false;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(config: RecorderConfig = {}) {
    super();

    this.config = {
      outputDir: config.outputDir ?? "./data/recordings",
      autoSaveInterval: config.autoSaveInterval ?? 60000, // 1 minute
      maxEvents: config.maxEvents ?? 100000,
      compress: config.compress ?? false,
    };
  }

  /**
   * Start recording
   */
  public async startRecording(name: string, description?: string): Promise<void> {
    if (this.isRecording) {
      throw new Error("Already recording");
    }

    const id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      id,
      name,
      startTime: Date.now(),
      duration: 0,
      events: [],
      metadata: {
        serverIds: [],
        eventTypes: [],
        eventCount: 0,
        description,
        tags: [],
      },
    };

    this.isRecording = true;

    // Start auto-save
    if (this.config.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.autoSave().catch((error) => {
          this.emit("autoSaveError", error);
        });
      }, this.config.autoSaveInterval);
    }

    this.emit("recordingStarted", { id, name });
  }

  /**
   * Stop recording
   */
  public async stopRecording(): Promise<RecordingSession> {
    if (!this.isRecording || !this.currentSession) {
      throw new Error("Not recording");
    }

    this.isRecording = false;

    // Stop auto-save
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Finalize session
    this.currentSession.endTime = Date.now();
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

    // Save session
    await this.saveSession(this.currentSession);

    const session = this.currentSession;
    this.currentSession = null;

    this.emit("recordingStopped", { id: session.id });

    return session;
  }

  /**
   * Record event
   */
  public recordEvent(event: SOAPEvent): void {
    if (!this.isRecording || !this.currentSession) {
      return;
    }

    // Check max events
    if (this.currentSession.events.length >= this.config.maxEvents) {
      this.emit("maxEventsReached", { sessionId: this.currentSession.id });
      return;
    }

    // Add event
    this.currentSession.events.push(event);

    // Update metadata
    if (event.serverId && !this.currentSession.metadata.serverIds.includes(event.serverId)) {
      this.currentSession.metadata.serverIds.push(event.serverId);
    }

    if (!this.currentSession.metadata.eventTypes.includes(event.type)) {
      this.currentSession.metadata.eventTypes.push(event.type);
    }

    this.currentSession.metadata.eventCount = this.currentSession.events.length;
    this.currentSession.duration = Date.now() - this.currentSession.startTime;

    this.emit("eventRecorded", { event, sessionId: this.currentSession.id });
  }

  /**
   * Get current session
   */
  public getCurrentSession(): RecordingSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Check if recording
   */
  public isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Auto-save current session
   */
  private async autoSave(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const tempSession = { ...this.currentSession };
    tempSession.duration = Date.now() - tempSession.startTime;

    await this.saveSession(tempSession, true);
    this.emit("autoSaved", { sessionId: tempSession.id });
  }

  /**
   * Save session to disk
   */
  private async saveSession(session: RecordingSession, isAutoSave = false): Promise<void> {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Generate filename
      const filename = isAutoSave
        ? `${session.id}_autosave.json`
        : `${session.id}.json`;

      const filepath = path.join(this.config.outputDir, filename);

      // Write session
      const data = JSON.stringify(session, null, 2);
      await fs.writeFile(filepath, data);

      this.emit("sessionSaved", { sessionId: session.id, filepath });
    } catch (error) {
      this.emit("saveError", { sessionId: session.id, error });
      throw error;
    }
  }

  /**
   * Load session from disk
   */
  public async loadSession(sessionId: string): Promise<RecordingSession> {
    const filepath = path.join(this.config.outputDir, `${sessionId}.json`);

    try {
      const data = await fs.readFile(filepath, "utf-8");
      const session: RecordingSession = JSON.parse(data);

      return session;
    } catch (error) {
      throw new Error(`Failed to load session ${sessionId}: ${(error as Error).message}`);
    }
  }

  /**
   * List all sessions
   */
  public async listSessions(): Promise<Array<{ id: string; name: string; startTime: number; eventCount: number }>> {
    try {
      const files = await fs.readdir(this.config.outputDir);
      const sessions: Array<{ id: string; name: string; startTime: number; eventCount: number }> = [];

      for (const file of files) {
        if (file.endsWith(".json") && !file.includes("autosave")) {
          try {
            const filepath = path.join(this.config.outputDir, file);
            const data = await fs.readFile(filepath, "utf-8");
            const session: RecordingSession = JSON.parse(data);

            sessions.push({
              id: session.id,
              name: session.name,
              startTime: session.startTime,
              eventCount: session.metadata.eventCount,
            });
          } catch (error) {
            // Skip invalid files
            continue;
          }
        }
      }

      return sessions.sort((a, b) => b.startTime - a.startTime);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete session
   */
  public async deleteSession(sessionId: string): Promise<void> {
    const filepath = path.join(this.config.outputDir, `${sessionId}.json`);

    try {
      await fs.unlink(filepath);
      this.emit("sessionDeleted", { sessionId });
    } catch (error) {
      throw new Error(`Failed to delete session ${sessionId}: ${(error as Error).message}`);
    }
  }
}

// ============================================================================
// Session Player
// ============================================================================

export class SessionPlayer extends EventEmitter {
  private session: RecordingSession | null = null;
  private state: PlaybackState = PlaybackState.STOPPED;
  private currentIndex = 0;
  private startTime = 0;
  private playbackTimer: NodeJS.Timeout | null = null;
  private config: Required<PlaybackConfig>;

  constructor(config: PlaybackConfig = {}) {
    super();

    this.config = {
      speed: config.speed ?? 1.0,
      startTime: config.startTime ?? 0,
      endTime: config.endTime ?? Infinity,
      loop: config.loop ?? false,
      eventTypes: config.eventTypes ?? [],
    };
  }

  /**
   * Load session for playback
   */
  public loadSession(session: RecordingSession): void {
    if (this.state !== PlaybackState.STOPPED) {
      this.stop();
    }

    this.session = session;
    this.currentIndex = 0;

    // Filter events if needed
    if (this.config.eventTypes.length > 0) {
      this.session.events = this.session.events.filter((e) =>
        this.config.eventTypes.includes(e.type),
      );
    }

    this.emit("sessionLoaded", { sessionId: session.id });
  }

  /**
   * Start playback
   */
  public play(): void {
    if (!this.session) {
      throw new Error("No session loaded");
    }

    if (this.state === PlaybackState.PLAYING) {
      return;
    }

    this.state = PlaybackState.PLAYING;
    this.startTime = Date.now();

    this.scheduleNextEvent();

    this.emit("playbackStarted");
  }

  /**
   * Pause playback
   */
  public pause(): void {
    if (this.state !== PlaybackState.PLAYING) {
      return;
    }

    this.state = PlaybackState.PAUSED;

    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.emit("playbackPaused");
  }

  /**
   * Resume playback
   */
  public resume(): void {
    if (this.state !== PlaybackState.PAUSED) {
      return;
    }

    this.play();
  }

  /**
   * Stop playback
   */
  public stop(): void {
    this.state = PlaybackState.STOPPED;
    this.currentIndex = 0;

    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.emit("playbackStopped");
  }

  /**
   * Seek to position
   */
  public seek(position: number): void {
    if (!this.session) {
      return;
    }

    // Find event index at position
    const targetTime = this.session.startTime + position;
    this.currentIndex = this.session.events.findIndex((e) => e.timestamp >= targetTime);

    if (this.currentIndex === -1) {
      this.currentIndex = this.session.events.length;
    }

    this.emit("seeked", { position });

    if (this.state === PlaybackState.PLAYING) {
      this.scheduleNextEvent();
    }
  }

  /**
   * Schedule next event
   */
  private scheduleNextEvent(): void {
    if (!this.session || this.state !== PlaybackState.PLAYING) {
      return;
    }

    if (this.currentIndex >= this.session.events.length) {
      if (this.config.loop) {
        this.currentIndex = 0;
        this.startTime = Date.now();
      } else {
        this.stop();
        this.emit("playbackEnded");
        return;
      }
    }

    const event = this.session.events[this.currentIndex];
    const eventTime = event.timestamp - this.session.startTime;
    const playbackTime = (Date.now() - this.startTime) * this.config.speed;
    const delay = Math.max(0, (eventTime - playbackTime) / this.config.speed);

    this.playbackTimer = setTimeout(() => {
      this.emit("event", event);
      this.currentIndex++;
      this.scheduleNextEvent();
    }, delay);
  }

  /**
   * Get playback state
   */
  public getState(): PlaybackState {
    return this.state;
  }

  /**
   * Get current position (ms)
   */
  public getPosition(): number {
    if (!this.session) {
      return 0;
    }

    if (this.state === PlaybackState.STOPPED) {
      return 0;
    }

    const currentEvent = this.session.events[this.currentIndex];
    return currentEvent ? currentEvent.timestamp - this.session.startTime : 0;
  }

  /**
   * Get session duration
   */
  public getDuration(): number {
    return this.session?.duration || 0;
  }

  /**
   * Set playback speed
   */
  public setSpeed(speed: number): void {
    if (speed <= 0) {
      throw new Error("Speed must be positive");
    }

    this.config.speed = speed;
    this.emit("speedChanged", { speed });

    // Reschedule if playing
    if (this.state === PlaybackState.PLAYING) {
      if (this.playbackTimer) {
        clearTimeout(this.playbackTimer);
      }
      this.scheduleNextEvent();
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge multiple sessions
 */
export function mergeSessions(sessions: RecordingSession[]): RecordingSession {
  if (sessions.length === 0) {
    throw new Error("No sessions to merge");
  }

  const allEvents: SOAPEvent[] = [];
  const serverIds = new Set<string>();
  const eventTypes = new Set<string>();

  for (const session of sessions) {
    allEvents.push(...session.events);

    for (const serverId of session.metadata.serverIds) {
      serverIds.add(serverId);
    }

    for (const eventType of session.metadata.eventTypes) {
      eventTypes.add(eventType);
    }
  }

  // Sort events by timestamp
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  const startTime = Math.min(...sessions.map((s) => s.startTime));
  const endTime = Math.max(...sessions.map((s) => s.endTime || s.startTime + s.duration));

  return {
    id: `merged_${Date.now()}`,
    name: `Merged: ${sessions.map((s) => s.name).join(", ")}`,
    startTime,
    endTime,
    duration: endTime - startTime,
    events: allEvents,
    metadata: {
      serverIds: Array.from(serverIds),
      eventTypes: Array.from(eventTypes),
      eventCount: allEvents.length,
      description: `Merged from ${sessions.length} sessions`,
    },
  };
}

/**
 * Extract session slice
 */
export function extractSlice(
  session: RecordingSession,
  startTime: number,
  endTime: number,
): RecordingSession {
  const events = session.events.filter(
    (e) => e.timestamp >= startTime && e.timestamp <= endTime,
  );

  const serverIds = new Set<string>();
  const eventTypes = new Set<string>();

  for (const event of events) {
    if (event.serverId) serverIds.add(event.serverId);
    eventTypes.add(event.type);
  }

  return {
    id: `${session.id}_slice_${startTime}_${endTime}`,
    name: `${session.name} (Slice)`,
    startTime,
    endTime,
    duration: endTime - startTime,
    events,
    metadata: {
      serverIds: Array.from(serverIds),
      eventTypes: Array.from(eventTypes),
      eventCount: events.length,
      description: `Slice of ${session.name}`,
    },
  };
}
