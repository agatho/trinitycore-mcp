import { SearchEngine } from './SearchEngine.js';
import { DocumentIndexer } from './DocumentIndexer.js';
import { KnowledgeBaseDocument, SearchResult, SearchOptions, DocumentCategory } from './types.js';

export class KnowledgeBaseManager {
  private static instance: KnowledgeBaseManager;
  private searchEngine: SearchEngine;
  private indexer: DocumentIndexer;
  private initialized = false;

  private constructor(basePath: string) {
    this.searchEngine = new SearchEngine();
    this.indexer = new DocumentIndexer(basePath);
  }

  static getInstance(basePath?: string): KnowledgeBaseManager {
    if (!KnowledgeBaseManager.instance) {
      if (!basePath) throw new Error('basePath required');
      KnowledgeBaseManager.instance = new KnowledgeBaseManager(basePath);
    }
    return KnowledgeBaseManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const docs = await this.indexer.indexAllCategories();
    await this.searchEngine.indexDocuments(docs);
    this.initialized = true;
  }

  search(query: string, options?: SearchOptions): SearchResult[] {
    if (!this.initialized) throw new Error('Not initialized');
    return this.searchEngine.search(query, options);
  }

  getDocumentById(id: string) { return this.searchEngine.getDocumentById(id); }
  getDocumentsByCategory(cat: DocumentCategory) { return this.searchEngine.getDocumentsByCategory(cat); }
  getStatistics() { return this.searchEngine.getStatistics(); }
}
