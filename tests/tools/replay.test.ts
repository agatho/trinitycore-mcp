/**
 * Bot Session Replay System - Unit Tests
 *
 * Tests for session analysis, pattern detection, comparison, and markdown export.
 * Pure functions are tested directly without mocks. Recording/playback tests
 * mock the SessionRecorder/SessionPlayer from the SOAP module.
 *
 * @module tests/tools/replay
 */

import {
  analyzeSession,
  compareSessions,
  exportAnalysisMarkdown,
  exportComparisonMarkdown,
  getRecordingStatus,
  controlPlayback,
  SessionAnalysis,
  SessionComparison,
} from '../../src/tools/replay';
import type { RecordingSession } from '../../src/soap/session-recorder';
import type { SOAPEvent } from '../../src/soap/websocket-server';

// Mock the session-recorder module (file system operations)
jest.mock('../../src/soap/session-recorder', () => {
  const actual = jest.requireActual('../../src/soap/session-recorder');
  return {
    ...actual,
    // Keep pure functions (mergeSessions, extractSlice) but mock class constructors
    SessionRecorder: jest.fn().mockImplementation(() => ({
      isRecordingActive: jest.fn().mockReturnValue(false),
      getCurrentSession: jest.fn().mockReturnValue(null),
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      recordEvent: jest.fn(),
      loadSession: jest.fn(),
      listSessions: jest.fn().mockResolvedValue([]),
      deleteSession: jest.fn(),
    })),
    SessionPlayer: jest.fn().mockImplementation(() => ({
      getState: jest.fn().mockReturnValue('stopped'),
      getPosition: jest.fn().mockReturnValue(0),
      getDuration: jest.fn().mockReturnValue(0),
      loadSession: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      stop: jest.fn(),
      seek: jest.fn(),
      setSpeed: jest.fn(),
    })),
  };
});

// ============================================================================
// TEST DATA HELPERS
// ============================================================================

function createSOAPEvent(overrides: Partial<SOAPEvent> = {}): SOAPEvent {
  return {
    type: 'spell_cast',
    timestamp: Date.now(),
    data: {},
    ...overrides,
  };
}

