/**
 * Presence Indicator Component
 *
 * Shows active collaborators with their avatars, cursors, and selections.
 * Provides visual feedback for real-time collaborative editing.
 */

'use client';

import React from 'react';
import { useCollaboration, UserPresence } from './CollaborationProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PresenceIndicatorProps {
  showPanel?: boolean;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  showPanel = true,
}) => {
  const {
    currentUser,
    activeUsers,
    syncEnabled,
    setSyncEnabled,
  } = useCollaboration();

  // Get initials from name
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Render cursor for remote users
  const renderCursors = () => {
    if (!syncEnabled) return null;

    return activeUsers
      .filter((user) => user.cursor && user.id !== currentUser?.id)
      .map((user) => (
        <div
          key={user.id}
          className="fixed pointer-events-none z-50 transition-all duration-100"
          style={{
            left: user.cursor!.x,
            top: user.cursor!.y,
            transform: 'translate(-2px, -2px)',
          }}
        >
          {/* Cursor SVG */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
          >
            <path
              d="M5.65376 12.3673L17.6856 0.335449L14.9384 22.4442L11.6049 15.1L5.65376 12.3673Z"
              fill={user.color}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>

          {/* User name label */}
          <div
            className="ml-6 -mt-4 px-2 py-1 rounded-md text-xs font-medium text-white shadow-lg whitespace-nowrap"
            style={{ backgroundColor: user.color }}
          >
            {user.name}
          </div>
        </div>
      ));
  };

  if (!showPanel) {
    return <>{renderCursors()}</>;
  }

  return (
    <>
      {/* Cursors overlay */}
      {renderCursors()}

      {/* Presence panel */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {/* Connection status toggle */}
        <Button
          variant={syncEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSyncEnabled(!syncEnabled)}
          className="gap-2"
        >
          {syncEnabled ? (
            <>
              <Wifi className="h-4 w-4" />
              <span className="hidden sm:inline">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </Button>

        {/* Active users avatars */}
        {syncEnabled && (
          <Card className="shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />

                <div className="flex -space-x-2">
                  {/* Current user */}
                  {currentUser && (
                    <div
                      className="relative"
                      title={`${currentUser.name} (You)`}
                    >
                      <Avatar
                        className="w-8 h-8 border-2 border-white dark:border-gray-800 ring-2"
                        style={{ ringColor: currentUser.color }}
                      >
                        <AvatarFallback
                          className="text-xs font-bold text-white"
                          style={{ backgroundColor: currentUser.color }}
                        >
                          {getInitials(currentUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                        style={{ backgroundColor: currentUser.color }}
                      />
                    </div>
                  )}

                  {/* Other users */}
                  {activeUsers
                    .filter((user) => user.id !== currentUser?.id)
                    .slice(0, 5)
                    .map((user) => (
                      <div
                        key={user.id}
                        className="relative"
                        title={user.name}
                      >
                        <Avatar
                          className="w-8 h-8 border-2 border-white dark:border-gray-800 ring-2"
                          style={{ ringColor: user.color }}
                        >
                          <AvatarFallback
                            className="text-xs font-bold text-white"
                            style={{ backgroundColor: user.color }}
                          >
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                          style={{ backgroundColor: user.color }}
                        />
                      </div>
                    ))}

                  {/* More users indicator */}
                  {activeUsers.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                        +{activeUsers.length - 5}
                      </span>
                    </div>
                  )}
                </div>

                {/* User count badge */}
                <Badge variant="secondary" className="ml-1">
                  {activeUsers.length + (currentUser ? 1 : 0)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed presence panel (optional, can be toggled) */}
      {syncEnabled && activeUsers.length > 0 && (
        <div className="absolute bottom-4 right-4 z-40 max-w-xs">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Collaborators
              </CardTitle>
              <CardDescription className="text-xs">
                {activeUsers.length + (currentUser ? 1 : 0)} user(s) online
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Current user */}
              {currentUser && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Avatar className="w-6 h-6 ring-2" style={{ ringColor: currentUser.color }}>
                    <AvatarFallback
                      className="text-xs font-bold text-white"
                      style={{ backgroundColor: currentUser.color }}
                    >
                      {getInitials(currentUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{currentUser.name}</p>
                    <p className="text-xs text-gray-500">You</p>
                  </div>
                  {currentUser.selectedNodes && currentUser.selectedNodes.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {currentUser.selectedNodes.length} selected
                    </Badge>
                  )}
                </div>
              )}

              {/* Other users */}
              {activeUsers
                .filter((user) => user.id !== currentUser?.id)
                .map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <Avatar className="w-6 h-6 ring-2" style={{ ringColor: user.color }}>
                      <AvatarFallback
                        className="text-xs font-bold text-white"
                        style={{ backgroundColor: user.color }}
                      >
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-gray-500">
                        {Math.round((Date.now() - user.lastActive) / 1000)}s ago
                      </p>
                    </div>
                    {user.selectedNodes && user.selectedNodes.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {user.selectedNodes.length} selected
                      </Badge>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default PresenceIndicator;
