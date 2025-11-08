/**
 * Keyboard Shortcuts & Command Palette
 *
 * Global keyboard shortcut management with command palette integration.
 * Provides VS Code-like command palette experience.
 *
 * @module keyboard-shortcuts
 */

import { Logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export type KeyModifier = 'ctrl' | 'shift' | 'alt' | 'meta';

export interface ShortcutKey {
  key: string;
  modifiers?: KeyModifier[];
  preventDefault?: boolean;
}

export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: ShortcutKey;
  category: string;
  handler: () => void | Promise<void>;
  enabled?: () => boolean;
}

export interface Command {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  handler: () => void | Promise<void>;
  keywords?: string[];
  enabled?: () => boolean;
}

// ============================================================================
// Keyboard Shortcut Manager
// ============================================================================

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private keyMap: Map<string, string> = new Map(); // key combo -> shortcut ID
  private enabled: boolean = true;

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
    const keyCombo = this.getKeyCombo(shortcut.keys);
    this.keyMap.set(keyCombo, shortcut.id);

    Logger.debug('KeyboardShortcuts', `Registered shortcut: ${shortcut.name}`, {
      id: shortcut.id,
      keys: keyCombo,
    });
  }

  /**
   * Unregister a shortcut
   */
  unregister(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      const keyCombo = this.getKeyCombo(shortcut.keys);
      this.keyMap.delete(keyCombo);
      this.shortcuts.delete(id);
    }
  }

  /**
   * Handle keyboard event
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.enabled) return false;

    const keyCombo = this.getEventKeyCombo(event);
    const shortcutId = this.keyMap.get(keyCombo);

    if (shortcutId) {
      const shortcut = this.shortcuts.get(shortcutId);

      if (shortcut && (!shortcut.enabled || shortcut.enabled())) {
        if (shortcut.keys.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }

        Logger.debug('KeyboardShortcuts', `Executing shortcut: ${shortcut.name}`);

        try {
          const result = shortcut.handler();
          if (result instanceof Promise) {
            result.catch(error => {
              Logger.error('KeyboardShortcuts', error, { shortcut: shortcut.id });
            });
          }
        } catch (error) {
          Logger.error('KeyboardShortcuts', error as Error, { shortcut: shortcut.id });
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Get all shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getByCategory(category: string): KeyboardShortcut[] {
    return this.getShortcuts().filter(s => s.category === category);
  }

  /**
   * Enable/disable all shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get key combo string from ShortcutKey
   */
  private getKeyCombo(keys: ShortcutKey): string {
    const modifiers = (keys.modifiers || []).sort().join('+');
    return modifiers ? `${modifiers}+${keys.key.toLowerCase()}` : keys.key.toLowerCase();
  }

  /**
   * Get key combo from keyboard event
   */
  private getEventKeyCombo(event: KeyboardEvent): string {
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.shiftKey) modifiers.push('shift');
    if (event.altKey) modifiers.push('alt');
    if (event.metaKey) modifiers.push('meta');

    const key = event.key.toLowerCase();
    const sorted = modifiers.sort().join('+');
    return sorted ? `${sorted}+${key}` : key;
  }
}

// ============================================================================
// Command Palette Manager
// ============================================================================

export class CommandPaletteManager {
  private commands: Map<string, Command> = new Map();
  private isOpen: boolean = false;
  private listeners: Set<(isOpen: boolean) => void> = new Set();

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.id, command);
    Logger.debug('CommandPalette', `Registered command: ${command.name}`, {
      id: command.id,
    });
  }

  /**
   * Unregister a command
   */
  unregister(id: string): void {
    this.commands.delete(id);
  }

  /**
   * Search commands
   */
  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.commands.values())
      .filter(cmd => {
        if (cmd.enabled && !cmd.enabled()) return false;

        // Search in name, description, and keywords
        if (cmd.name.toLowerCase().includes(lowerQuery)) return true;
        if (cmd.description?.toLowerCase().includes(lowerQuery)) return true;
        if (cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))) return true;

        return false;
      })
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.name.toLowerCase() === lowerQuery;
        const bExact = b.name.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Then name starts with
        const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Then alphabetical
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Execute command by ID
   */
  async execute(id: string): Promise<void> {
    const command = this.commands.get(id);
    if (!command) {
      Logger.warn('CommandPalette', `Command not found: ${id}`);
      return;
    }

    if (command.enabled && !command.enabled()) {
      Logger.warn('CommandPalette', `Command disabled: ${id}`);
      return;
    }

    Logger.info('CommandPalette', `Executing command: ${command.name}`);

    try {
      await command.handler();
    } catch (error) {
      Logger.error('CommandPalette', error as Error, { command: id });
      throw error;
    }
  }

  /**
   * Toggle command palette
   */
  toggle(): void {
    this.isOpen = !this.isOpen;
    this.notifyListeners();
  }

  /**
   * Open command palette
   */
  open(): void {
    if (!this.isOpen) {
      this.isOpen = true;
      this.notifyListeners();
    }
  }

  /**
   * Close command palette
   */
  close(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.notifyListeners();
    }
  }

  /**
   * Get open state
   */
  getIsOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Subscribe to open state changes
   */
  subscribe(listener: (isOpen: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.isOpen));
  }

  /**
   * Get all commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): Command[] {
    return this.getCommands().filter(c => c.category === category);
  }
}

// ============================================================================
// Global Instances
// ============================================================================

let shortcutManager: KeyboardShortcutManager | null = null;
let commandPalette: CommandPaletteManager | null = null;

export function getShortcutManager(): KeyboardShortcutManager {
  if (!shortcutManager) {
    shortcutManager = new KeyboardShortcutManager();
  }
  return shortcutManager;
}

export function getCommandPalette(): CommandPaletteManager {
  if (!commandPalette) {
    commandPalette = new CommandPaletteManager();
  }
  return commandPalette;
}

// ============================================================================
// React Hook Helper
// ============================================================================

/**
 * Initialize keyboard shortcuts for the app
 * Call this once in your root component
 */
