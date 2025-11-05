'use client';

import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Users, Server, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnlinePlayer {
  guid: number;
  name: string;
  level: number;
  race: string;
  class: string;
  zone: string;
}

interface ServerStats {
  uptime: string;
  playersOnline: number;
  peakPlayers: number;
  avgLatency: number;
}

export default function LiveInspectorPage() {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [serverStats, setServerStats] = useState<ServerStats>({
    uptime: 'Loading...',
    playersOnline: 0,
    peakPlayers: 0,
    avgLatency: 0,
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch data from TrinityCore SOAP API via our backend
      const [playersResponse, statusResponse] = await Promise.all([
        fetch('/api/soap?action=players'),
        fetch('/api/soap?action=status'),
      ]);

      if (!playersResponse.ok || !statusResponse.ok) {
        throw new Error('Failed to fetch data from SOAP API');
      }

      const playersData = await playersResponse.json();
      const statusData = await statusResponse.json();

      if (playersData.error || statusData.error) {
        throw new Error(playersData.error || statusData.error);
      }

      setOnlinePlayers(playersData.players || []);
      setServerStats(statusData.status || {
        uptime: 'Unknown',
        playersOnline: 0,
        peakPlayers: 0,
        avgLatency: 0,
      });

      setConnectionStatus('connected');
    } catch (err: any) {
      console.error('SOAP API Error:', err);
      setError(err.message || 'Failed to connect to TrinityCore SOAP API');
      setConnectionStatus('disconnected');

      // Fallback to mock data in development
      if (process.env.NODE_ENV === 'development') {
        setOnlinePlayers([
          { guid: 1, name: 'PlayerOne', level: 80, race: 'Human', class: 'Warrior', zone: 'Stormwind' },
          { guid: 2, name: 'PlayerTwo', level: 70, race: 'Orc', class: 'Shaman', zone: 'Orgrimmar' },
          { guid: 3, name: 'PlayerThree', level: 75, race: 'Night Elf', class: 'Druid', zone: 'Darnassus' },
        ]);
        setServerStats({
          uptime: '2d 14h 32m',
          playersOnline: 3,
          peakPlayers: 150,
          avgLatency: 45,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-emerald-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Live Data Inspector</h1>
                <p className="text-slate-400">Real-time server data via TrinityCore SOAP API</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection status indicator */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-green-400 animate-pulse'
                      : connectionStatus === 'disconnected'
                      ? 'bg-red-400'
                      : 'bg-yellow-400 animate-pulse'
                  }`}
                />
                <span className="text-xs text-slate-300">
                  {connectionStatus === 'connected'
                    ? 'Connected'
                    : connectionStatus === 'disconnected'
                    ? 'Disconnected'
                    : 'Checking...'}
                </span>
              </div>
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto-Refresh
              </Button>
              <Button onClick={loadData} disabled={loading}>
                Refresh Now
              </Button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-400">SOAP API Connection Error</div>
                <div className="text-sm text-red-300/80 mt-1">{error}</div>
                <div className="text-xs text-red-300/60 mt-2">
                  Ensure TrinityCore worldserver SOAP is enabled in worldserver.conf:
                  <br />
                  SOAP.Enabled = 1, SOAP.IP = "127.0.0.1", SOAP.Port = 7878
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Server Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-400">Server Uptime</div>
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{serverStats.uptime}</div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-400">Players Online</div>
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {serverStats.playersOnline} / {serverStats.peakPlayers}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-400">Peak Players</div>
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{serverStats.peakPlayers}</div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-400">Avg Latency</div>
              <Activity className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white">{serverStats.avgLatency}ms</div>
          </div>
        </div>

        {/* Online Players */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">
              Online Players ({onlinePlayers.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">GUID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Race</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {onlinePlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No players online
                    </td>
                  </tr>
                ) : (
                  onlinePlayers.map((player) => (
                    <tr key={player.guid} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm text-slate-300">{player.guid}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">{player.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{player.level}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{player.race}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{player.class}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{player.zone}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