function createSession(overrides: Partial<RecordingSession> = {}): RecordingSession {
  const now = Date.now();
  return {
    id: `rec_test_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Session',
    startTime: now - 300000, // 5 minutes ago
    endTime: now,
    duration: 300000, // 5 minutes
    events: [],
    metadata: {
      serverIds: [],
      eventTypes: [],
      eventCount: 0,
      description: 'Test session',
    },
    ...overrides,
  };
}

function createCombatSession(): RecordingSession {
  const start = 1000000;
  const events: SOAPEvent[] = [
    // 5 combat encounters
    { type: 'combat_start', timestamp: start + 10000, data: {} },
    { type: 'spell_cast', timestamp: start + 11000, data: { spellId: 78, spellName: 'Heroic Strike' } },
    { type: 'damage_dealt', timestamp: start + 12000, data: { amount: 500, spellId: 78, spellName: 'Heroic Strike' } },
    { type: 'damage_dealt', timestamp: start + 13000, data: { amount: 300, spellId: 78, spellName: 'Heroic Strike' } },
    { type: 'damage_taken', timestamp: start + 14000, data: { amount: 200 } },
    { type: 'healing_done', timestamp: start + 15000, data: { amount: 150 } },
    { type: 'combat_end', timestamp: start + 20000, data: {} },

    { type: 'movement', timestamp: start + 25000, data: { position: { x: 100, y: 200, z: 0 } } },
    { type: 'movement', timestamp: start + 30000, data: { position: { x: 110, y: 210, z: 0 } } },

    { type: 'combat_start', timestamp: start + 35000, data: {} },
    { type: 'spell_cast', timestamp: start + 36000, data: { spellId: 6343, spellName: 'Thunder Clap' } },
    { type: 'damage_dealt', timestamp: start + 37000, data: { amount: 700, spellId: 6343, spellName: 'Thunder Clap' } },
    { type: 'damage_taken', timestamp: start + 38000, data: { amount: 400 } },
    { type: 'combat_end', timestamp: start + 45000, data: {} },

    { type: 'ai_decision', timestamp: start + 50000, data: {} },
    { type: 'state_change', timestamp: start + 51000, data: { newState: 'idle' } },
    { type: 'target_change', timestamp: start + 52000, data: {} },
    { type: 'quest_accept', timestamp: start + 55000, data: {} },
    { type: 'quest_complete', timestamp: start + 60000, data: {} },
    { type: 'quest_accept', timestamp: start + 65000, data: {} },

    { type: 'death', timestamp: start + 70000, data: {} },
  ];

  return createSession({
    id: 'rec_combat_test',
    name: 'Combat Test Session',
    startTime: start,
    endTime: start + 80000,
    duration: 80000, // 80 seconds
    events,
    metadata: {
      serverIds: [],
      eventTypes: [...new Set(events.map(e => e.type))],
      eventCount: events.length,
    },
  });
}

// ============================================================================
// SESSION ANALYSIS TESTS
// ============================================================================

describe('analyzeSession', () => {
  it('should return basic statistics for empty session', () => {
    const session = createSession({ events: [], duration: 60000 });
    const analysis = analyzeSession(session);

    expect(analysis.sessionId).toBe(session.id);
    expect(analysis.sessionName).toBe(session.name);
    expect(analysis.durationSeconds).toBeCloseTo(60);
    expect(analysis.eventStats.total).toBe(0);
    expect(analysis.efficiencyScore).toBeGreaterThanOrEqual(0);
    expect(analysis.efficiencyScore).toBeLessThanOrEqual(100);
  });

  it('should count events by type', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.eventStats.total).toBe(session.events.length);
    expect(analysis.eventStats.byType['combat_start']).toBe(2);
    expect(analysis.eventStats.byType['combat_end']).toBe(2);
    expect(analysis.eventStats.byType['damage_dealt']).toBe(3);
    expect(analysis.eventStats.byType['death']).toBe(1);
  });

  it('should calculate events per minute', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    const expectedEventsPerMin = session.events.length / (80000 / 60000);
    expect(analysis.eventStats.eventsPerMinute).toBeCloseTo(expectedEventsPerMin, 1);
  });

  it('should count combat encounters', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.combat.encounters).toBe(2);
  });

  it('should calculate total damage dealt', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.combat.totalDamageDealt).toBe(500 + 300 + 700);
  });

  it('should calculate total damage taken', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.combat.totalDamageTaken).toBe(200 + 400);
  });

  it('should calculate total healing done', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.combat.totalHealingDone).toBe(150);
  });

  it('should count deaths', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.combat.deaths).toBe(1);
  });

  it('should track top spells by damage', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.combat.topSpells.length).toBeGreaterThan(0);
    // Heroic Strike should be top (500 + 300 = 800)
    const heroicStrike = analysis.combat.topSpells.find(s => s.spellId === 78);
    expect(heroicStrike).toBeDefined();
    expect(heroicStrike!.totalDamage).toBe(800);
    expect(heroicStrike!.count).toBe(2);
  });

  it('should count spell casts', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.combat.spellsCast).toBe(2);
    expect(analysis.combat.uniqueSpellsCast).toBe(2); // Heroic Strike + Thunder Clap
  });

  it('should calculate DPS from combat time', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    // Combat time: (20000-10000) + (45000-35000) = 10000 + 10000 = 20000ms = 20s
    // Total damage: 1500
    // DPS: 1500/20 = 75
    expect(analysis.combat.dps).toBeCloseTo(75, 0);
  });

  it('should count AI decisions', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.aiDecisions.totalDecisions).toBe(1);
    expect(analysis.aiDecisions.stateChanges).toBe(1);
    expect(analysis.aiDecisions.targetChanges).toBe(1);
  });

  it('should track unique states', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.aiDecisions.uniqueStates).toContain('idle');
  });

  it('should count quests', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.quests.accepted).toBe(2);
    expect(analysis.quests.completed).toBe(1);
    expect(analysis.quests.completionRate).toBe(50);
  });

  it('should calculate movement distance', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    // Movement: (100,200,0) -> (110,210,0) = sqrt(100+100) = ~14.14
    expect(analysis.movement.totalDistance).toBeCloseTo(14.14, 1);
  });

  it('should handle session with no duration gracefully', () => {
    const session = createSession({ events: [], duration: 0 });
    const analysis = analyzeSession(session);

    expect(analysis.eventStats.eventsPerMinute).toBe(0);
    expect(analysis.combat.dps).toBe(0);
  });

  it('should calculate efficiency score between 0 and 100', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis.efficiencyScore).toBeGreaterThanOrEqual(0);
    expect(analysis.efficiencyScore).toBeLessThanOrEqual(100);
  });

  it('should return proper SessionAnalysis interface', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);

    expect(analysis).toHaveProperty('sessionId');
    expect(analysis).toHaveProperty('sessionName');
    expect(analysis).toHaveProperty('durationSeconds');
    expect(analysis).toHaveProperty('eventStats');
    expect(analysis).toHaveProperty('combat');
    expect(analysis).toHaveProperty('movement');
    expect(analysis).toHaveProperty('aiDecisions');
    expect(analysis).toHaveProperty('quests');
    expect(analysis).toHaveProperty('patterns');
    expect(analysis).toHaveProperty('suggestions');
    expect(analysis).toHaveProperty('efficiencyScore');
  });
});

// ============================================================================
// PATTERN DETECTION TESTS
// ============================================================================

describe('analyzeSession - pattern detection', () => {
  it('should detect death patterns when 3+ deaths', () => {
    const start = 1000000;
    const events: SOAPEvent[] = [
      { type: 'death', timestamp: start + 10000, data: {} },
      { type: 'death', timestamp: start + 20000, data: {} },
      { type: 'death', timestamp: start + 30000, data: {} },
    ];

    const session = createSession({ events, duration: 60000 });
    const analysis = analyzeSession(session);

    const deathPattern = analysis.patterns.find(p => p.type === 'death_pattern');
    expect(deathPattern).toBeDefined();
    expect(deathPattern!.count).toBe(3);
  });

  it('should detect idle periods over 30 seconds', () => {
    const start = 1000000;
    const events: SOAPEvent[] = [
      { type: 'spell_cast', timestamp: start + 1000, data: {} },
      // 40 second gap
      { type: 'spell_cast', timestamp: start + 41000, data: {} },
      // 35 second gap
      { type: 'spell_cast', timestamp: start + 76000, data: {} },
    ];

    const session = createSession({ events, duration: 80000 });
    const analysis = analyzeSession(session);

    const idlePattern = analysis.patterns.find(p => p.type === 'idle_time');
    expect(idlePattern).toBeDefined();
    expect(idlePattern!.count).toBe(2);
  });

  it('should detect spell cast failures', () => {
    const start = 1000000;
    const events: SOAPEvent[] = Array.from({ length: 15 }, (_, i) => ({
      type: 'spell_failed',
      timestamp: start + i * 1000,
      data: {},
    }));

    const session = createSession({ events, duration: 20000 });
    const analysis = analyzeSession(session);

    const failurePattern = analysis.patterns.find(p => p.type === 'inefficiency' && p.description.includes('spell cast failures'));
    expect(failurePattern).toBeDefined();
    expect(failurePattern!.count).toBe(15);
  });

  it('should not detect patterns in clean sessions', () => {
    const start = 1000000;
    const events: SOAPEvent[] = [
      { type: 'combat_start', timestamp: start + 1000, data: {} },
      { type: 'spell_cast', timestamp: start + 2000, data: {} },
      { type: 'damage_dealt', timestamp: start + 3000, data: { amount: 100 } },
      { type: 'combat_end', timestamp: start + 10000, data: {} },
    ];

    const session = createSession({ events, duration: 15000 });
    const analysis = analyzeSession(session);

    expect(analysis.patterns.length).toBe(0);
  });
});

// ============================================================================
// SUGGESTION GENERATION TESTS
// ============================================================================

describe('analyzeSession - suggestions', () => {
  it('should suggest survival improvements for high death rate', () => {
    const start = 1000000;
    const events: SOAPEvent[] = [
      { type: 'combat_start', timestamp: start + 1000, data: {} },
      { type: 'combat_end', timestamp: start + 5000, data: {} },
      { type: 'death', timestamp: start + 10000, data: {} },
      { type: 'death', timestamp: start + 20000, data: {} },
      { type: 'death', timestamp: start + 30000, data: {} },
      { type: 'death', timestamp: start + 40000, data: {} },
    ];

    // 4 deaths in ~50 seconds = very high rate
    const session = createSession({ events, duration: 50000, startTime: start, endTime: start + 50000 });
    const analysis = analyzeSession(session);

    const survivalSuggestion = analysis.suggestions.find(s => s.category === 'survival');
    expect(survivalSuggestion).toBeDefined();
    expect(survivalSuggestion!.priority).toBe('high');
  });

  it('should suggest movement improvements for high idle %', () => {
    const start = 1000000;
    const events: SOAPEvent[] = [
      { type: 'movement', timestamp: start + 1000, data: { position: { x: 0, y: 0, z: 0 } } },
      // Long stationary period
      { type: 'movement', timestamp: start + 100000, data: { position: { x: 0, y: 0, z: 0 } } },
    ];

    const session = createSession({ events, duration: 120000 });
    const analysis = analyzeSession(session);

    // Idle percentage should be high since position didn't change
    if (analysis.movement.idlePercentage > 30) {
      const movementSuggestion = analysis.suggestions.find(s => s.category === 'movement');
      expect(movementSuggestion).toBeDefined();
    }
  });

  it('should suggest AI fixes for high error count', () => {
    const start = 1000000;
    const events: SOAPEvent[] = Array.from({ length: 15 }, (_, i) => ({
      type: 'error' as const,
      timestamp: start + i * 5000,
      data: {},
    }));

    const session = createSession({ events, duration: 80000 });
    const analysis = analyzeSession(session);

    const aiSuggestion = analysis.suggestions.find(s => s.category === 'ai');
    expect(aiSuggestion).toBeDefined();
    expect(aiSuggestion!.priority).toBe('high');
  });
});

// ============================================================================
// SESSION COMPARISON TESTS
// ============================================================================

describe('compareSessions', () => {
  function createAnalysis(overrides: Partial<SessionAnalysis> = {}): SessionAnalysis {
    return {
      sessionId: 'test_a',
      sessionName: 'Session A',
      durationSeconds: 300,
      eventStats: { total: 100, byType: {}, eventsPerMinute: 20 },
      combat: {
        encounters: 10,
        totalCombatTime: 200000,
        avgEncounterDuration: 20000,
        deaths: 2,
        deathsPerHour: 4,
        totalDamageDealt: 50000,
        totalDamageTaken: 20000,
        totalHealingDone: 15000,
        dps: 100,
        hps: 50,
        dtps: 40,
        spellsCast: 200,
        uniqueSpellsCast: 10,
        topSpells: [],
      },
      movement: {
        totalDistance: 5000,
        avgSpeed: 3.0,
        timeStationary: 50000,
        timeMoving: 250000,
        idlePercentage: 16.7,
      },
      aiDecisions: {
        totalDecisions: 50,
        decisionsPerMinute: 10,
        stateChanges: 20,
        uniqueStates: ['idle', 'combat'],
        targetChanges: 30,
        errorCount: 2,
      },
      quests: {
        accepted: 5,
        completed: 4,
        completionRate: 80,
      },
      patterns: [],
      suggestions: [],
      efficiencyScore: 70,
      ...overrides,
    };
  }

  it('should detect improvements', () => {
    const analysisA = createAnalysis({ sessionId: 'a', sessionName: 'Before' });
    const analysisB = createAnalysis({
      sessionId: 'b',
      sessionName: 'After',
      combat: { ...analysisA.combat, dps: 150, deathsPerHour: 1 },
      efficiencyScore: 85,
    });

    const comparison = compareSessions(analysisA, analysisB);

    expect(comparison.verdict).toBe('improved');
    expect(comparison.improvements.length).toBeGreaterThan(0);
    expect(comparison.regressions.length).toBe(0);
  });

  it('should detect regressions', () => {
    const analysisA = createAnalysis({ sessionId: 'a', sessionName: 'Before' });
    const analysisB = createAnalysis({
      sessionId: 'b',
      sessionName: 'After',
      combat: { ...analysisA.combat, dps: 50, deathsPerHour: 8 },
      efficiencyScore: 40,
    });

    const comparison = compareSessions(analysisA, analysisB);

    expect(comparison.verdict).toBe('regressed');
    expect(comparison.regressions.length).toBeGreaterThan(0);
    expect(comparison.improvements.length).toBe(0);
  });

  it('should detect mixed results', () => {
    const analysisA = createAnalysis({ sessionId: 'a', sessionName: 'Before' });
    const analysisB = createAnalysis({
      sessionId: 'b',
      sessionName: 'After',
      combat: { ...analysisA.combat, dps: 150, deathsPerHour: 8 }, // DPS up, deaths up
      efficiencyScore: 50, // Score down
    });

    const comparison = compareSessions(analysisA, analysisB);

    expect(comparison.verdict).toBe('mixed');
    expect(comparison.improvements.length).toBeGreaterThan(0);
    expect(comparison.regressions.length).toBeGreaterThan(0);
  });

  it('should detect unchanged results', () => {
    const analysisA = createAnalysis({ sessionId: 'a', sessionName: 'Before' });
    const analysisB = createAnalysis({ sessionId: 'b', sessionName: 'After' });

    const comparison = compareSessions(analysisA, analysisB);

    expect(comparison.verdict).toBe('unchanged');
  });

  it('should calculate percentage changes correctly', () => {
    const analysisA = createAnalysis({
      sessionId: 'a',
      combat: { encounters: 10, totalCombatTime: 200000, avgEncounterDuration: 20000, deaths: 2, deathsPerHour: 4, totalDamageDealt: 50000, totalDamageTaken: 20000, totalHealingDone: 15000, dps: 100, hps: 50, dtps: 40, spellsCast: 200, uniqueSpellsCast: 10, topSpells: [] },
    });
    const analysisB = createAnalysis({
      sessionId: 'b',
      combat: { encounters: 10, totalCombatTime: 200000, avgEncounterDuration: 20000, deaths: 2, deathsPerHour: 4, totalDamageDealt: 50000, totalDamageTaken: 20000, totalHealingDone: 15000, dps: 200, hps: 50, dtps: 40, spellsCast: 200, uniqueSpellsCast: 10, topSpells: [] },
    });

    const comparison = compareSessions(analysisA, analysisB);

    expect(comparison.deltas.dps.a).toBe(100);
    expect(comparison.deltas.dps.b).toBe(200);
    expect(comparison.deltas.dps.change).toBe(100);
    expect(comparison.deltas.dps.percentChange).toBeCloseTo(100);
  });

  it('should return proper SessionComparison interface', () => {
    const analysisA = createAnalysis({ sessionId: 'a' });
    const analysisB = createAnalysis({ sessionId: 'b' });
    const comparison = compareSessions(analysisA, analysisB);

    expect(comparison).toHaveProperty('sessionA');
    expect(comparison).toHaveProperty('sessionB');
    expect(comparison).toHaveProperty('deltas');
    expect(comparison).toHaveProperty('improvements');
    expect(comparison).toHaveProperty('regressions');
    expect(comparison).toHaveProperty('verdict');
  });
});

// ============================================================================
// MARKDOWN EXPORT TESTS
// ============================================================================

describe('exportAnalysisMarkdown', () => {
  it('should produce markdown with session heading', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md).toContain(`# Session Analysis: ${analysis.sessionName}`);
    expect(md).toContain(`**Session ID:** ${analysis.sessionId}`);
  });

  it('should include combat performance section', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md).toContain('## Combat Performance');
    expect(md).toContain('DPS');
    expect(md).toContain('Deaths');
    expect(md).toContain('Encounters');
  });

  it('should include movement section', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md).toContain('## Movement');
    expect(md).toContain('Total Distance');
    expect(md).toContain('Idle Percentage');
  });

  it('should include AI decisions section', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md).toContain('## AI Decisions');
    expect(md).toContain('Decisions/Minute');
    expect(md).toContain('Errors');
  });

  it('should include quests section when quests present', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md).toContain('## Quests');
    expect(md).toContain('Completion Rate');
  });

  it('should include efficiency score', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md).toContain('**Efficiency Score:**');
  });

  it('should include top spells when present', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md).toContain('### Top Spells');
    expect(md).toContain('Heroic Strike');
  });

  it('should produce non-empty output', () => {
    const session = createCombatSession();
    const analysis = analyzeSession(session);
    const md = exportAnalysisMarkdown(analysis);

    expect(md.length).toBeGreaterThan(200);
    expect(md.split('\n').length).toBeGreaterThan(20);
  });
});

