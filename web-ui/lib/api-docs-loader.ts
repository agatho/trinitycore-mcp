/**
 * API Documentation Loader
 * Loads and parses TrinityCore API documentation from YAML files
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// API Method interface matching YAML structure
export interface APIMethod {
  method: string;
  className: string;
  methodName: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returns?: {
    type: string;
    description: string;
  };
  usage?: string;
  notes?: string;
  related_methods?: string[];
}

// Cache for loaded API docs
let apiDocsCache: APIMethod[] | null = null;
let categoryCache: Map<string, APIMethod[]> | null = null;

/**
 * Get the API docs directory path
 */
function getAPIDocsPath(): string {
  // Path to trinitycore-mcp data directory
  // web-ui is at: C:\TrinityBots\trinitycore-mcp\web-ui
  // data is at: C:\TrinityBots\trinitycore-mcp\data\api_docs\general

  // When running from web-ui subdirectory, go up one level to trinitycore-mcp root
  return path.join(process.cwd(), '..', 'data', 'api_docs', 'general');
}

/**
 * Load all API documentation files
 */
export function loadAllAPIDocs(): APIMethod[] {
  if (apiDocsCache) {
    return apiDocsCache;
  }

  const docsPath = getAPIDocsPath();

  if (!fs.existsSync(docsPath)) {
    console.warn(`API docs path not found: ${docsPath}`);
    return [];
  }

  const files = fs.readdirSync(docsPath).filter(file => file.endsWith('.yaml'));
  const methods: APIMethod[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(docsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const doc = yaml.load(content) as any;

      // Parse method name to extract class and method
      const [className, methodName] = doc.method?.split('::') || ['Unknown', 'Unknown'];

      methods.push({
        method: doc.method || 'Unknown',
        className,
        methodName,
        description: doc.description || '',
        parameters: doc.parameters,
        returns: doc.returns,
        usage: doc.usage,
        notes: doc.notes,
        related_methods: doc.related_methods,
      });
    } catch (error) {
      console.error(`Error loading ${file}:`, error);
    }
  }

  apiDocsCache = methods;
  return methods;
}

/**
 * Get all unique class names
 */
export function getAllClasses(): string[] {
  const methods = loadAllAPIDocs();
  const classes = new Set(methods.map(m => m.className));
  return Array.from(classes).sort();
}

/**
 * Get methods by class name
 */
export function getMethodsByClass(className: string): APIMethod[] {
  const methods = loadAllAPIDocs();
  return methods.filter(m => m.className === className);
}

/**
 * Get methods grouped by category/class
 */
export function getMethodsByCategory(): Map<string, APIMethod[]> {
  if (categoryCache) {
    return categoryCache;
  }

  const methods = loadAllAPIDocs();
  const categories = new Map<string, APIMethod[]>();

  for (const method of methods) {
    const className = method.className;
    if (!categories.has(className)) {
      categories.set(className, []);
    }
    categories.get(className)!.push(method);
  }

  categoryCache = categories;
  return categories;
}

/**
 * Search methods by query
 */
export function searchMethods(query: string): APIMethod[] {
  const methods = loadAllAPIDocs();
  const lowerQuery = query.toLowerCase();

  return methods.filter(method => {
    return (
      method.method.toLowerCase().includes(lowerQuery) ||
      method.className.toLowerCase().includes(lowerQuery) ||
      method.methodName.toLowerCase().includes(lowerQuery) ||
      method.description.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Get method by full name (ClassName::MethodName)
 */
export function getMethodByName(fullName: string): APIMethod | null {
  const methods = loadAllAPIDocs();
  return methods.find(m => m.method === fullName) || null;
}

/**
 * Get API documentation statistics
 */
export function getAPIDocsStats() {
  const methods = loadAllAPIDocs();
  const classes = getAllClasses();

  return {
    totalMethods: methods.length,
    totalClasses: classes.length,
    methodsWithParameters: methods.filter(m => m.parameters && m.parameters.length > 0).length,
    methodsWithReturns: methods.filter(m => m.returns).length,
    methodsWithUsageExamples: methods.filter(m => m.usage).length,
    methodsWithNotes: methods.filter(m => m.notes).length,
  };
}

/**
 * Clear cache (useful for development/testing)
 */
export function clearCache() {
  apiDocsCache = null;
  categoryCache = null;
}
