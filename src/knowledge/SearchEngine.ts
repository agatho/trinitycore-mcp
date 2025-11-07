/**
 * Search Engine for Knowledge Base
 * Uses MiniSearch for fast full-text search
 */

import MiniSearch from 'minisearch';
import {
  KnowledgeBaseDocument,
  SearchResult,
  SearchOptions,
  DocumentCategory,
} from './types';
import { logger } from '../utils/logger';

export class SearchEngine {
  private index: MiniSearch<KnowledgeBaseDocument>;
  private documents: Map<string, KnowledgeBaseDocument>;

  constructor() {
    this.documents = new Map();
    this.index = new MiniSearch({
      fields: ['title', 'content', 'tags', 'category', 'excerpt'],
      storeFields: ['id', 'title', 'category', 'difficulty', 'excerpt', 'tags'],
      searchOptions: {
        boost: { title: 3, tags: 2, excerpt: 1.5, category: 1 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: 'AND',
      },
      idField: 'id',
    });
  }

  async indexDocuments(documents: KnowledgeBaseDocument[]): Promise<void> {
    const start = performance.now();

    for (const doc of documents) {
      this.documents.set(doc.id, doc);
    }

    await this.index.addAllAsync(documents);

    const duration = performance.now() - start;
    logger.info(`Indexed ${documents.length} documents in ${duration.toFixed(2)}ms`);
  }

  search(query: string, options?: SearchOptions): SearchResult[] {
    const start = performance.now();

    const limit = options?.limit || 10;
    const offset = options?.offset || 0;

    // Build search options
    const searchOpts: any = {};
    if (options?.categoryBoost) {
      searchOpts.boost = options.categoryBoost;
    }
    if (options?.difficultyFilter) {
      searchOpts.filter = (result: any) => {
        const doc = this.documents.get(result.id);
        return doc?.difficulty === options.difficultyFilter;
      };
    }

    // Perform search
    const rawResults = this.index.search(query, searchOpts);

    // Convert to SearchResult format
    const results: SearchResult[] = rawResults
      .slice(offset, offset + limit)
      .map((result) => {
        const document = this.documents.get(result.id)!;
        const matchedTerms = result.terms || [];

        return {
          document,
          score: result.score,
          matchedTerms,
          excerpt: this.generateExcerpt(document, matchedTerms),
          relatedTopics: this.findRelatedTopics(document),
        };
      });

    const duration = performance.now() - start;
    logger.info(`Search completed in ${duration.toFixed(2)}ms`);

    return results;
  }

  private generateExcerpt(doc: KnowledgeBaseDocument, terms: string[]): string {
    if (doc.excerpt) {
      return doc.excerpt;
    }

    // Find first occurrence of any search term
    const content = doc.content.toLowerCase();
    for (const term of terms) {
      const index = content.indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(doc.content.length, index + 100);
        let excerpt = doc.content.substring(start, end);

        if (start > 0) excerpt = '...' + excerpt;
        if (end < doc.content.length) excerpt = excerpt + '...';

        return excerpt;
      }
    }

    // Fallback: first 150 characters
    return doc.content.substring(0, 150) + '...';
  }

  private findRelatedTopics(doc: KnowledgeBaseDocument): string[] {
    // Find documents with similar tags
    const relatedDocs: Array<{ id: string; score: number }> = [];

    for (const [id, otherDoc] of this.documents.entries()) {
      if (id === doc.id) continue;

      // Calculate similarity based on shared tags
      const sharedTags = doc.tags.filter(tag => otherDoc.tags.includes(tag));
      const score = sharedTags.length / Math.max(doc.tags.length, otherDoc.tags.length);

      if (score > 0.3) {
        relatedDocs.push({ id, score });
      }
    }

    // Sort by score and return top 5
    return relatedDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ id }) => this.documents.get(id)!.title);
  }

  getDocumentById(id: string): KnowledgeBaseDocument | undefined {
    return this.documents.get(id);
  }

  getDocumentsByCategory(category: DocumentCategory): KnowledgeBaseDocument[] {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.category === category
    );
  }

  getAllDocuments(): KnowledgeBaseDocument[] {
    return Array.from(this.documents.values());
  }

  getStatistics() {
    const stats = {
      totalDocuments: this.documents.size,
      byCategory: {} as Record<DocumentCategory, number>,
      byDifficulty: {
        basic: 0,
        intermediate: 0,
        advanced: 0,
      },
    };

    for (const doc of this.documents.values()) {
      stats.byCategory[doc.category] = (stats.byCategory[doc.category] || 0) + 1;
      stats.byDifficulty[doc.difficulty]++;
    }

    return stats;
  }
}
