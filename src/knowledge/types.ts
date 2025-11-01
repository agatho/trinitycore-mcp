/**
 * Knowledge Base Type Definitions
 * Phase 5: Playerbot Development Support
 */

export type DocumentCategory =
  | 'getting_started'
  | 'patterns'
  | 'workflows'
  | 'troubleshooting'
  | 'api_reference'
  | 'examples'
  | 'advanced';

export type DifficultyLevel = 'basic' | 'intermediate' | 'advanced';

export interface CodeExample {
  language: string;
  code: string;
  description: string;
  filename?: string;
}

export interface KnowledgeBaseDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  tags: string[];
  content: string;
  codeExamples: CodeExample[];
  relatedDocs: string[];
  difficulty: DifficultyLevel;
  lastUpdated: Date;
  searchWeight: number;
  excerpt?: string;
}

export interface SearchOptions {
  categoryBoost?: Record<string, number>;
  difficultyFilter?: DifficultyLevel;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  document: KnowledgeBaseDocument;
  score: number;
  matchedTerms: string[];
  excerpt: string;
  relatedTopics: string[];
}

export interface PatternDocument extends KnowledgeBaseDocument {
  keyConcepts: string[];
  trinityAPIs: APIReference[];
  implementation: {
    steps: ImplementationStep[];
  };
  threadSafety: ThreadSafetyNotes;
  performance: PerformanceNotes;
  commonPitfalls: Pitfall[];
  tests?: string;
  relatedPatterns: string[];
}

export interface APIReference {
  className: string;
  methodName: string;
  description: string;
  signature?: string;
}

export interface ImplementationStep {
  title: string;
  code: string;
  explanation: string;
}

export interface ThreadSafetyNotes {
  critical: string[];
  safeApproach: string;
  unsafeApproach: string;
}

export interface PerformanceNotes {
  memory: string;
  cpu: string;
  network: string;
}

export interface Pitfall {
  description: string;
  badCode: string;
  goodCode: string;
}

export interface ImplementationGuide {
  title: string;
  steps: ImplementationStep[];
  prerequisites: string[];
  codeExamples: CodeExample[];
  testingStrategy: string;
  commonErrors: string[];
  nextSteps: string[];
}

export interface TroubleshootingGuide {
  query: string;
  matchedProblems: TroubleshootingProblem[];
  relatedIssues: string[];
}

export interface TroubleshootingProblem {
  problem: string;
  severity: 'critical' | 'major' | 'minor';
  symptoms: string[];
  rootCause: string;
  solution: string;
  debuggingSteps: string[];
  verification: string;
}
