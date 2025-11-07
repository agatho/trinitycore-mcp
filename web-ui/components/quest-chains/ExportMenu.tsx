'use client';

import React, { useState } from 'react';
import { Download, FileImage, FileCode, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  exportToJSON,
  exportToPNG,
  exportToSVG,
  exportToMermaid,
  exportToPDF,
  exportWithStats,
  Quest,
} from '@/lib/quest-chain-export';

interface ExportMenuProps {
  quests: Quest[];
  disabled?: boolean;
}

export function ExportMenu({ quests, disabled = false }: ExportMenuProps) {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);

  const handleExport = async (type: string) => {
    setExporting(true);
    setExportType(type);

    try {
      switch (type) {
        case 'json':
          exportToJSON(quests);
          break;

        case 'json-stats':
          exportWithStats(quests);
          break;

        case 'png':
          await exportToPNG();
          break;

        case 'svg':
          await exportToSVG();
          break;

        case 'mermaid':
          exportToMermaid(quests);
          break;

        case 'pdf':
          await exportToPDF('.react-flow', 'quest_chain.pdf', quests);
          break;

        default:
          console.error('Unknown export type:', type);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export as ${type.toUpperCase()}`);
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || exporting}>
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Quest Chain</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleExport('json')}>
          <FileCode className="w-4 h-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport('json-stats')}>
          <FileText className="w-4 h-4 mr-2" />
          Export JSON + Statistics
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleExport('png')}>
          <FileImage className="w-4 h-4 mr-2" />
          Export as PNG Image
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport('svg')}>
          <FileImage className="w-4 h-4 mr-2" />
          Export as SVG
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="w-4 h-4 mr-2" />
          Export as PDF Report
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleExport('mermaid')}>
          <FileCode className="w-4 h-4 mr-2" />
          Export as Mermaid Diagram
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
