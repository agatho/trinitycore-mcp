/**
 * Creature/GameObject Browser
 *
 * Searchable database of creatures and gameobjects with templates
 * and drag-and-drop placement functionality.
 */

export interface CreatureTemplate {
  entry: number;
  name: string;
  subname: string;
  minlevel: number;
  maxlevel: number;
  faction: number;
  npcflag: number;
  rank: number;
  type: number;
  type_flags: number;
  family: number;
  modelid1: number;
  modelid2: number;
  modelid3: number;
  modelid4: number;
}

export interface GameObjectTemplate {
  entry: number;
  type: number;
  displayId: number;
  name: string;
  size: number;
  data0: number;
  data1: number;
  data2: number;
}

export interface SpawnTemplate {
  id: string;
  name: string;
  description: string;
  type: 'creature' | 'gameobject';
  spawns: Array<{
    relativeX: number;
    relativeY: number;
    relativeZ: number;
    orientation: number;
  }>;
  pattern: 'single' | 'patrol' | 'group' | 'guards';
}

/**
 * Creature/GameObject Browser Manager
 */
export class CreatureBrowserManager {
  private creatures: Map<number, CreatureTemplate> = new Map();
  private gameobjects: Map<number, GameObjectTemplate> = new Map();
  private templates: Map<string, SpawnTemplate> = new Map();
  private favorites: Set<number> = new Set();

  constructor() {
    this.loadTemplates();
  }

  /**
   * Load default spawn templates
   */
  private loadTemplates(): void {
    // City Guards Template
    this.templates.set('city-guards', {
      id: 'city-guards',
      name: 'City Guards',
      description: 'Four guards positioned at city entrance',
      type: 'creature',
      spawns: [
        { relativeX: -5, relativeY: 0, relativeZ: 0, orientation: 0 },
        { relativeX: 5, relativeY: 0, relativeZ: 0, orientation: Math.PI },
        { relativeX: 0, relativeY: -5, relativeZ: 0, orientation: Math.PI / 2 },
        { relativeX: 0, relativeY: 5, relativeZ: 0, orientation: -Math.PI / 2 },
      ],
      pattern: 'guards',
    });

    // Patrol Route Template
    this.templates.set('patrol-route', {
      id: 'patrol-route',
      name: 'Patrol Route',
      description: 'NPC with circular patrol path',
      type: 'creature',
      spawns: [
        { relativeX: 0, relativeY: 0, relativeZ: 0, orientation: 0 },
      ],
      pattern: 'patrol',
    });

    // Resource Nodes Template
    this.templates.set('resource-cluster', {
      id: 'resource-cluster',
      name: 'Resource Cluster',
      description: 'Group of 5 resource nodes',
      type: 'gameobject',
      spawns: [
        { relativeX: 0, relativeY: 0, relativeZ: 0, orientation: 0 },
        { relativeX: 3, relativeY: 2, relativeZ: 0, orientation: 0.5 },
        { relativeX: -2, relativeY: 3, relativeZ: 0, orientation: 1.2 },
        { relativeX: 4, relativeY: -1, relativeZ: 0, orientation: 2.1 },
        { relativeX: -3, relativeY: -2, relativeZ: 0, orientation: 3.8 },
      ],
      pattern: 'group',
    });
  }

  /**
   * Search creatures by name or entry
   */
  public async searchCreatures(query: string): Promise<CreatureTemplate[]> {
    // TODO: Implement database query via MCP
    // Query creature_template table

    return [];
  }

  /**
   * Search gameobjects by name or entry
   */
  public async searchGameObjects(query: string): Promise<GameObjectTemplate[]> {
    // TODO: Implement database query via MCP
    // Query gameobject_template table

    return [];
  }

  /**
   * Get creature details
   */
  public async getCreature(entry: number): Promise<CreatureTemplate | null> {
    if (this.creatures.has(entry)) {
      return this.creatures.get(entry)!;
    }

    // TODO: Load from database via MCP
    return null;
  }

  /**
   * Get gameobject details
   */
  public async getGameObject(entry: number): Promise<GameObjectTemplate | null> {
    if (this.gameobjects.has(entry)) {
      return this.gameobjects.get(entry)!;
    }

    // TODO: Load from database via MCP
    return null;
  }

  /**
   * Get spawn templates
   */
  public getTemplates(): SpawnTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  public getTemplate(id: string): SpawnTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Add to favorites
   */
  public addFavorite(entry: number): void {
    this.favorites.add(entry);
    this.saveFavorites();
  }

  /**
   * Remove from favorites
   */
  public removeFavorite(entry: number): void {
    this.favorites.delete(entry);
    this.saveFavorites();
  }

  /**
   * Get favorites
   */
  public getFavorites(): number[] {
    return Array.from(this.favorites);
  }

  /**
   * Save favorites to local storage
   */
  private saveFavorites(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('creature-favorites', JSON.stringify(Array.from(this.favorites)));
    }
  }

  /**
   * Load favorites from local storage
   */
  private loadFavorites(): void {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('creature-favorites');
      if (saved) {
        this.favorites = new Set(JSON.parse(saved));
      }
    }
  }
}

// Singleton
let browserManager: CreatureBrowserManager | null = null;

export function getCreatureBrowser(): CreatureBrowserManager {
  if (!browserManager) {
    browserManager = new CreatureBrowserManager();
  }
  return browserManager;
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. UI Components Needed:
 *    - CreatureBrowserPanel: Sidebar with search and results
 *    - TemplateLibrary: Grid of spawn templates
 *    - FavoritesPanel: Quick access to favorite NPCs
 *    - CreatureCard: Visual card with preview image
 *
 * 2. Drag and Drop:
 *    - Use HTML5 Drag & Drop API
 *    - Show ghost image while dragging
 *    - Drop onto 2D map or 3D viewport
 *    - Auto-detect height at drop location
 *
 * 3. Model Preview (Optional):
 *    - Load .m2 model files from client data
 *    - Render preview in Three.js
 *    - Show animations (idle, walk, attack)
 *
 * 4. Search Features:
 *    - Fuzzy search by name
 *    - Filter by type, level, faction
 *    - Search by NPC flags (vendor, quest giver, etc.)
 *    - Recent searches history
 *
 * 5. Template System:
 *    - Import/export custom templates as JSON
 *    - Share templates with team
 *    - Template categories (guards, vendors, enemies, etc.)
 */
