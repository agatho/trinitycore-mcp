'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  FastForward,
  Rewind,
  BarChart3,
  Clock,
  Trash2,
  Download,
  RefreshCw,
  CircleDot,
  AlertTriangle,
  CheckCircle,
  Zap,
  Target,
  Heart,
  Swords,
  Map,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ArrowLeftRight,
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReplaySession {
  id: string;
  name: string;
  startTime: number;
  eventCount: number;
  durationMs: number;
  tags?: string[];
}

interface SessionAnalysis {
  sessionId: string;
  sessionName: string;
  durationSeconds: number;
  eventStats: {
    total: number;
    byType: Record<string, number>;
    eventsPerMinute: number;
  };
  combat: {
    encounters: number;
    totalCombatTime: number;
    avgEncounterDuration: number;
    deaths: number;
    deathsPerHour: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalHealingDone: number;
    dps: number;
    hps: number;
    dtps: number;
    spellsCast: number;
    uniqueSpellsCast: number;
    topSpells: Array<{ spellId: number; spellName: string; count: number; totalDamage: number }>;
  };
  movement: {
    totalDistance: number;
    avgSpeed: number;
    timeStationary: number;
    timeMoving: number;
    idlePercentage: number;
  };
  aiDecisions: {
    totalDecisions: number;
    decisionsPerMinute: number;
    stateChanges: number;
    uniqueStates: string[];
    targetChanges: number;
    errorCount: number;
  };
  quests: {
    accepted: number;
    completed: number;
    completionRate: number;
  };
  patterns: Array<{
    type: string;
    description: string;
    severity: string;
    count: number;
  }>;
  suggestions: Array<{
    category: string;
    priority: string;
    suggestion: string;
    expectedImprovement: string;
  }>;
  efficiencyScore: number;
}

interface RecordingStatus {
  isRecording: boolean;
  sessionId: string | null;
  name: string | null;
  duration: number;
  eventCount: number;
}

interface PlaybackStatus {
  state: 'stopped' | 'playing' | 'paused';
  position: number;
  duration: number;
}

