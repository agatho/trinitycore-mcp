/**
 * Chart Wrapper Component
 * Common wrapper for all chart types with loading and error states
 */

import React from 'react';

export interface ChartWrapperProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ChartWrapper({
  title,
  description,
  loading,
  error,
  children,
  actions,
}: ChartWrapperProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading chart data...</div>
        </div>
      )}

      {error && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {!loading && !error && children}
    </div>
  );
}
