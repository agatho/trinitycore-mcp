'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Download, RefreshCw, FileWarning, Map as MapIcon, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { parseMapFile } from '@/lib/map-file-parser';
import type { ParsedMapFile } from '@/lib/map-file-parser';

interface MapFileInfo {
  name: string;
  filename: string;
  size: number;
  modified: string;
  path: string;
}

interface MapFilesResponse {
  success: boolean;
  count: number;
  basePath?: string;
  files: MapFileInfo[];
  error?: string;
}

interface MapFileBrowserProps {
  onMapLoad?: (parsedMap: ParsedMapFile) => void;
  onError?: (error: string) => void;
}

export function MapFileBrowser({ onMapLoad, onError }: MapFileBrowserProps) {
  const [files, setFiles] = useState<MapFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [basePath, setBasePath] = useState<string>('');

  const fetchMapFiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/map-files');
      const data: MapFilesResponse = await response.json();

      if (data.success) {
        setFiles(data.files);
        setBasePath(data.basePath || '');
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch map files');
        setFiles([]);
        if (onError) {
          onError(data.error || 'Failed to fetch map files');
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setFiles([]);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapFiles();
  }, []);

  const loadMapFile = async (file: MapFileInfo) => {
    setLoadingFile(file.filename);
    setError(null);

    try {
      // Fetch the map file
      const response = await fetch(file.path);

      if (!response.ok) {
        throw new Error(`Failed to fetch map file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Parse the map file
      const parsedMap = await parseMapFile(file.filename, arrayBuffer);

      if (onMapLoad) {
        onMapLoad(parsedMap);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load ${file.filename}: ${errorMsg}`);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoadingFile(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleString();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapIcon className="w-6 h-6 text-blue-500" />
            <div>
              <CardTitle>TrinityCore Map Files</CardTitle>
              <CardDescription>
                {basePath ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Folder className="w-4 h-4" />
                    <span className="font-mono text-xs">{basePath}</span>
                  </div>
                ) : (
                  'Browse and load extracted .map files'
                )}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMapFiles}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                  Configuration Error
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mb-2">{error}</p>
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded font-mono">
                  To fix: Add MAP_FILES_PATH to your .env.local file
                  <br />
                  Example: MAP_FILES_PATH=/path/to/TrinityCore/data/maps
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-600 dark:text-slate-400">
              Loading map files...
            </span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <MapIcon className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              {error ? 'Unable to load map files' : 'No map files found'}
            </p>
            {!error && (
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                Make sure MAP_FILES_PATH is configured and contains .map files
              </p>
            )}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Map Name</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.filename}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        {file.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {file.filename}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatFileSize(file.size)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(file.modified)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => loadMapFile(file)}
                        disabled={loadingFile === file.filename}
                      >
                        {loadingFile === file.filename ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Load
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Found {files.length} map file{files.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
