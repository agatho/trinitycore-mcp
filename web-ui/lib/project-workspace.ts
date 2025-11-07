/**
 * Multi-Map Project Workspace
 *
 * Save/load entire editing sessions with multiple maps,
 * autosave, crash recovery, and project management.
 */

import type { MapCoordinate, Road, ZoneTransition, WaypointPath } from './map-editor';

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  created: number;
  modified: number;
  version: string;
}

export interface MapState {
  mapId: number;
  coordinates: MapCoordinate[];
  roads: Road[];
  transitions: ZoneTransition[];
  waypointPaths: WaypointPath[];
  camera2D?: { x: number; y: number; scale: number };
  camera3D?: { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number };
}

export interface Project {
  metadata: ProjectMetadata;
  maps: Map<number, MapState>;
  activeMapId: number;
}

/**
 * Project Workspace Manager
 */
export class ProjectWorkspaceManager {
  private currentProject: Project | null = null;
  private autosaveInterval: NodeJS.Timeout | null = null;
  private autoSaveEnabled = true;
  private autoSaveIntervalMs = 30000; // 30 seconds

  constructor() {
    this.loadAutosave();
    this.startAutosave();
  }

  /**
   * Create new project
   */
  public createProject(name: string, description: string = ''): Project {
    const project: Project = {
      metadata: {
        id: `project-${Date.now()}`,
        name,
        description,
        author: 'World Editor User',
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
      },
      maps: new Map(),
      activeMapId: 0,
    };

    this.currentProject = project;
    this.save();

    return project;
  }

  /**
   * Save current project
   */
  public save(): boolean {
    if (!this.currentProject) return false;

    try {
      this.currentProject.metadata.modified = Date.now();

      const serialized = this.serializeProject(this.currentProject);
      localStorage.setItem(`project-${this.currentProject.metadata.id}`, serialized);

      console.log('[ProjectWorkspace] Project saved:', this.currentProject.metadata.name);
      return true;
    } catch (error) {
      console.error('[ProjectWorkspace] Failed to save project:', error);
      return false;
    }
  }

  /**
   * Load project by ID
   */
  public load(projectId: string): Project | null {
    try {
      const serialized = localStorage.getItem(`project-${projectId}`);
      if (!serialized) return null;

      const project = this.deserializeProject(serialized);
      this.currentProject = project;

      console.log('[ProjectWorkspace] Project loaded:', project.metadata.name);
      return project;
    } catch (error) {
      console.error('[ProjectWorkspace] Failed to load project:', error);
      return null;
    }
  }

  /**
   * Export project as file
   */
  public async exportProject(project: Project): Promise<Blob> {
    const serialized = this.serializeProject(project);
    return new Blob([serialized], { type: 'application/json' });
  }

  /**
   * Import project from file
   */
  public async importProject(file: File): Promise<Project> {
    const text = await file.text();
    const project = this.deserializeProject(text);

    // Generate new ID to avoid conflicts
    project.metadata.id = `project-${Date.now()}`;
    project.metadata.modified = Date.now();

    this.currentProject = project;
    this.save();

    return project;
  }

  /**
   * List all saved projects
   */
  public listProjects(): ProjectMetadata[] {
    const projects: ProjectMetadata[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('project-')) {
        try {
          const serialized = localStorage.getItem(key);
          if (serialized) {
            const project = this.deserializeProject(serialized);
            projects.push(project.metadata);
          }
        } catch (error) {
          console.error('[ProjectWorkspace] Failed to list project:', key, error);
        }
      }
    }

