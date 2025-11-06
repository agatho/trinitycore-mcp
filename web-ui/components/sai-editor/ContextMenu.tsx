/**
 * Context Menu Component for SAI Editor
 *
 * Provides right-click context menus for nodes, edges, and canvas.
 * n8n-inspired professional UI with icons and keyboard shortcuts.
 */

'use client';

import React, { useEffect } from 'react';
import {
  Copy,
  Trash2,
  Edit,
  Link2,
  Unlink,
  Settings,
  Plus,
  Scissors,
  FileCode,
  Layers,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
  shortcut?: string;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  // Close on click outside or escape
  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would go off-screen
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      // Adjust X if menu goes off right edge
      if (x + menuRect.width > viewportWidth) {
        newX = viewportWidth - menuRect.width - 10;
      }

      // Adjust Y if menu goes off bottom edge
      if (y + menuRect.height > viewportHeight) {
        newY = viewportHeight - menuRect.height - 10;
      }

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-2 min-w-[220px] animate-in fade-in duration-100"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {item.separator ? (
            <div className="my-1 border-t border-slate-700" />
          ) : (
            <button
              className={`
                w-full px-4 py-2.5 text-left flex items-center gap-3
                transition-colors text-sm font-medium
                ${item.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-slate-700'
                }
                ${item.variant === 'danger'
                  ? 'text-red-400 hover:bg-red-900/20'
                  : 'text-white'
                }
              `}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
            >
              {item.icon && (
                <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
              )}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-slate-400 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded">
                  {item.shortcut}
                </span>
              )}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default ContextMenu;
