import { EventEmitter } from 'events';

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

/**
 * Time series data point
 */
export interface DataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

/**
 * Metric definition
 */
export interface Metric {
  name: string;
  type: MetricType;
  description?: string;
  unit?: string;
  labels?: string[];
}

/**
 * Histogram bucket configuration
 */
export interface HistogramBucket {
  le: number;
  count: number;
}

/**
 * Histogram data
 */
export interface HistogramData {
  count: number;
  sum: number;
  buckets: HistogramBucket[];
}

/**
 * Summary quantile
 */
export interface SummaryQuantile {
  quantile: number;
  value: number;
}

/**
 * Summary data
 */
export interface SummaryData {
  count: number;
  sum: number;
  quantiles: SummaryQuantile[];
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  name: string;
  type: MetricType;
  data: number | HistogramData | SummaryData;
  labels?: Record<string, string>;
  timestamp: Date;
}

/**
 * Metrics query options
 */
export interface MetricsQueryOptions {
  startTime?: Date;
  endTime?: Date;
  labels?: Record<string, string>;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  interval?: number;
}

/**
 * Metrics export format
 */
export enum ExportFormat {
  JSON = 'json',
  PROMETHEUS = 'prometheus',
  CSV = 'csv'
}

/**
 * Enterprise-grade metrics collector
 * Collects, aggregates, and exports performance metrics
 */
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric> = new Map();
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, HistogramData>> = new Map();
  private summaries: Map<string, Map<string, SummaryData>> = new Map();
  private timeSeries: Map<string, DataPoint[]> = new Map();
  private retentionPeriod: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(retentionPeriod?: number) {
    super();
    if (retentionPeriod) {
      this.retentionPeriod = retentionPeriod;
    }
    this.startCleanupInterval();
  }

  /**
   * Register a metric
   */
  public registerMetric(metric: Metric): void {
    this.metrics.set(metric.name, metric);
    
    switch (metric.type) {
      case MetricType.COUNTER:
        this.counters.set(metric.name, new Map());
        break;
      case MetricType.GAUGE:
        this.gauges.set(metric.name, new Map());
        break;
      case MetricType.HISTOGRAM:
        this.histograms.set(metric.name, new Map());
        break;
      case MetricType.SUMMARY:
        this.summaries.set(metric.name, new Map());
        break;
    }

    this.timeSeries.set(metric.name, []);
    this.emit('metric-registered', { metric });
  }

  /**
   * Increment counter
   */
  public incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.COUNTER) {
      throw new Error(`Counter metric not found: ${name}`);
    }

    const labelKey = this.getLabelKey(labels);
    const counterMap = this.counters.get(name)!;
    const currentValue = counterMap.get(labelKey) || 0;
    const newValue = currentValue + value;
    counterMap.set(labelKey, newValue);

    this.recordDataPoint(name, newValue, labels);
    this.emit('counter-incremented', { name, value, labels, total: newValue });
  }

  /**
   * Set gauge value
   */
  public setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.GAUGE) {
      throw new Error(`Gauge metric not found: ${name}`);
    }

    const labelKey = this.getLabelKey(labels);
    const gaugeMap = this.gauges.get(name)!;
    gaugeMap.set(labelKey, value);

    this.recordDataPoint(name, value, labels);
    this.emit('gauge-set', { name, value, labels });
  }

  /**
   * Observe histogram value
   */
  public observeHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.HISTOGRAM) {
      throw new Error(`Histogram metric not found: ${name}`);
    }

    const labelKey = this.getLabelKey(labels);
    const histogramMap = this.histograms.get(name)!;
    let histogram = histogramMap.get(labelKey);

    if (!histogram) {
      histogram = {
        count: 0,
        sum: 0,
        buckets: buckets.map(le => ({ le, count: 0 }))
      };
      histogramMap.set(labelKey, histogram);
    }

    histogram.count++;
    histogram.sum += value;

    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }

    this.recordDataPoint(name, value, labels);
    this.emit('histogram-observed', { name, value, labels });
  }

  /**
   * Observe summary value
   */
  public observeSummary(
    name: string,
    value: number,
    labels?: Record<string, string>,
    quantiles: number[] = [0.5, 0.9, 0.95, 0.99]
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.SUMMARY) {
      throw new Error(`Summary metric not found: ${name}`);
    }

    const labelKey = this.getLabelKey(labels);
    const summaryMap = this.summaries.get(name)!;
    let summary = summaryMap.get(labelKey);

    if (!summary) {
      summary = {
        count: 0,
        sum: 0,
        quantiles: quantiles.map(q => ({ quantile: q, value: 0 }))
      };
      summaryMap.set(labelKey, summary);
    }

    summary.count++;
    summary.sum += value;

    this.recordDataPoint(name, value, labels);
    this.emit('summary-observed', { name, value, labels });
  }

  /**
   * Record data point in time series
   */
  private recordDataPoint(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const series = this.timeSeries.get(name);
    if (series) {
      series.push({
        timestamp: new Date(),
        value,
        labels
      });
    }
  }

  /**
   * Get label key for map storage
   */
  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '__no_labels__';
    }
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Get counter value
   */
  public getCounter(name: string, labels?: Record<string, string>): number {
    const labelKey = this.getLabelKey(labels);
    return this.counters.get(name)?.get(labelKey) || 0;
  }

  /**
   * Get gauge value
   */
  public getGauge(name: string, labels?: Record<string, string>): number {
    const labelKey = this.getLabelKey(labels);
    return this.gauges.get(name)?.get(labelKey) || 0;
  }

  /**
   * Get histogram data
   */
  public getHistogram(name: string, labels?: Record<string, string>): HistogramData | undefined {
    const labelKey = this.getLabelKey(labels);
    return this.histograms.get(name)?.get(labelKey);
  }

  /**
   * Get summary data
   */
  public getSummary(name: string, labels?: Record<string, string>): SummaryData | undefined {
    const labelKey = this.getLabelKey(labels);
    return this.summaries.get(name)?.get(labelKey);
  }

  /**
   * Calculate summary quantiles
   */
  public calculateQuantiles(name: string, labels?: Record<string, string>): void {
    const summary = this.getSummary(name, labels);
    if (!summary) return;

    const series = this.getTimeSeries(name, { labels, startTime: new Date(Date.now() - 60000) });
    const values = series.map(dp => dp.value).sort((a, b) => a - b);

    for (const q of summary.quantiles) {
      const index = Math.ceil(values.length * q.quantile) - 1;
      q.value = values[Math.max(0, index)] || 0;
    }
  }

  /**
   * Get time series data
   */
  public getTimeSeries(
    name: string,
    options?: MetricsQueryOptions
  ): DataPoint[] {
    const series = this.timeSeries.get(name) || [];
    let filtered = [...series];

    if (options) {
      if (options.startTime) {
        filtered = filtered.filter(dp => dp.timestamp >= options.startTime!);
      }
      if (options.endTime) {
        filtered = filtered.filter(dp => dp.timestamp <= options.endTime!);
      }
      if (options.labels) {
        filtered = filtered.filter(dp => {
          if (!dp.labels) return false;
          return Object.entries(options.labels!).every(
            ([k, v]) => dp.labels![k] === v
          );
        });
      }
    }

    return filtered;
  }

  /**
   * Aggregate time series data
   */
  public aggregateTimeSeries(
    name: string,
    options: MetricsQueryOptions
  ): number {
    const series = this.getTimeSeries(name, options);
    const values = series.map(dp => dp.value);

    if (values.length === 0) return 0;

    switch (options.aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return values[values.length - 1] || 0;
    }
  }

  /**
   * Get all aggregated metrics
   */
  public getAllMetrics(): AggregatedMetrics[] {
    const results: AggregatedMetrics[] = [];

    for (const [name, metric] of this.metrics.entries()) {
      switch (metric.type) {
        case MetricType.COUNTER: {
          const counterMap = this.counters.get(name);
          if (counterMap) {
            for (const [labelKey, value] of counterMap.entries()) {
              results.push({
                name,
                type: MetricType.COUNTER,
                data: value,
                labels: this.parseLabelKey(labelKey),
                timestamp: new Date()
              });
            }
          }
          break;
        }
        case MetricType.GAUGE: {
          const gaugeMap = this.gauges.get(name);
          if (gaugeMap) {
            for (const [labelKey, value] of gaugeMap.entries()) {
              results.push({
                name,
                type: MetricType.GAUGE,
                data: value,
                labels: this.parseLabelKey(labelKey),
                timestamp: new Date()
              });
            }
          }
          break;
        }
        case MetricType.HISTOGRAM: {
          const histogramMap = this.histograms.get(name);
          if (histogramMap) {
            for (const [labelKey, data] of histogramMap.entries()) {
              results.push({
                name,
                type: MetricType.HISTOGRAM,
                data,
                labels: this.parseLabelKey(labelKey),
                timestamp: new Date()
              });
            }
          }
          break;
        }
        case MetricType.SUMMARY: {
          const summaryMap = this.summaries.get(name);
          if (summaryMap) {
            for (const [labelKey, data] of summaryMap.entries()) {
              this.calculateQuantiles(name, this.parseLabelKey(labelKey));
              results.push({
                name,
                type: MetricType.SUMMARY,
                data,
                labels: this.parseLabelKey(labelKey),
                timestamp: new Date()
              });
            }
          }
          break;
        }
      }
    }

    return results;
  }

  /**
   * Parse label key back to object
   */
  private parseLabelKey(labelKey: string): Record<string, string> | undefined {
    if (labelKey === '__no_labels__') {
      return undefined;
    }

    const labels: Record<string, string> = {};
    const pairs = labelKey.split(',');
    
    for (const pair of pairs) {
      const match = pair.match(/^(.+)="(.+)"$/);
      if (match) {
        labels[match[1]] = match[2];
      }
    }

    return labels;
  }

  /**
   * Export metrics in specified format
   */
  public export(format: ExportFormat = ExportFormat.JSON): string {
    const metrics = this.getAllMetrics();

    switch (format) {
      case ExportFormat.JSON:
        return JSON.stringify(metrics, null, 2);
      
      case ExportFormat.PROMETHEUS:
        return this.exportPrometheus(metrics);
      
      case ExportFormat.CSV:
        return this.exportCSV(metrics);
      
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Export to Prometheus format
   */
  private exportPrometheus(metrics: AggregatedMetrics[]): string {
    const lines: string[] = [];

    for (const metric of metrics) {
      const metricDef = this.metrics.get(metric.name);
      if (metricDef?.description) {
        lines.push(`# HELP ${metric.name} ${metricDef.description}`);
      }
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      const labelStr = metric.labels
        ? Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')
        : '';

      if (metric.type === MetricType.HISTOGRAM) {
        const data = metric.data as HistogramData;
        for (const bucket of data.buckets) {
          lines.push(`${metric.name}_bucket{${labelStr},le="${bucket.le}"} ${bucket.count}`);
        }
        lines.push(`${metric.name}_bucket{${labelStr},le="+Inf"} ${data.count}`);
        lines.push(`${metric.name}_sum{${labelStr}} ${data.sum}`);
        lines.push(`${metric.name}_count{${labelStr}} ${data.count}`);
      } else if (metric.type === MetricType.SUMMARY) {
        const data = metric.data as SummaryData;
        for (const quantile of data.quantiles) {
          lines.push(`${metric.name}{${labelStr},quantile="${quantile.quantile}"} ${quantile.value}`);
        }
        lines.push(`${metric.name}_sum{${labelStr}} ${data.sum}`);
        lines.push(`${metric.name}_count{${labelStr}} ${data.count}`);
      } else {
        lines.push(`${metric.name}${labelStr ? `{${labelStr}}` : ''} ${metric.data}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export to CSV format
   */
  private exportCSV(metrics: AggregatedMetrics[]): string {
    const lines: string[] = ['name,type,value,labels,timestamp'];

    for (const metric of metrics) {
      const value = typeof metric.data === 'number'
        ? metric.data
        : JSON.stringify(metric.data);
      const labels = metric.labels ? JSON.stringify(metric.labels) : '';
      lines.push(`${metric.name},${metric.type},${value},${labels},${metric.timestamp.toISOString()}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset metric
   */
  public resetMetric(name: string): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    switch (metric.type) {
      case MetricType.COUNTER:
        this.counters.get(name)?.clear();
        break;
      case MetricType.GAUGE:
        this.gauges.get(name)?.clear();
        break;
      case MetricType.HISTOGRAM:
        this.histograms.get(name)?.clear();
        break;
      case MetricType.SUMMARY:
        this.summaries.get(name)?.clear();
        break;
    }

    this.timeSeries.set(name, []);
    this.emit('metric-reset', { name });
  }

  /**
   * Start cleanup interval for old data
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const cutoff = new Date(Date.now() - this.retentionPeriod);
      
      for (const [name, series] of this.timeSeries.entries()) {
        this.timeSeries.set(
          name,
          series.filter(dp => dp.timestamp > cutoff)
        );
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Get statistics summary
   */
  public getStatistics(): {
    totalMetrics: number;
    counters: number;
    gauges: number;
    histograms: number;
    summaries: number;
    dataPoints: number;
  } {
    let totalDataPoints = 0;
    for (const series of this.timeSeries.values()) {
      totalDataPoints += series.length;
    }

    return {
      totalMetrics: this.metrics.size,
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      summaries: this.summaries.size,
      dataPoints: totalDataPoints
    };
  }

  /**
   * Shutdown metrics collector
   */
  public shutdown(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.timeSeries.clear();
    this.emit('shutdown');
  }
}

/**
 * Global metrics collector instance
 */
let globalMetricsCollector: MetricsCollector | null = null;

/**
 * Get or create global metrics collector
 */
export function getMetricsCollector(retentionPeriod?: number): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector(retentionPeriod);
  }
  return globalMetricsCollector;
}

/**
 * Set global metrics collector
 */
export function setMetricsCollector(collector: MetricsCollector): void {
  globalMetricsCollector = collector;
}
