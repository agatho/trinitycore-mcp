# SAI Editor Analysis - Feature Comparison & Unification Plan

> **Q1 Week 1 Deliverable: Comprehensive Analysis of All 3 SAI Editor Versions**
>
> Created: 2025-01-05
> Purpose: Foundation for unified SAI editor architecture

---

## EXECUTIVE SUMMARY

After thorough analysis of all 3 SAI editor versions, the recommendation is to **merge best features** from all versions into a single authoritative implementation using `sai-editor-enhanced.ts` as the foundation.

**Key Finding:** Each version serves a different purpose, but creates confusion and duplication.

---

## VERSION COMPARISON MATRIX

| Feature | v1: Basic | v2: Enhanced | v3: Complete | Unified Target |
|---------|-----------|--------------|--------------|----------------|
| **File** | sai-editor.ts | sai-editor-enhanced.ts | sai-editor-complete.ts | sai-unified/ |
| **Lines of Code** | 279 | 764 | 308 | ~2000 (estimated) |
| **Event Types** | 17 (partial) | 91 (uses v3) | 91 (complete) | ✅ 91 (all) |
| **Action Types** | 23 (partial) | 160 (uses v3) | 160 (complete) | ✅ 160 (all) |
| **Target Types** | 16 (partial) | 31 (uses v3) | 31 (complete) | ✅ 31 (all) |
| **Data Structures** | Simple | Advanced | Data only | ✅ Advanced |
| **Parameter System** | None | ✅ Full | None | ✅ Enhanced |
| **Validation** | Basic | ✅ Advanced | None | ✅ Enterprise |
| **SQL Generation** | Basic | ✅ Advanced | None | ✅ Production-ready |
| **SQL Import** | None | Placeholder | None | ✅ Full parser |
| **Templates** | 5 basic | 5 categorized | None | ✅ 20+ templates |
| **Suggestions** | None | ✅ Smart | None | ✅ AI-powered |
| **Auto-Layout** | None | ✅ Yes | None | ✅ Advanced |
| **Copy/Paste** | None | ✅ Yes | None | ✅ Yes |
| **Undo/Redo** | None | None | None | ✅ NEW |
| **Visual Editor** | None | None | None | ✅ NEW ReactFlow |
| **Collaboration** | None | None | None | ✅ NEW WebSocket |
| **AI Generation** | None | None | None | ✅ NEW GPT-4 |
| **Testing** | None | None | None | ✅ NEW 90%+ coverage |
| **Documentation** | None | Inline | Inline | ✅ Comprehensive |

---

## DETAILED FEATURE ANALYSIS

### Version 1: sai-editor.ts (Basic - 279 lines)

**Purpose:** Original SAI editor with fundamental functionality

**Strengths:**
- ✅ Simple, easy to understand
- ✅ Basic SQL generation works
- ✅ 5 useful templates (combat, health-based, aggro, death, patrol)
- ✅ Human-readable format function

