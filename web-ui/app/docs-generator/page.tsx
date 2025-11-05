'use client';

import React, { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DocsGeneratorPage() {
  const [tableName, setTableName] = useState('');
  const [docs, setDocs] = useState('');
  const [loading, setLoading] = useState(false);

  const generateDocs = async () => {
    if (!tableName) {
      alert('Please enter a table name');
      return;
    }

    setLoading(true);
    // Simulate documentation generation
    await new Promise(resolve => setTimeout(resolve, 1000));

    const generatedDocs = `# ${tableName} Documentation

## Overview
The \`${tableName}\` table stores data related to ${tableName.replace(/_/g, ' ')}.

## Schema

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(100) | Name field |
| created_at | TIMESTAMP | Creation timestamp |

## Usage Examples

### Select all records
\`\`\`sql
SELECT * FROM ${tableName};
\`\`\`

### Insert new record
\`\`\`sql
INSERT INTO ${tableName} (name) VALUES ('Example');
\`\`\`

## Related Tables
- Related table 1
- Related table 2

## Notes
Auto-generated documentation for ${tableName}.
`;

    setDocs(generatedDocs);
    setLoading(false);
  };

  const downloadDocs = () => {
    const blob = new Blob([docs], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_documentation.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Documentation Generator</h1>
              <p className="text-slate-400">Auto-generate documentation from database schema</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 mb-6">
          <div className="flex gap-4">
            <Input
              type="text"
              placeholder="Enter table name (e.g., creature_template)"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="flex-1 bg-slate-900/50 border-slate-700 text-white"
            />
            <Button onClick={generateDocs} disabled={loading}>
              Generate Docs
            </Button>
          </div>
        </div>

        {docs && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Generated Documentation</h3>
              <Button size="sm" onClick={downloadDocs}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
            <div className="bg-slate-900/50 p-6 rounded">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{docs}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
