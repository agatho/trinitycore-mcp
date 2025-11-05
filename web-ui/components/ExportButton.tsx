/**
 * Export Button Component
 * Provides data export functionality with format selection
 */

'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { exportData, ExportFormat } from '@/lib/export';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export interface ExportButtonProps {
  data: any[];
  filename?: string;
  title?: string;
  columns?: string[];
  headers?: Record<string, string>;
  disabled?: boolean;
}

export function ExportButton({
  data,
  filename,
  title,
  columns,
  headers,
  disabled,
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    setExporting(true);

    try {
      exportData({
        format,
        data,
        filename,
        columns,
        headers,
        title,
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting || !data || data.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xml')}>
          Export as XML
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
