/**
 * Validation Panel Component
 *
 * Displays validation results with errors, warnings, and info messages.
 * Real-time feedback for SAI script validation.
 */

'use client';

import React from 'react';
import { ValidationResult, ValidationError, ValidationWarning, ValidationInfo } from '@/lib/sai-unified/types';
import { getValidationSummary } from '@/lib/sai-unified/validation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, AlertTriangle, Info as InfoIcon, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ValidationPanelProps {
  validation: ValidationResult | null;
  onNodeClick?: (nodeId: string) => void;
  onClose?: () => void;
  className?: string;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  validation,
  onNodeClick,
  onClose,
  className = '',
}) => {
  if (!validation) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <InfoIcon className="h-5 w-5" />
            Validation
          </CardTitle>
          <CardDescription>No validation results yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Edit your script to see validation feedback
          </p>
        </CardContent>
      </Card>
    );
  }

  const summary = getValidationSummary(validation);
  const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0;

  const renderError = (error: ValidationError, index: number) => (
    <div
      key={index}
      className="p-3 border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950 space-y-1 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
      onClick={() => error.nodeId && onNodeClick?.(error.nodeId)}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error.message}
          </p>
          {error.parameter && (
            <Badge variant="outline" className="text-xs mt-1 border-red-300 text-red-700 dark:text-red-300">
              Parameter: {error.parameter}
            </Badge>
          )}
          {error.suggestion && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              💡 {error.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderWarning = (warning: ValidationWarning, index: number) => (
    <div
      key={index}
      className="p-3 border border-yellow-200 dark:border-yellow-900 rounded-lg bg-yellow-50 dark:bg-yellow-950 space-y-1 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
      onClick={() => warning.nodeId && onNodeClick?.(warning.nodeId)}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {warning.message}
          </p>
          {warning.parameter && (
            <Badge variant="outline" className="text-xs mt-1 border-yellow-300 text-yellow-700 dark:text-yellow-300">
              Parameter: {warning.parameter}
            </Badge>
          )}
          {warning.suggestion && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              💡 {warning.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderInfo = (info: ValidationInfo, index: number) => (
    <div
      key={index}
      className="p-3 border border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50 dark:bg-blue-950 space-y-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
      onClick={() => info.nodeId && onNodeClick?.(info.nodeId)}
    >
      <div className="flex items-start gap-2">
        <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {info.message}
          </p>
          {info.suggestion && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              💡 {info.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Validation
            </CardTitle>
            <CardDescription>{summary}</CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Score Badge */}
        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant={(validation.score ?? 0) >= 90 ? 'default' : (validation.score ?? 0) >= 70 ? 'secondary' : 'destructive'}
            className="text-sm"
          >
            Score: {validation.score ?? 0}/100
          </Badge>
          {validation.valid && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-600">
              Ready to export
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!hasIssues && validation.info.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              Script is valid!
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              No errors, warnings, or suggestions
            </p>
          </div>
        ) : (
          <Tabs defaultValue="errors" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="errors" className="text-xs">
                Errors
                {validation.errors.length > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    {validation.errors.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="warnings" className="text-xs">
                Warnings
                {validation.warnings.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {validation.warnings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="info" className="text-xs">
                Info
                {validation.info.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {validation.info.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="errors" className="mt-4">
              <ScrollArea className="h-[300px] pr-4">
                {validation.errors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No errors found
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validation.errors.map((error, index) => renderError(error, index))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="warnings" className="mt-4">
              <ScrollArea className="h-[300px] pr-4">
                {validation.warnings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No warnings found
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validation.warnings.map((warning, index) => renderWarning(warning, index))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="info" className="mt-4">
              <ScrollArea className="h-[300px] pr-4">
                {validation.info.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <InfoIcon className="h-8 w-8 text-blue-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No suggestions available
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validation.info.map((info, index) => renderInfo(info, index))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationPanel;