describe('exportComparisonMarkdown', () => {
  function createTestComparison(): SessionComparison {
    return {
      sessionA: { id: 'a', name: 'Before Fix' },
      sessionB: { id: 'b', name: 'After Fix' },
      deltas: {
        dps: { a: 100, b: 150, change: 50, percentChange: 50 },
        hps: { a: 50, b: 55, change: 5, percentChange: 10 },
        deathsPerHour: { a: 4, b: 2, change: -2, percentChange: -50 },
        efficiencyScore: { a: 65, b: 80, change: 15, percentChange: 23 },
        totalDistance: { a: 5000, b: 5500, change: 500, percentChange: 10 },
        idlePercentage: { a: 25, b: 15, change: -10, percentChange: -40 },
        decisionsPerMinute: { a: 10, b: 12, change: 2, percentChange: 20 },
        questCompletionRate: { a: 75, b: 90, change: 15, percentChange: 20 },
      },
      improvements: ['DPS increased by 50%', 'Deaths/hr reduced by 2.0'],
      regressions: [],
      verdict: 'improved',
    };
  }

  it('should produce markdown with comparison heading', () => {
    const comparison = createTestComparison();
    const md = exportComparisonMarkdown(comparison);

    expect(md).toContain('# Session Comparison');
    expect(md).toContain('Before Fix');
    expect(md).toContain('After Fix');
  });

  it('should include verdict', () => {
    const comparison = createTestComparison();
    const md = exportComparisonMarkdown(comparison);

    expect(md).toContain('**Verdict:** IMPROVED');
  });

  it('should include metrics table', () => {
    const comparison = createTestComparison();
    const md = exportComparisonMarkdown(comparison);

    expect(md).toContain('## Metrics');
    expect(md).toContain('Session A');
    expect(md).toContain('Session B');
    expect(md).toContain('Change');
  });

  it('should include improvements section', () => {
    const comparison = createTestComparison();
    const md = exportComparisonMarkdown(comparison);

    expect(md).toContain('## Improvements');
    expect(md).toContain('DPS increased');
  });

  it('should include regressions section when present', () => {
    const comparison = createTestComparison();
    comparison.regressions = ['DPS decreased by 10%'];
    const md = exportComparisonMarkdown(comparison);

    expect(md).toContain('## Regressions');
    expect(md).toContain('DPS decreased');
  });
});

