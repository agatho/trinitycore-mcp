/**
 * Data Export Utilities
 * Supports CSV, Excel, PDF, and JSON exports with customizable formatting
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json' | 'xml';

export interface ExportOptions {
  filename?: string;
  format: ExportFormat;
  data: any[];
  columns?: string[];
  headers?: Record<string, string>;
  title?: string;
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: any[], filename: string = 'export.csv'): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values with commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Export data to Excel format
 */
export function exportToExcel(data: any[], filename: string = 'export.xlsx'): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // Auto-size columns
  const maxWidth = 50;
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, maxWidth) };
  });
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export data to PDF format
 */
export function exportToPDF(data: any[], options: {
  filename?: string;
  title?: string;
  columns?: string[];
  headers?: Record<string, string>;
} = {}): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const { filename = 'export.pdf', title = 'Data Export', columns, headers } = options;

  const doc = new jsPDF();

  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  // Add metadata
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  doc.text(`Records: ${data.length}`, 14, 27);

  // Prepare table data
  const cols = columns || Object.keys(data[0]);
  const tableHeaders = cols.map(col => headers?.[col] || col);
  const tableData = data.map(row => cols.map(col => row[col] ?? ''));

  // Add table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 32,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 32 },
  });

  doc.save(filename);
}

/**
 * Export data to JSON format
 */
export function exportToJSON(data: any[], filename: string = 'export.json'): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
}

/**
 * Export data to XML format
 */
export function exportToXML(data: any[], filename: string = 'export.xml'): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const xmlContent = generateXML(data);
  downloadFile(xmlContent, filename, 'application/xml');
}

/**
 * Generate XML from data array
 */
function generateXML(data: any[]): string {
  const escapeXML = (str: string): string => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const items = data.map(item => {
    const fields = Object.entries(item)
      .map(([key, value]) => `    <${key}>${escapeXML(String(value ?? ''))}</${key}>`)
      .join('\n');
    return `  <item>\n${fields}\n  </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<data>\n${items}\n</data>`;
}

/**
 * Universal export function
 */
export function exportData(options: ExportOptions): void {
  const { format, data, filename, columns, headers, title } = options;

  switch (format) {
    case 'csv':
      exportToCSV(data, filename || 'export.csv');
      break;
    case 'excel':
      exportToExcel(data, filename || 'export.xlsx');
      break;
    case 'pdf':
      exportToPDF(data, { filename: filename || 'export.pdf', title, columns, headers });
      break;
    case 'json':
      exportToJSON(data, filename || 'export.json');
      break;
    case 'xml':
      exportToXML(data, filename || 'export.xml');
      break;
    default:
      console.error(`Unsupported export format: ${format}`);
  }
}

/**
 * Download file helper
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy data to clipboard
 */
export function copyToClipboard(data: any[], format: 'json' | 'csv' | 'tsv' = 'json'): Promise<void> {
  let content: string;

  switch (format) {
    case 'json':
      content = JSON.stringify(data, null, 2);
      break;
    case 'csv':
      const headers = Object.keys(data[0]);
      content = [
        headers.join(','),
        ...data.map(row => headers.map(h => row[h] ?? '').join(','))
      ].join('\n');
      break;
    case 'tsv':
      const tsvHeaders = Object.keys(data[0]);
      content = [
        tsvHeaders.join('\t'),
        ...data.map(row => tsvHeaders.map(h => row[h] ?? '').join('\t'))
      ].join('\n');
      break;
  }

  return navigator.clipboard.writeText(content);
}