export function initializeKeyboardShortcuts(): () => void {
  const manager = getShortcutManager();

  const handleKeyDown = (event: KeyboardEvent) => {
    manager.handleKeyDown(event);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }

  Logger.info('KeyboardShortcuts', 'Initialized global keyboard shortcuts');

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
    }
  };
}

// ============================================================================
// Default Shortcuts
// ============================================================================

/**
 * Register default application shortcuts
 */
export function registerDefaultShortcuts(): void {
  const shortcuts = getShortcutManager();
  const palette = getCommandPalette();

  // Command Palette
  shortcuts.register({
    id: 'command-palette',
    name: 'Open Command Palette',
    description: 'Open the command palette to search and execute commands',
    category: 'General',
    keys: { key: 'k', modifiers: ['ctrl'] },
    handler: () => palette.toggle(),
  });

  // Navigation
  shortcuts.register({
    id: 'go-home',
    name: 'Go to Home',
    description: 'Navigate to homepage',
    category: 'Navigation',
    keys: { key: 'h', modifiers: ['ctrl', 'shift'] },
    handler: () => {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    },
  });

  // Search
  shortcuts.register({
    id: 'global-search',
    name: 'Global Search',
    description: 'Focus global search input',
    category: 'Search',
    keys: { key: '/', modifiers: ['ctrl'] },
    handler: () => {
      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
      searchInput?.focus();
    },
  });

  // Undo/Redo
  shortcuts.register({
    id: 'undo',
    name: 'Undo',
    description: 'Undo last action',
    category: 'Edit',
    keys: { key: 'z', modifiers: ['ctrl'] },
    handler: () => {
      // Emit custom event for undo
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:undo'));
      }
    },
  });

  shortcuts.register({
    id: 'redo',
    name: 'Redo',
    description: 'Redo last undone action',
    category: 'Edit',
    keys: { key: 'y', modifiers: ['ctrl'] },
    handler: () => {
      // Emit custom event for redo
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:redo'));
      }
    },
  });

  // Save
  shortcuts.register({
    id: 'save',
    name: 'Save',
    description: 'Save current work',
    category: 'File',
    keys: { key: 's', modifiers: ['ctrl'] },
    handler: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:save'));
      }
    },
  });

  Logger.info('KeyboardShortcuts', 'Registered default shortcuts');
}

/**
 * Register default commands
 */
export function registerDefaultCommands(): void {
  const palette = getCommandPalette();

  // General commands
  palette.register({
    id: 'reload-page',
    name: 'Reload Page',
    description: 'Reload the current page',
    category: 'General',
    keywords: ['refresh', 'reload'],
    handler: () => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    },
  });

  palette.register({
    id: 'clear-cache',
    name: 'Clear Cache',
    description: 'Clear all cached data',
    category: 'General',
    keywords: ['cache', 'clear', 'reset'],
    handler: () => {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        Logger.info('CommandPalette', 'Cache cleared');
      }
    },
  });

  palette.register({
    id: 'toggle-theme',
    name: 'Toggle Theme',
    description: 'Switch between light and dark mode',
    category: 'Appearance',
    keywords: ['theme', 'dark', 'light', 'mode'],
    handler: () => {
      if (typeof window !== 'undefined') {
        document.documentElement.classList.toggle('dark');
      }
    },
  });

  Logger.info('CommandPalette', 'Registered default commands');
}
