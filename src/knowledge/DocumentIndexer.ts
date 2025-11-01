/**
 * Document Indexer - Parses markdown files and indexes them for search
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import { KnowledgeBaseDocument, CodeExample, DocumentCategory, DifficultyLevel } from './types.js';

export class DocumentIndexer {
  private md: MarkdownIt;
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.md = new MarkdownIt();
  }

  async indexAllCategories(): Promise<KnowledgeBaseDocument[]> {
    const categories: DocumentCategory[] = [
      'getting_started', 'patterns', 'workflows', 'troubleshooting',
      'api_reference', 'examples', 'advanced',
    ];

    const allDocuments: KnowledgeBaseDocument[] = [];
    for (const category of categories) {
      const docs = await this.indexDirectory(category);
      allDocuments.push(...docs);
    }

    console.log(`Indexed ${allDocuments.length} total documents`);
    return allDocuments;
  }

  async indexDirectory(category: DocumentCategory): Promise<KnowledgeBaseDocument[]> {
    const categoryPath = path.join(this.basePath, category);
    const documents: KnowledgeBaseDocument[] = [];

    try {
      const files = await this.getMarkdownFiles(categoryPath);
      for (const file of files) {
        const doc = await this.parseMarkdownFile(file, category);
        if (doc) documents.push(doc);
      }
    } catch (error) {
      console.error(`Error indexing category ${category}:`, error);
    }

    return documents;
  }

  private async getMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this.getMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      return [];
    }
    return files;
  }

  private async parseMarkdownFile(filePath: string, category: DocumentCategory): Promise<KnowledgeBaseDocument | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const id = path.relative(this.basePath, filePath).replace(/\\/g, '/').replace('.md', '');
      const title = this.extractTitle(content);
      const tags = this.extractTags(content);
      const difficulty = this.extractDifficulty(content);

      return {
        id, title, category, tags,
        content: content.replace(/\*\*[^:]+:\*\*[^\n]+\n/g, '').trim(),
        codeExamples: this.extractCodeExamples(content),
        relatedDocs: [],
        difficulty,
        lastUpdated: new Date(),
        searchWeight: 1.0,
        excerpt: this.extractExcerpt(content),
      };
    } catch (error) {
      return null;
    }
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled';
  }

  private extractTags(content: string): string[] {
    const match = content.match(/\*\*Tags:\*\*\s*(.+)/);
    return match ? match[1].split(',').map(t => t.trim().replace(/[\[\]]/g, '')) : [];
  }

  private extractDifficulty(content: string): DifficultyLevel {
    const match = content.match(/\*\*Difficulty:\*\*\s*(\w+)/);
    return (match?.[1] as DifficultyLevel) || 'intermediate';
  }

  private extractCodeExamples(content: string): CodeExample[] {
    const examples: CodeExample[] = [];
    const regex = /```(\w+)\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      examples.push({ language: match[1], code: match[2].trim(), description: '' });
    }
    return examples;
  }

  private extractExcerpt(content: string): string {
    const match = content.match(/##\s+Overview\s*\n+([^\n#]+)/);
    if (match) return match[1].trim().substring(0, 200);
    const firstPara = content.match(/^#.+\n+([^\n#]+)/);
    return firstPara ? firstPara[1].trim().substring(0, 200) : content.substring(0, 200).replace(/[#*]/g, '').trim();
  }
}
