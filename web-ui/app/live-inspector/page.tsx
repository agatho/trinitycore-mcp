'use client';

import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Users, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnlinePlayer {
  guid: number;
  name: string;
  level: number;
  race: string;
  class: string;
  zone: string;
}

export default function LiveInspectorPage() {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [serverStats, setServerStats] = useState({
    uptime: '2d 14h 32m',
    playersOnline: 0,
    peakPlayers: 150,
    avgLatency: 45,
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setOnlinePlayers([
      { guid: 1, name: 'PlayerOne', level: 80, race: 'Human', class: 'Warrior', zone: 'Stormwind' },
      { guid: 2, name: 'PlayerTwo', level: 70, race: 'Orc', class: 'Shaman', zone: 'Orgrimmar' },
      { guid: 3, name: 'PlayerThree', level: 75, race: 'Night Elf', class: 'Druid', zone: 'Darnassus' },
    ]);

    setServerStats((prev) => ({
      ...prev,
      playersOnline: 3,
    }));

    setLoading(false);
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
                <p className="text-slate-400">Real-time server data monitoring</p>
              </div>
            </div>
            <div className="flex gap-2">
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
