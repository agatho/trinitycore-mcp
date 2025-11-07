/**
 * Knowledge Base Tools for Playerbot Development Support
 * Phase 5 - Week 2: MCP Tools Implementation
 */

import * as path from 'path';
import { KnowledgeBaseManager } from '../knowledge/KnowledgeBaseManager';
import {
  SearchResult,
  SearchOptions,
  KnowledgeBaseDocument,
  DocumentCategory,
  DifficultyLevel,
} from '../knowledge/types';

// Initialize knowledge base (singleton)
// Path is relative to the compiled dist/tools/ directory
const WIKI_BASE_PATH = path.resolve(__dirname, '../../data/playerbot_wiki');
const kbManager = KnowledgeBaseManager.getInstance(WIKI_BASE_PATH);

// Initialize on module load (async)
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = kbManager.initialize();
  }
  await initPromise;
}

/**
 * Search the Playerbot wiki documentation
 * Performance target: <50ms p95
 */
export async function searchPlayerbotWiki(
  query: string,
  options?: {
    category?: DocumentCategory;
    difficulty?: DifficultyLevel;
    limit?: number;
  }
): Promise<{
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  query: string;
}> {
  const start = performance.now();

  // Ensure knowledge base is initialized
  await ensureInitialized();

  // Build search options
  const searchOptions: SearchOptions = {
    limit: options?.limit || 10,
    difficultyFilter: options?.difficulty,
  };

  // Category boost if specified
  if (options?.category) {
    searchOptions.categoryBoost = {
      [options.category]: 2.0, // 2x boost for matching category
    };
  }

  // Execute search
  const results = kbManager.search(query, searchOptions);

  const searchTime = performance.now() - start;

  return {
    results,
    totalResults: results.length,
    searchTime,
    query,
  };
}

/**
 * Get a specific Playerbot pattern document
 * Performance target: <75ms p95
 */
export async function getPlayerbotPattern(
  patternId: string
): Promise<KnowledgeBaseDocument | null> {
  await ensureInitialized();

  // Get document by ID
  const doc = kbManager.getDocumentById(patternId);

  if (!doc) {
    return null;
  }

  // Verify it's a pattern document
  if (doc.category !== 'patterns') {
    throw new Error(`Document ${patternId} is not a pattern (category: ${doc.category})`);
  }

  return doc;
}

/**
 * Get an implementation guide
 * Performance target: <82ms p95
 */
export async function getImplementationGuide(
  guideId: string
): Promise<KnowledgeBaseDocument | null> {
  await ensureInitialized();

  const doc = kbManager.getDocumentById(guideId);

  if (!doc) {
    return null;
  }

  // Verify it's a workflow or getting_started document
  if (doc.category !== 'workflows' && doc.category !== 'getting_started') {
    throw new Error(
      `Document ${guideId} is not an implementation guide (category: ${doc.category})`
    );
  }

  return doc;
}

/**
 * Get troubleshooting guide for a specific problem
 * Performance target: <68ms p95
 */
export async function getTroubleshootingGuide(
  query: string
): Promise<{
  matchedProblems: SearchResult[];
  relatedIssues: string[];
  searchTime: number;
}> {
  const start = performance.now();

  await ensureInitialized();

  // Search only in troubleshooting category
  const searchOptions: SearchOptions = {
    limit: 5,
    categoryBoost: {
      troubleshooting: 3.0, // 3x boost for troubleshooting docs
    },
  };

  const results = kbManager.search(query, searchOptions);

  // Filter to only troubleshooting category
  const matchedProblems = results.filter(
    (r) => r.document.category === 'troubleshooting'
  );

  // Extract related topics
  const relatedIssues = matchedProblems
    .flatMap((r) => r.relatedTopics)
    .filter((topic, index, self) => self.indexOf(topic) === index) // Unique
    .slice(0, 5);

  const searchTime = performance.now() - start;

  return {
    matchedProblems,
    relatedIssues,
    searchTime,
  };
}

/**
 * Get API reference documentation
 * Performance target: <45ms p95
 */
export async function getAPIReference(
  className: string
): Promise<{
  documents: KnowledgeBaseDocument[];
  searchTime: number;
}> {
  const start = performance.now();

  await ensureInitialized();

  // Search for class name in API reference category
  const searchOptions: SearchOptions = {
    limit: 10,
    categoryBoost: {
      api_reference: 5.0, // 5x boost for API docs
    },
  };

  const results = kbManager.search(className, searchOptions);

  // Filter to only api_reference category
  const documents = results
    .filter((r) => r.document.category === 'api_reference')
    .map((r) => r.document);

  const searchTime = performance.now() - start;

  return {
    documents,
    searchTime,
  };
}

/**
 * List all documentation categories with statistics
 * Performance target: <5ms p95
 */
export async function listDocumentationCategories(): Promise<{
  categories: Array<{
    name: DocumentCategory;
    documentCount: number;
    difficulties: {
      basic: number;
      intermediate: number;
      advanced: number;
    };
  }>;
  totalDocuments: number;
  retrievalTime: number;
}> {
  const start = performance.now();

  await ensureInitialized();

  // Get statistics from knowledge base
  const stats = kbManager.getStatistics();

  // Build category breakdown
  const categories: Array<{
    name: DocumentCategory;
    documentCount: number;
    difficulties: {
      basic: number;
      intermediate: number;
      advanced: number;
    };
  }> = [];

  for (const [category, count] of Object.entries(stats.byCategory)) {
    // Get all documents in this category
    const docs = kbManager.getDocumentsByCategory(category as DocumentCategory);

    // Count by difficulty
    const difficulties = {
      basic: docs.filter((d) => d.difficulty === 'basic').length,
      intermediate: docs.filter((d) => d.difficulty === 'intermediate').length,
      advanced: docs.filter((d) => d.difficulty === 'advanced').length,
    };

    categories.push({
      name: category as DocumentCategory,
      documentCount: count,
      difficulties,
    });
  }

  const retrievalTime = performance.now() - start;

  return {
    categories,
    totalDocuments: stats.totalDocuments,
    retrievalTime,
  };
}

/**
 * Get all documents in a specific category
 * Utility function for browsing
 */
export async function getDocumentsByCategory(
  category: DocumentCategory
): Promise<{
  documents: KnowledgeBaseDocument[];
  count: number;
  retrievalTime: number;
}> {
  const start = performance.now();

  await ensureInitialized();

  const documents = kbManager.getDocumentsByCategory(category);

  const retrievalTime = performance.now() - start;

  return {
    documents,
    count: documents.length,
    retrievalTime,
  };
}