    return projects.sort((a, b) => b.modified - a.modified);
  }

  /**
   * Delete project
   */
  public deleteProject(projectId: string): boolean {
    try {
      localStorage.removeItem(`project-${projectId}`);
      if (this.currentProject?.metadata.id === projectId) {
        this.currentProject = null;
      }
      return true;
    } catch (error) {
      console.error('[ProjectWorkspace] Failed to delete project:', error);
      return false;
    }
  }

  /**
   * Get current project
   */
  public getCurrentProject(): Project | null {
    return this.currentProject;
  }

  /**
   * Update map state in project
   */
  public updateMapState(mapId: number, state: MapState): void {
    if (!this.currentProject) return;

    this.currentProject.maps.set(mapId, state);
    this.currentProject.metadata.modified = Date.now();
  }

  /**
   * Get map state from project
   */
  public getMapState(mapId: number): MapState | null {
    if (!this.currentProject) return null;
    return this.currentProject.maps.get(mapId) || null;
  }

  /**
   * Set active map
   */
  public setActiveMap(mapId: number): void {
    if (!this.currentProject) return;
    this.currentProject.activeMapId = mapId;
  }

  /**
   * Auto-save current project
   */
  private autoSave(): void {
    if (!this.autoSaveEnabled || !this.currentProject) return;

    try {
      const serialized = this.serializeProject(this.currentProject);
      localStorage.setItem('autosave-project', serialized);
      localStorage.setItem('autosave-timestamp', Date.now().toString());

      console.log('[ProjectWorkspace] Auto-saved');
    } catch (error) {
      console.error('[ProjectWorkspace] Auto-save failed:', error);
    }
  }

  /**
   * Load auto-save data (crash recovery)
   */
  private loadAutosave(): void {
    try {
      const serialized = localStorage.getItem('autosave-project');
      const timestamp = localStorage.getItem('autosave-timestamp');

      if (serialized && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        const fiveMinutes = 5 * 60 * 1000;

        if (age < fiveMinutes) {
          const project = this.deserializeProject(serialized);
          this.currentProject = project;

          console.log('[ProjectWorkspace] Recovered from auto-save');

          // Prompt user to save recovered project
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              if (confirm('Recovered unsaved work from auto-save. Would you like to save it?')) {
                this.save();
              }
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('[ProjectWorkspace] Failed to load autosave:', error);
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutosave(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
    }

    this.autosaveInterval = setInterval(() => {
      this.autoSave();
    }, this.autoSaveIntervalMs);
  }

  /**
   * Stop auto-save
   */
  public stopAutosave(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }

  /**
   * Serialize project to JSON
   */
  private serializeProject(project: Project): string {
    const serializable = {
      ...project,
      maps: Array.from(project.maps.entries()),
    };
    return JSON.stringify(serializable, null, 2);
  }

  /**
   * Deserialize project from JSON
   */
  private deserializeProject(json: string): Project {
    const data = JSON.parse(json);
    return {
      ...data,
      maps: new Map(data.maps),
    };
  }

  /**
   * Clear all auto-save data
   */
  public clearAutosave(): void {
    localStorage.removeItem('autosave-project');
    localStorage.removeItem('autosave-timestamp');
  }
}

// Singleton
let workspaceManager: ProjectWorkspaceManager | null = null;

export function getProjectWorkspace(): ProjectWorkspaceManager {
  if (!workspaceManager) {
    workspaceManager = new ProjectWorkspaceManager();
  }
  return workspaceManager;
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. UI Components:
 *    - ProjectManager: Modal for new/open/save projects
 *    - ProjectList: Grid view of saved projects with previews
 *    - ProjectSettings: Edit metadata and preferences
 *    - TabBar: Switch between open maps
 *
 * 2. Features:
 *    - Recent projects list
 *    - Project templates (city, dungeon, zone, etc.)
 *    - Cloud sync (optional - requires backend)
 *    - Version control integration
 *
 * 3. Crash Recovery:
 *    - Auto-save every 30 seconds
 *    - Detect browser close/reload
 *    - Prompt to save on exit
 *    - Recover from local storage on startup
 *
 * 4. Export Formats:
 *    - .wep (World Editor Project) - JSON format
 *    - Include map images and collision data references
 *    - Compress large projects
 */