interface SessionComparison {
  sessionA: { id: string; name: string };
  sessionB: { id: string; name: string };
  deltas: Record<string, { a: number; b: number; change: number; percentChange: number }>;
  improvements: string[];
  regressions: string[];
  verdict: 'improved' | 'regressed' | 'mixed' | 'unchanged';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReplaySessionsPage() {
  // State management
  const [sessions, setSessions] = useState<ReplaySession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [comparison, setComparison] = useState<SessionComparison | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>({
    isRecording: false,
    sessionId: null,
    name: null,
    duration: 0,
    eventCount: 0,
  });
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>({
    state: 'stopped',
    position: 0,
    duration: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'analysis' | 'compare'>('sessions');
  const [recordingName, setRecordingName] = useState('');
  const [compareSessionA, setCompareSessionA] = useState<string>('');
  const [compareSessionB, setCompareSessionB] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Fetch sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // ========================================================================
  // API CALLS
  // ========================================================================

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/replay?action=list-sessions');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setSessions(data.sessions || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/replay?action=analyze&sessionId=${sessionId}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
      setSelectedSession(sessionId);
      setActiveTab('analysis');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!recordingName.trim()) return;
    try {
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-recording', name: recordingName }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setRecordingStatus({
        isRecording: true,
        sessionId: data.sessionId,
        name: recordingName,
        duration: 0,
        eventCount: 0,
      });
      setRecordingName('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [recordingName]);

  const stopRecording = useCallback(async () => {
    try {
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop-recording' }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setRecordingStatus({
        isRecording: false,
        sessionId: null,
        name: null,
        duration: 0,
        eventCount: 0,
      });
      loadSessions();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [loadSessions]);

  const startPlayback = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-playback', sessionId, speed: playbackSpeed }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setPlaybackStatus({ state: 'playing', position: 0, duration: data.duration || 0 });
    } catch (err) {
      setError((err as Error).message);
    }
  }, [playbackSpeed]);

  const controlPlayback = useCallback(async (command: string) => {
    try {
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'playback-control', command }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setPlaybackStatus((prev) => ({ ...prev, state: data.state }));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-session', sessionId }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      loadSessions();
      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setAnalysis(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [loadSessions, selectedSession]);

  const compareSessions = useCallback(async () => {
    if (!compareSessionA || !compareSessionB) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'compare-sessions',
          sessionIdA: compareSessionA,
          sessionIdB: compareSessionB,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setComparison(data);
      setActiveTab('compare');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [compareSessionA, compareSessionB]);

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 60) return `${min}m ${sec}s`;
    const hr = Math.floor(min / 60);
    const remainMin = min % 60;
    return `${hr}h ${remainMin}m`;
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  }

  function getSeverityColor(severity: string): string {
    if (severity === 'error' || severity === 'critical') return 'text-red-400 bg-red-400/10';
    if (severity === 'warning') return 'text-yellow-400 bg-yellow-400/10';
    return 'text-blue-400 bg-blue-400/10';
  }

  function getPriorityColor(priority: string): string {
    if (priority === 'high') return 'text-red-400 border-red-400/30';
    if (priority === 'medium') return 'text-yellow-400 border-yellow-400/30';
    return 'text-blue-400 border-blue-400/30';
  }

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Play className="w-8 h-8 text-purple-400" />
              Bot Session Replay System
            </h1>
            <p className="text-slate-400 mt-1">
              Record, replay, and analyze bot sessions for debugging and optimization
            </p>
          </div>
          <div className="flex items-center gap-3">
            {recordingStatus.isRecording && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2">
                <CircleDot className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="text-red-400 text-sm font-medium">
                  Recording: {recordingStatus.name} ({recordingStatus.eventCount} events)
                </span>
                <button
                  onClick={stopRecording}
                  className="ml-2 bg-red-500/30 hover:bg-red-500/50 text-red-300 rounded px-2 py-1 text-xs"
                >
                  Stop
                </button>
              </div>
            )}
            <button
              onClick={loadSessions}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {(['sessions', 'analysis', 'compare'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab === 'sessions' && 'Sessions'}
              {tab === 'analysis' && 'Analysis'}
              {tab === 'compare' && 'Compare'}
            </button>
          ))}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin mr-3" />
            <span className="text-slate-400">Loading...</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* SESSIONS TAB */}
        {/* ================================================================ */}
        {activeTab === 'sessions' && !loading && (
          <div className="space-y-6">
            {/* Recording Controls */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CircleDot className="w-5 h-5 text-red-400" />
                New Recording
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                  placeholder="Session name (e.g., 'RFC Dungeon Run')"
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  disabled={recordingStatus.isRecording}
                />
                <button
                  onClick={startRecording}
                  disabled={recordingStatus.isRecording || !recordingName.trim()}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CircleDot className="w-4 h-4" />
                  Start Recording
                </button>
              </div>
            </div>

            {/* Session List */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Recorded Sessions ({sessions.length})
              </h2>
              {sessions.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No recorded sessions yet. Start a recording to begin.</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        selectedSession === session.id
                          ? 'bg-purple-500/10 border-purple-500/30'
                          : 'bg-slate-700/30 border-slate-600/50 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white font-medium">{session.name}</h3>
                          <div className="flex gap-4 mt-1 text-sm text-slate-400">
                            <span>{formatDate(session.startTime)}</span>
                            <span>{session.eventCount.toLocaleString()} events</span>
                            {session.durationMs > 0 && <span>{formatDuration(session.durationMs)}</span>}
                          </div>
                          {session.tags && session.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {session.tags.map((tag) => (
                                <span key={tag} className="text-xs bg-slate-600/50 text-slate-300 rounded px-2 py-0.5">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startPlayback(session.id)}
                            className="flex items-center gap-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            Play
                          </button>
                          <button
                            onClick={() => analyzeSession(session.id)}
                            className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <BarChart3 className="w-3 h-3" />
                            Analyze
                          </button>
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg px-3 py-1.5 text-xs transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Playback Controls */}
            {playbackStatus.state !== 'stopped' && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-green-400" />
                  Playback Controls
                </h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => controlPlayback(playbackStatus.state === 'playing' ? 'pause' : 'resume')}
                    className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg p-2 transition-colors"
                  >
                    {playbackStatus.state === 'playing' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => controlPlayback('stop')}
                    className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg p-2 transition-colors"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                  <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                    <div
                      className="bg-purple-500 rounded-full h-2 transition-all"
                      style={{
                        width: playbackStatus.duration > 0
                          ? `${(playbackStatus.position / playbackStatus.duration) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Speed:</span>
                    {[0.5, 1, 2, 4].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-2 py-1 rounded text-xs ${
                          playbackSpeed === speed
                            ? 'bg-purple-500/30 text-purple-300'
                            : 'bg-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* ANALYSIS TAB */}
        {/* ================================================================ */}
        {activeTab === 'analysis' && analysis && !loading && (
          <div className="space-y-6">
            {/* Efficiency Score Header */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{analysis.sessionName}</h2>
                  <p className="text-slate-400 mt-1">
                    Duration: {formatDuration(analysis.durationSeconds * 1000)} | {analysis.eventStats.total.toLocaleString()} events | {analysis.eventStats.eventsPerMinute.toFixed(1)} events/min
                  </p>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreColor(analysis.efficiencyScore)}`}>
                    {analysis.efficiencyScore}
                  </div>
                  <div className="text-sm text-slate-400">Efficiency Score</div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Combat Card */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-400" /> Combat
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">DPS</span>
                    <span className="text-white font-medium">{analysis.combat.dps.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">HPS</span>
                    <span className="text-white font-medium">{analysis.combat.hps.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Encounters</span>
                    <span className="text-white font-medium">{analysis.combat.encounters}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Deaths</span>
                    <span className={`font-medium ${analysis.combat.deaths > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {analysis.combat.deaths} ({analysis.combat.deathsPerHour.toFixed(1)}/hr)
                    </span>
                  </div>
                </div>
              </div>

              {/* Movement Card */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Map className="w-4 h-4 text-blue-400" /> Movement
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Distance</span>
                    <span className="text-white font-medium">{analysis.movement.totalDistance.toFixed(0)} yds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Avg Speed</span>
                    <span className="text-white font-medium">{analysis.movement.avgSpeed.toFixed(1)} yds/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Idle %</span>
                    <span className={`font-medium ${analysis.movement.idlePercentage > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {analysis.movement.idlePercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Card */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" /> AI Decisions
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Decisions/min</span>
                    <span className="text-white font-medium">{analysis.aiDecisions.decisionsPerMinute.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">State Changes</span>
                    <span className="text-white font-medium">{analysis.aiDecisions.stateChanges}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Errors</span>
                    <span className={`font-medium ${analysis.aiDecisions.errorCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {analysis.aiDecisions.errorCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quests Card */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-yellow-400" /> Quests
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Accepted</span>
                    <span className="text-white font-medium">{analysis.quests.accepted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Completed</span>
                    <span className="text-white font-medium">{analysis.quests.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Completion Rate</span>
                    <span className={`font-medium ${analysis.quests.completionRate >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {analysis.quests.completionRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Spells */}
            {analysis.combat.topSpells.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" /> Top Spells
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.combat.topSpells.map((spell, idx) => (
                    <div key={spell.spellId} className="flex items-center gap-3 bg-slate-700/30 rounded-lg p-3">
                      <span className="text-lg font-bold text-slate-500 w-6">#{idx + 1}</span>
                      <div className="flex-1">
                        <div className="text-white font-medium">{spell.spellName}</div>
                        <div className="text-sm text-slate-400">
                          ID: {spell.spellId} | {spell.count} casts | {spell.totalDamage.toLocaleString()} damage
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">
                          {(spell.totalDamage / analysis.combat.totalDamageDealt * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event Type Distribution */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" /> Event Distribution
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Object.entries(analysis.eventStats.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="bg-slate-700/30 rounded-lg p-3 text-center">
                      <div className="text-white font-semibold">{count.toLocaleString()}</div>
                      <div className="text-xs text-slate-400 mt-1">{type.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Patterns & Suggestions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Patterns */}
              {analysis.patterns.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" /> Detected Patterns
                  </h3>
                  <div className="space-y-3">
                    {analysis.patterns.map((pattern, idx) => (
                      <div key={idx} className={`rounded-lg p-3 ${getSeverityColor(pattern.severity)}`}>
                        <div className="font-medium text-sm">{pattern.description}</div>
                        <div className="text-xs mt-1 opacity-75">
                          {pattern.type.replace(/_/g, ' ')} | {pattern.count} occurrences
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" /> Optimization Suggestions
                  </h3>
                  <div className="space-y-3">
                    {analysis.suggestions
                      .sort((a, b) => {
                        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
                        return order[a.priority] - order[b.priority];
                      })
                      .map((suggestion, idx) => (
                        <div key={idx} className={`border rounded-lg p-3 ${getPriorityColor(suggestion.priority)}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold uppercase">{suggestion.priority}</span>
                            <span className="text-xs opacity-75">{suggestion.category}</span>
                          </div>
                          <div className="text-sm text-white">{suggestion.suggestion}</div>
                          <div className="text-xs mt-1 opacity-75 italic">{suggestion.expectedImprovement}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && !analysis && !loading && (
          <div className="text-center py-16 text-slate-500">
            Select a session from the Sessions tab and click Analyze to view detailed analysis.
          </div>
        )}

        {/* ================================================================ */}
        {/* COMPARE TAB */}
        {/* ================================================================ */}
        {activeTab === 'compare' && !loading && (
          <div className="space-y-6">
            {/* Comparison Selector */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-purple-400" /> Compare Sessions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Session A (Baseline)</label>
                  <select
                    value={compareSessionA}
                    onChange={(e) => setCompareSessionA(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Select session...</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Session B (Comparison)</label>
                  <select
                    value={compareSessionB}
                    onChange={(e) => setCompareSessionB(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Select session...</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={compareSessions}
                  disabled={!compareSessionA || !compareSessionB || compareSessionA === compareSessionB}
                  className="flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Compare
                </button>
              </div>
            </div>

            {/* Comparison Results */}
            {comparison && (
              <div className="space-y-6">
                {/* Verdict Banner */}
                <div className={`rounded-xl p-6 border ${
                  comparison.verdict === 'improved' ? 'bg-green-500/10 border-green-500/30' :
                  comparison.verdict === 'regressed' ? 'bg-red-500/10 border-red-500/30' :
                  comparison.verdict === 'mixed' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  'bg-slate-700/50 border-slate-600'
                }`}>
                  <div className="flex items-center gap-3">
                    {comparison.verdict === 'improved' && <TrendingUp className="w-8 h-8 text-green-400" />}
                    {comparison.verdict === 'regressed' && <TrendingDown className="w-8 h-8 text-red-400" />}
                    {comparison.verdict === 'mixed' && <Minus className="w-8 h-8 text-yellow-400" />}
                    {comparison.verdict === 'unchanged' && <Minus className="w-8 h-8 text-slate-400" />}
                    <div>
                      <h3 className="text-xl font-bold text-white capitalize">{comparison.verdict}</h3>
                      <p className="text-sm text-slate-400">
                        {comparison.sessionA.name} vs {comparison.sessionB.name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics Table */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Metric Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-slate-400 text-sm">
                          <th className="text-left py-2">Metric</th>
                          <th className="text-right py-2">Session A</th>
                          <th className="text-right py-2">Session B</th>
                          <th className="text-right py-2">Change</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {Object.entries(comparison.deltas).map(([key, delta]) => (
                          <tr key={key} className="border-t border-slate-700/50">
                            <td className="py-2 text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                            <td className="py-2 text-right text-white">{delta.a.toFixed(1)}</td>
                            <td className="py-2 text-right text-white">{delta.b.toFixed(1)}</td>
                            <td className={`py-2 text-right font-medium ${
                              delta.percentChange > 0 ? 'text-green-400' :
                              delta.percentChange < 0 ? 'text-red-400' :
                              'text-slate-400'
                            }`}>
                              {delta.percentChange >= 0 ? '+' : ''}{delta.percentChange.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Improvements and Regressions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {comparison.improvements.length > 0 && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" /> Improvements
                      </h3>
                      <ul className="space-y-2">
                        {comparison.improvements.map((imp, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-green-300 text-sm">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {comparison.regressions.length > 0 && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5" /> Regressions
                      </h3>
                      <ul className="space-y-2">
                        {comparison.regressions.map((reg, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-red-300 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {reg}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!comparison && (
              <div className="text-center py-16 text-slate-500">
                Select two sessions above and click Compare to see performance differences.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