// ============================================================================
// RECORDING STATUS TESTS
// ============================================================================

describe('getRecordingStatus', () => {
  it('should return not recording when no session active', () => {
    const status = getRecordingStatus();

    expect(status.isRecording).toBe(false);
    expect(status.sessionId).toBeNull();
    expect(status.name).toBeNull();
    expect(status.duration).toBe(0);
    expect(status.eventCount).toBe(0);
  });
});

// ============================================================================
// PLAYBACK CONTROL TESTS
// ============================================================================

describe('controlPlayback', () => {
  it('should handle pause command', () => {
    const result = controlPlayback({ command: 'pause' });
    expect(result.message).toBe('Playback paused');
  });

  it('should handle resume command', () => {
    const result = controlPlayback({ command: 'resume' });
    expect(result.message).toBe('Playback resumed');
  });

  it('should handle stop command', () => {
    const result = controlPlayback({ command: 'stop' });
    expect(result.message).toBe('Playback stopped');
  });

  it('should handle seek command', () => {
    const result = controlPlayback({ command: 'seek', value: 5000 });
    expect(result.message).toContain('5000');
  });

  it('should handle speed command', () => {
    const result = controlPlayback({ command: 'speed', value: 2.0 });
    expect(result.message).toContain('2');
  });

  it('should throw for seek without value', () => {
    expect(() => controlPlayback({ command: 'seek' })).toThrow('numeric value');
  });

  it('should throw for speed without value', () => {
    expect(() => controlPlayback({ command: 'speed' })).toThrow('positive numeric');
  });

  it('should throw for negative speed', () => {
    expect(() => controlPlayback({ command: 'speed', value: -1 })).toThrow('positive numeric');
  });

  it('should throw for unknown command', () => {
    expect(() => controlPlayback({ command: 'invalid' as any })).toThrow('Unknown playback command');
  });
});