**Weaknesses:**
- ❌ Only 17 event types (missing 74 events!)
- ❌ Only 23 action types (missing 137 actions!)
- ❌ Only 16 target types (missing 15 targets!)
- ❌ No parameter validation or type system
- ❌ No advanced features (copy/paste, undo/redo, etc.)
- ❌ Simple SQL generation (doesn't handle complex scripts)

**Data Structures:**
```typescript
export interface SAIEvent {
  id: string;
  type: string;
  typeName: string;
  param1-5?: number;  // Generic parameters, no typing
  description: string;
}
```

**Usage:** Currently used by web-ui/app/sai-editor/page.tsx (basic page)

**Recommendation:** ⚠️ **DEPRECATE** - Too limited, superseded by enhanced version

---

### Version 2: sai-editor-enhanced.ts (Advanced - 764 lines)

**Purpose:** Production-ready SAI editor with all advanced features

**Strengths:**
- ✅ Uses complete type definitions from v3
- ✅ **Comprehensive parameter system** with 8 types:
  - number, spell, creature, item, quest, gameobject, text, flag, enum
- ✅ **Full parameter definitions** for all SAI types:
  - 170 lines of event parameters (paramMap with descriptions, min/max, options)
  - 180 lines of action parameters
  - 15 lines of target parameters
- ✅ **Advanced validation engine:**
  - Parameter range checking
  - Connection validation
  - Error and warning categorization
  - Helpful suggestions
- ✅ **Smart suggestion system:**
  - Context-aware action suggestions based on event
  - Context-aware target suggestions based on action
  - Relevance scoring
- ✅ **Advanced data structures:**
  - SAINode (with position, phase, chance, flags)
  - SAIConnection (event-to-action, action-to-target, link types)
  - SAIScript with metadata (created, modified, author, description, tags)
- ✅ **Advanced SQL generation:**
  - Handles node connections
  - Groups by event
  - Generates complete smart_scripts entries
- ✅ **Auto-layout algorithm:** Layered layout with spacing
- ✅ **Copy/paste system:** With ID remapping and position offset
- ✅ **5 categorized templates:** combat, dialogue, summon, quest
- ✅ **SQL import (placeholder):** Framework exists, needs full implementation

**Weaknesses:**
- ❌ SQL import is incomplete (placeholder only)
- ❌ No AI-powered features
- ❌ No undo/redo system
- ❌ No visual editor UI components
- ❌ No collaborative editing
- ❌ No testing

**Data Structures:**
```typescript
export interface SAIParameter {
  name: string;
  value: number | string;
  type: 'number' | 'spell' | 'creature' | 'item' | 'quest' | 'gameobject' | 'text' | 'flag' | 'enum';
  min?: number;
  max?: number;
  options?: Array<{ value: number | string; label: string }>;
  description?: string;
  validation?: (value: any) => string | null;
}

export interface SAINode {
  id: string;
  type: 'event' | 'action' | 'target' | 'comment';
  typeId: string;
  typeName: string;
  label: string;
  parameters: SAIParameter[];
  position: { x: number; y: number };
  phase?: number;
  chance?: number;
  flags?: number;
}

export interface SAIScript {
  id: string;
  name: string;
  entryOrGuid: number;
  sourceType: number;
  nodes: SAINode[];
  connections: SAIConnection[];
  metadata: {
    createdAt: number;
    modifiedAt: number;
    author?: string;
    description?: string;
    tags?: string[];
  };
}
```

**Usage:** Currently used by web-ui/app/sai-editor-enhanced/page.tsx

**Recommendation:** ✅ **USE AS FOUNDATION** - Most complete, production-ready

---

### Version 3: sai-editor-complete.ts (Data Only - 308 lines)

**Purpose:** Comprehensive SAI type definitions from TrinityCore source

**Strengths:**
- ✅ **COMPLETE** event types: 91 entries (0-90)
- ✅ **COMPLETE** action types: 160 entries (0-159)
- ✅ **COMPLETE** target types: 31 entries (0-30)
- ✅ Accurate parameter names from TrinityCore source (SmartScriptMgr.h)
- ✅ Clear naming and labeling
- ✅ Used as data source by v2

**Weaknesses:**
- ❌ Data only, no functions
- ❌ No validation logic
- ❌ No helpers or utilities

**Data Structure:**
```typescript
export const SAI_EVENT_TYPES_COMPLETE = [
  { id: '0', name: 'UPDATE_IC', label: 'Update In Combat', params: ['InitialMin', 'InitialMax', 'RepeatMin', 'RepeatMax'] },
  // ... 90 more events
];
```

**Usage:** Imported by sai-editor-enhanced.ts as data source

**Recommendation:** ✅ **MERGE INTO UNIFIED** - Keep as constants, move to types.ts

---

## FEATURE DEPENDENCY ANALYSIS

### What v2 (Enhanced) Gets Right:
1. **Parameter Type System** - Revolutionary for validation
2. **Node-based Architecture** - Perfect for visual editing
3. **Connection System** - Clean event → action → target flow
4. **Metadata Tracking** - Essential for collaboration
5. **Smart Suggestions** - Contextual, user-friendly
6. **Auto-Layout** - Saves time, improves UX
7. **Copy/Paste** - Critical workflow feature

### What's Missing Across All Versions:
1. **Undo/Redo System** - Critical for usability
2. **Visual Editor UI** - ReactFlow integration needed
3. **Full SQL Import** - Only placeholder exists
4. **AI Features:**
   - Natural language → SAI generation
   - Creature type → suggested SAI scripts
   - Bug detection and optimization
5. **Collaborative Editing:**
   - Multi-user editing
   - Real-time sync
   - Conflict resolution
6. **Testing Infrastructure**
7. **Performance Optimization:**
   - Large script handling
   - Lazy loading
   - Caching
8. **Export Formats:**
   - JSON (exists)
   - XML
   - C++ (for hardcoded scripts)
   - Documentation

---

## UNIFIED ARCHITECTURE DESIGN

### Directory Structure

```
web-ui/lib/sai-unified/
├── types.ts                 # All TypeScript interfaces
├── constants.ts             # SAI type definitions (from v3)
├── validation.ts            # Validation engine
├── parameters.ts            # Parameter definitions (from v2)
├── suggestions.ts           # Smart suggestion system
├── sql-generator.ts         # SQL generation
├── sql-parser.ts            # SQL import (NEW - complete implementation)
├── templates.ts             # Template library (expanded to 20+)
├── layout.ts                # Auto-layout algorithm
├── clipboard.ts             # Copy/paste/duplicate
├── history.ts               # Undo/redo system (NEW)
├── ai-generator.ts          # AI-powered generation (NEW)
├── collaboration.ts         # Real-time sync (NEW)
├── utils.ts                 # Helper functions
└── index.ts                 # Public API exports
```

### Core Data Models

```typescript
// types.ts
export interface SAIParameter {
  name: string;
  value: number | string;
  type: 'number' | 'spell' | 'creature' | 'item' | 'quest' | 'gameobject' | 'text' | 'flag' | 'enum' | 'faction' | 'emote' | 'sound';
  min?: number;
  max?: number;
  options?: Array<{ value: number | string; label: string }>;
  description?: string;
  validation?: (value: any) => string | null;
  required?: boolean;
  defaultValue?: number | string;
}

export interface SAINode {
  id: string;
  type: 'event' | 'action' | 'target' | 'comment';
  typeId: string;
  typeName: string;
  label: string;
  parameters: SAIParameter[];
  position: { x: number; y: number };
  phase?: number;
  chance?: number;
  flags?: number;
  link?: number;
  metadata?: {
    createdBy?: string;
    createdAt?: number;
    modifiedBy?: string;
    modifiedAt?: number;
    locked?: boolean;
  };
}

export interface SAIConnection {
  id: string;
  source: string;
  target: string;
  type: 'event-to-action' | 'action-to-target' | 'link';
  metadata?: {
    createdBy?: string;
    createdAt?: number;
  };
}

export interface SAIScript {
  id: string;
  name: string;
  entryOrGuid: number;
  sourceType: number;
  nodes: SAINode[];
  connections: SAIConnection[];
  metadata: {
    version: string;
    createdAt: number;
    modifiedAt: number;
    author?: string;
    description?: string;
    tags?: string[];
    locked?: boolean;
    collaborators?: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
}

export interface ValidationError {
  nodeId: string;
  message: string;
  parameter?: string;
  severity: 'error';
  suggestion?: string;
}

export interface ValidationWarning {
  nodeId: string;
  message: string;
  parameter?: string;
  severity: 'warning';
  suggestion?: string;
}

export interface ValidationInfo {
  nodeId: string;
  message: string;
  severity: 'info';
}

export interface Suggestion {
  type: 'action' | 'target' | 'parameter' | 'template';
  nodeId?: string;
  items: SuggestionItem[];
}

export interface SuggestionItem {
  id: string;
  name: string;
  description: string;
  relevance: number;
  category?: string;
  tags?: string[];
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: 'add' | 'delete' | 'modify' | 'move' | 'connect' | 'disconnect';
  before: SAIScript;
  after: SAIScript;
  description: string;
}

export interface AIGenerationRequest {
  prompt: string;
  context?: {
    creatureEntry?: number;
    creatureType?: string;
    creatureRank?: string;
    level?: number;
    faction?: number;
  };
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

export interface AIGenerationResult {
  success: boolean;
  script?: SAIScript;
  error?: string;
  confidence?: number;
  suggestions?: string[];
}
```

---

## KEY IMPROVEMENTS OVER EXISTING VERSIONS

### 1. Enhanced Type System
- **12 parameter types** (vs 8): Added faction, emote, sound
- **Required flag**: Mark mandatory parameters
- **Default values**: Sensible defaults for all parameters
- **Metadata per node**: Track creation/modification

### 2. Complete SQL Import
- **Full parser**: Handle all TrinityCore SQL formats
- **Multi-entry import**: Batch import entire scripts
- **Connection reconstruction**: Build visual graph from SQL
- **Error recovery**: Handle malformed SQL gracefully

### 3. AI Integration
- **GPT-4 generation**: Natural language → SAI
- **Creature analysis**: Analyze creature and suggest SAI
- **Pattern detection**: Learn from existing scripts
- **Optimization suggestions**: Improve efficiency

### 4. Collaboration Features
- **Multi-user editing**: WebSocket-based sync
- **Presence**: See who's editing what
- **Lock system**: Prevent conflicting edits
- **Change tracking**: Audit log of all modifications

### 5. Undo/Redo System
- **Unlimited history** (configurable max)
- **Granular actions**: Undo individual changes
- **Branch/merge**: Handle complex edit histories

### 6. Enhanced Templates
- **20+ templates** (vs 5): Cover all common patterns
- **Categories**: Combat, Quest, Dialogue, Movement, Summon, Phase, Boss, etc.
- **Customizable**: Users can save their own templates
- **Share**: Template marketplace/library

### 7. Performance Optimization
- **Virtual scrolling**: Handle 1000+ nodes
- **Lazy loading**: Load scripts on-demand
- **Caching**: Redis-based cache for large scripts
- **Debouncing**: Efficient validation and rendering

### 8. Testing & Quality
- **90%+ test coverage**
- **Unit tests**: All functions
- **Integration tests**: End-to-end workflows
- **Performance tests**: Large script handling
- **Visual regression tests**: UI consistency

---

## MIGRATION STRATEGY

### Phase 1: Foundation (Week 2)
1. Create directory structure
2. Port v3 constants to constants.ts
3. Port v2 types to types.ts (enhanced)
4. Port v2 parameters to parameters.ts (enhanced)

### Phase 2: Core Features (Week 2)
5. Port v2 validation to validation.ts (enhanced)
6. Port v2 suggestions to suggestions.ts (enhanced)
7. Port v2 SQL generation to sql-generator.ts (enhanced)
8. Implement complete SQL parser in sql-parser.ts (NEW)

### Phase 3: Advanced Features (Week 3)
9. Port v2 auto-layout to layout.ts (enhanced)
10. Port v2 copy/paste to clipboard.ts (enhanced)
11. Implement history.ts for undo/redo (NEW)
12. Implement ai-generator.ts (NEW)

### Phase 4: Collaboration (Week 3)
13. Implement collaboration.ts (NEW)
14. WebSocket integration
15. Conflict resolution

### Phase 5: UI Integration (Week 4)
16. Create React components with ReactFlow
17. Integrate all features
18. Testing
19. Documentation

### Phase 6: Deprecation (Week 4)
20. Mark old files as deprecated
21. Add migration warnings
22. Update all imports in web-ui/app pages
23. Remove old files after migration complete

---

## BREAKING CHANGES

### API Changes
1. Import path changes:
   ```typescript
   // OLD
   import { SAI_EVENT_TYPES } from '@/lib/sai-editor';

   // NEW
   import { SAI_EVENT_TYPES } from '@/lib/sai-unified/constants';
   ```

2. Interface renames:
   ```typescript
   // OLD: SAIAction interface
   // NEW: SAINode with type: 'action'
   ```

3. Function signatures:
   ```typescript
   // OLD
   function generateSAISQL(script: SAIScript): string

   // NEW
   function generateSQL(script: SAIScript, options?: SQLGenerationOptions): string
   ```

### Data Format Changes
1. Script format includes metadata
2. Connections are explicit (not implicit)
3. Parameters are typed objects (not just numbers)

### Migration Tools
Will provide:
1. **Auto-migration script**: Convert old scripts to new format
2. **Validation tool**: Check for conversion issues
3. **Compatibility layer**: Temporary adapters for old code

---

## SUCCESS METRICS

### Code Quality
- [ ] TypeScript strict mode: 100%
- [ ] ESLint warnings: 0
- [ ] Test coverage: >90%
- [ ] Documentation: 100% of public APIs

### Functionality
- [ ] All 91 events supported
- [ ] All 160 actions supported
- [ ] All 31 targets supported
- [ ] SQL import: 100% accuracy
- [ ] SQL export: 100% accuracy
- [ ] AI generation: >80% success rate

### Performance
- [ ] Handle 1000+ node scripts
- [ ] Validation < 100ms
- [ ] SQL generation < 200ms
- [ ] UI render < 16ms (60fps)

### Usability
- [ ] Undo/redo: unlimited
- [ ] Auto-save: every 30s
- [ ] Templates: 20+
- [ ] Suggestions: >90% relevance

---

## RISK ASSESSMENT

### High Risk
1. **Breaking Changes**: Users with existing scripts
   - *Mitigation*: Migration tools, compatibility layer, clear docs

2. **AI Reliability**: GPT-4 may generate incorrect SAI
   - *Mitigation*: Validation layer, confidence scores, human review

### Medium Risk
3. **Performance**: Large scripts (1000+ nodes)
   - *Mitigation*: Virtual scrolling, lazy loading, optimization

4. **Complexity**: Collaborative editing conflicts
   - *Mitigation*: Operational Transformation, conflict UI, testing

### Low Risk
5. **Testing Time**: Comprehensive tests take time
   - *Mitigation*: Parallel testing, CI/CD optimization

---

## TIMELINE ESTIMATE

| Week | Task | Status |
|------|------|--------|
| **Week 1** | Analysis & Architecture | ✅ IN PROGRESS |
| **Week 2** | Core Implementation | ⏳ PENDING |
| **Week 3** | UI Components | ⏳ PENDING |
| **Week 4** | AI & Testing | ⏳ PENDING |

**Total:** 4 weeks as planned in Q1 implementation plan

---

## NEXT STEPS

1. ✅ **Complete Week 1**: Finish this analysis document
2. ⏳ **Review & Approve**: Stakeholder sign-off on architecture
3. ⏳ **Begin Week 2**: Start core implementation
4. ⏳ **Daily Check-ins**: Track progress, adjust as needed

---

## APPENDIX A: TYPE COVERAGE COMPARISON

### Events Coverage
- **v1**: 17/91 (18.7%) ❌
- **v2/v3**: 91/91 (100%) ✅
- **Unified**: 91/91 (100%) ✅

### Actions Coverage
- **v1**: 23/160 (14.4%) ❌
- **v2/v3**: 160/160 (100%) ✅
- **Unified**: 160/160 (100%) ✅

### Targets Coverage
- **v1**: 16/31 (51.6%) ⚠️
- **v2/v3**: 31/31 (100%) ✅
- **Unified**: 31/31 (100%) ✅

**Total SAI Types:** 282 (91 events + 160 actions + 31 targets)

---

## APPENDIX B: FILE SIZE COMPARISON

| Version | File | Lines | Characters | Functions | Exports |
|---------|------|-------|------------|-----------|---------|
| v1 | sai-editor.ts | 279 | 9,504 | 4 | 9 |
| v2 | sai-editor-enhanced.ts | 764 | 28,320 | 10 | 22 |
| v3 | sai-editor-complete.ts | 308 | 11,840 | 0 | 3 |
| **Total** | **3 files** | **1,351** | **49,664** | **14** | **34** |
| **Unified** | **11 files** | **~2,000** | **~75,000** | **~40** | **~60** |

**Why More Code?**
- Complete SQL parser (+300 lines)
- Undo/redo system (+200 lines)
- AI integration (+300 lines)
- Collaboration (+200 lines)
- Comprehensive testing (+500 lines)
- Better organization (more files, clearer structure)

---

**Document Status:** ✅ COMPLETE
**Next Action:** Begin Week 2 - Core Implementation
**Owner:** Development Team
**Version:** 1.0
