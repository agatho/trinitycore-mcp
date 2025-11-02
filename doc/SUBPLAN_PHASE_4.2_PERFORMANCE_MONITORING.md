# TrinityCore MCP Server - Phase 4.2: Performance Monitoring & Analytics

**Document Version:** 1.0
**Created:** October 31, 2025
**Phase:** 4.2 - Performance Monitoring & Analytics
**Duration:** 6 weeks
**Priority:** MEDIUM
**Status:** Planning Complete

---

## 📋 Executive Summary

### Objective

Implement enterprise-grade performance monitoring and analytics infrastructure using Prometheus + Grafana, enabling real-time visibility into MCP server health, bottleneck detection, and production readiness for deployment.

### Scope

- **Prometheus Integration**: Metrics collection via /metrics endpoint
- **prom-client Library**: Node.js instrumentation
- **Grafana Dashboards**: Visualization and alerting
- **All 21 MCP Tools**: Per-tool performance tracking
- **Alerting System**: Automated notifications for issues
- **Docker Compose**: Production orchestration

### Success Criteria

✅ 99.9% uptime monitoring
✅ <500ms p95 response time for all tools
✅ Real-time dashboards for all 21 tools
✅ Automated alerting for critical issues
✅ Performance bottleneck identification
✅ Production-ready deployment configuration

### Key Deliverables

1. **MetricsCollector class** - Prometheus metrics wrapper
2. **express-prom-bundle middleware** - Automated HTTP instrumentation
3. **Grafana dashboards** - Overview + per-tool dashboards (22 total)
4. **Alerting rules** - Response time, error rate, memory thresholds
5. **Docker Compose** - Orchestrated deployment (MCP + Prometheus + Grafana)
6. **Performance reports** - Baseline metrics for all tools
7. **Documentation** - Setup guide, dashboard guide, troubleshooting

### Timeline & Resources

- **Duration**: 6 weeks
- **Effort**: ~120 hours total (~20 hours/week)
- **Dependencies**: prom-client, express middleware, Grafana, Docker
- **Risk Level**: Low (well-established monitoring stack)

---

## 🎯 Background & Motivation

### Current Limitations

The TrinityCore MCP Server currently has **no performance monitoring**:

- ❌ No visibility into response times
- ❌ No error rate tracking
- ❌ No resource usage monitoring
- ❌ No bottleneck identification
- ❌ No alerting for production issues
- ❌ Reactive debugging instead of proactive monitoring

### Problem Statement

Without monitoring:
- **Blind deployment**: No visibility after production launch
- **Slow issue detection**: Problems discovered by users, not metrics
- **No capacity planning**: Unknown server limits
- **Difficult debugging**: No historical performance data
- **No SLA enforcement**: Cannot guarantee performance targets

### Value Proposition

Performance monitoring provides:
- ✅ **Real-time visibility** into all 21 MCP tools
- ✅ **Proactive alerting** for issues before users notice
- ✅ **Performance optimization** via bottleneck identification
- ✅ **Capacity planning** with resource usage trends
- ✅ **SLA compliance** monitoring (99.9% uptime, <500ms p95)
- ✅ **Historical analysis** for trend detection

---

## 🔍 Technical Specifications

### Monitoring Stack

**Architecture:**
```
┌─────────────────┐
│ MCP Server      │
│ Node.js + TS    │
│ Port: 3000      │
│ /metrics        │ <--- Prometheus scrapes every 15s
└─────────────────┘
        ↓
┌─────────────────┐
│ Prometheus      │
│ Time-series DB  │
│ Port: 9090      │ <--- Stores metrics
└─────────────────┘
        ↓
┌─────────────────┐
│ Grafana         │
│ Visualization   │
│ Port: 3001      │ <--- Displays dashboards
└─────────────────┘
```

### Prometheus Metrics

**Metric Types:**

1. **Counter** - Monotonically increasing (requests, errors)
2. **Gauge** - Current value (memory, active connections)
3. **Histogram** - Distribution (response times, request sizes)
4. **Summary** - Similar to histogram with quantiles

**MCP-Specific Metrics:**

```typescript
// Request metrics
mcp_tool_requests_total{tool="get-spell-info", status="success|error"}
mcp_tool_request_duration_seconds{tool="get-spell-info", quantile="0.5|0.9|0.99"}

// System metrics
mcp_memory_usage_bytes{type="heap_used|heap_total|external"}
mcp_active_connections{type="http|websocket"}
mcp_cache_hits_total{cache="dbc|redis"}
mcp_cache_misses_total{cache="dbc|redis"}
mcp_database_queries_total{query_type="select|insert|update"}
mcp_database_query_duration_seconds{query_type="select"}

// Error metrics
mcp_errors_total{tool="get-spell-info", error_type="database|cache|parse"}
mcp_timeout_total{tool="optimize-quest-route"}
```

---

## 📅 Week-by-Week Implementation Plan

### Week 1: Prometheus Setup & Metrics Endpoint

**Objectives:**
- Install Prometheus and configure scraping
- Implement /metrics endpoint
- Set up prom-client library
- Basic metrics collection

**Tasks:**

1. **Install Dependencies** (2 hours)
   ```bash
   npm install prom-client express-prom-bundle
   npm install --save-dev @types/prom-client
   ```

2. **Create MetricsCollector Class** (6 hours)
   ```typescript
   // src/monitoring/MetricsCollector.ts
   import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

   export class MetricsCollector {
     private static instance: MetricsCollector;
     private registry: Registry;

     // Tool request metrics
     private toolRequestsTotal: Counter;
     private toolRequestDuration: Histogram;
     private toolErrors: Counter;

     // System metrics
     private memoryUsage: Gauge;
     private activeConnections: Gauge;

     // Cache metrics
     private cacheHits: Counter;
     private cacheMisses: Counter;

     // Database metrics
     private dbQueries: Counter;
     private dbQueryDuration: Histogram;

     private constructor() {
       this.registry = new Registry();

       // Collect default Node.js metrics (CPU, memory, GC)
       collectDefaultMetrics({
         register: this.registry,
         prefix: 'mcp_',
       });

       // Tool request counter
       this.toolRequestsTotal = new Counter({
         name: 'mcp_tool_requests_total',
         help: 'Total number of tool requests',
         labelNames: ['tool', 'status'],
         registers: [this.registry],
       });

       // Tool request duration histogram
       this.toolRequestDuration = new Histogram({
         name: 'mcp_tool_request_duration_seconds',
         help: 'Tool request duration in seconds',
         labelNames: ['tool'],
         buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
         registers: [this.registry],
       });

       // Tool error counter
       this.toolErrors = new Counter({
         name: 'mcp_errors_total',
         help: 'Total number of errors',
         labelNames: ['tool', 'error_type'],
         registers: [this.registry],
       });

       // Memory usage gauge
       this.memoryUsage = new Gauge({
         name: 'mcp_memory_usage_bytes',
         help: 'Memory usage in bytes',
         labelNames: ['type'],
         registers: [this.registry],
         collect() {
           const mem = process.memoryUsage();
           this.labels('heap_used').set(mem.heapUsed);
           this.labels('heap_total').set(mem.heapTotal);
           this.labels('external').set(mem.external);
           this.labels('rss').set(mem.rss);
         },
       });

       // Active connections gauge
       this.activeConnections = new Gauge({
         name: 'mcp_active_connections',
         help: 'Number of active connections',
         labelNames: ['type'],
         registers: [this.registry],
       });

       // Cache metrics
       this.cacheHits = new Counter({
         name: 'mcp_cache_hits_total',
         help: 'Total cache hits',
         labelNames: ['cache'],
         registers: [this.registry],
       });

       this.cacheMisses = new Counter({
         name: 'mcp_cache_misses_total',
         help: 'Total cache misses',
         labelNames: ['cache'],
         registers: [this.registry],
       });

       // Database metrics
       this.dbQueries = new Counter({
         name: 'mcp_database_queries_total',
         help: 'Total database queries',
         labelNames: ['query_type'],
         registers: [this.registry],
       });

       this.dbQueryDuration = new Histogram({
         name: 'mcp_database_query_duration_seconds',
         help: 'Database query duration in seconds',
         labelNames: ['query_type'],
         buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
         registers: [this.registry],
       });
     }

     public static getInstance(): MetricsCollector {
       if (!MetricsCollector.instance) {
         MetricsCollector.instance = new MetricsCollector();
       }
       return MetricsCollector.instance;
     }

     public getRegistry(): Registry {
       return this.registry;
     }

     // Tool request tracking
     public recordToolRequest(tool: string, status: 'success' | 'error', duration: number): void {
       this.toolRequestsTotal.inc({ tool, status });
       this.toolRequestDuration.observe({ tool }, duration);
     }

     public recordToolError(tool: string, errorType: string): void {
       this.toolErrors.inc({ tool, error_type: errorType });
     }

     // Cache tracking
     public recordCacheHit(cache: string): void {
       this.cacheHits.inc({ cache });
     }

     public recordCacheMiss(cache: string): void {
       this.cacheMisses.inc({ cache });
     }

     // Database tracking
     public recordDatabaseQuery(queryType: string, duration: number): void {
       this.dbQueries.inc({ query_type: queryType });
       this.dbQueryDuration.observe({ query_type: queryType }, duration);
     }

     // Connection tracking
     public setActiveConnections(type: string, count: number): void {
       this.activeConnections.labels(type).set(count);
     }

     // Get metrics in Prometheus format
     public async getMetrics(): Promise<string> {
       return await this.registry.metrics();
     }
   }
   ```

3. **Add /metrics Endpoint** (4 hours)
   ```typescript
   // Update src/index.ts
   import express from 'express';
   import { MetricsCollector } from './monitoring/MetricsCollector';

   const app = express();
   const metrics = MetricsCollector.getInstance();

   // Metrics endpoint
   app.get('/metrics', async (req, res) => {
     try {
       res.set('Content-Type', metrics.getRegistry().contentType);
       res.end(await metrics.getMetrics());
     } catch (error) {
       res.status(500).end(error);
     }
   });

   // Health check endpoint
   app.get('/health', (req, res) => {
     res.json({
       status: 'healthy',
       uptime: process.uptime(),
       timestamp: new Date().toISOString(),
     });
   });

   app.listen(3000, () => {
     console.log('MCP Server running on port 3000');
     console.log('Metrics available at http://localhost:3000/metrics');
   });
   ```

4. **Prometheus Configuration** (4 hours)
   ```yaml
   # prometheus.yml
   global:
     scrape_interval: 15s
     evaluation_interval: 15s
     external_labels:
       cluster: 'trinitycore-mcp'
       environment: 'production'

   scrape_configs:
     - job_name: 'mcp-server'
       static_configs:
         - targets: ['mcp-server:3000']
           labels:
             service: 'trinitycore-mcp'

       metrics_path: '/metrics'
       scrape_interval: 15s
       scrape_timeout: 10s
   ```

5. **Docker Compose** (4 hours)
   ```yaml
   # docker-compose.monitoring.yml
   version: '3.8'

   services:
     mcp-server:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
       networks:
         - monitoring

     prometheus:
       image: prom/prometheus:latest
       ports:
         - "9090:9090"
       volumes:
         - ./prometheus.yml:/etc/prometheus/prometheus.yml
         - prometheus-data:/prometheus
       command:
         - '--config.file=/etc/prometheus/prometheus.yml'
         - '--storage.tsdb.path=/prometheus'
         - '--storage.tsdb.retention.time=30d'
       networks:
         - monitoring

   networks:
     monitoring:
       driver: bridge

   volumes:
     prometheus-data:
   ```

**Deliverables:**
- ✅ MetricsCollector class
- ✅ /metrics endpoint
- ✅ Prometheus configured and scraping
- ✅ Docker Compose setup

---

### Week 2: prom-client Integration & Basic Metrics

**Objectives:**
- Integrate express-prom-bundle middleware
- Add per-tool metrics
- Instrument database queries
- Instrument cache operations

**Tasks:**

1. **Middleware Integration** (6 hours)
   ```typescript
   // src/middleware/monitoring.ts
   import promBundle from 'express-prom-bundle';
   import { MetricsCollector } from '../monitoring/MetricsCollector';

   export function setupMonitoring(app: Express): void {
     const metrics = MetricsCollector.getInstance();

     // Express metrics middleware
     const metricsMiddleware = promBundle({
       includeMethod: true,
       includePath: true,
       includeStatusCode: true,
       includeUp: true,
       customLabels: { service: 'trinitycore-mcp' },
       promClient: {
         collectDefaultMetrics: {
           register: metrics.getRegistry(),
         },
       },
     });

     app.use(metricsMiddleware);

     // Custom request logger
     app.use((req, res, next) => {
       const start = Date.now();

       res.on('finish', () => {
         const duration = (Date.now() - start) / 1000;
         const tool = req.path.replace('/api/v1/', '');
         const status = res.statusCode < 400 ? 'success' : 'error';

         metrics.recordToolRequest(tool, status, duration);
       });

       next();
     });
   }
   ```

2. **Per-Tool Instrumentation** (8 hours)
   ```typescript
   // src/tools/spell.ts - Example instrumentation
   import { MetricsCollector } from '../monitoring/MetricsCollector';

   const metrics = MetricsCollector.getInstance();

   export async function getSpellInfo(spellId: number): Promise<SpellInfo> {
     const start = Date.now();
     const toolName = 'get-spell-info';

     try {
       // Existing implementation...
       const result = await fetchSpellFromDB(spellId);

       // Record success
       const duration = (Date.now() - start) / 1000;
       metrics.recordToolRequest(toolName, 'success', duration);

       return result;
     } catch (error) {
       // Record error
       const duration = (Date.now() - start) / 1000;
       metrics.recordToolRequest(toolName, 'error', duration);
       metrics.recordToolError(toolName, error.name || 'unknown');

       throw error;
     }
   }
   ```

3. **Database Instrumentation** (4 hours)
   ```typescript
   // src/database/connection.ts
   import { MetricsCollector } from '../monitoring/MetricsCollector';

   const metrics = MetricsCollector.getInstance();

   export async function queryWorld(query: string, params?: any[]): Promise<any[]> {
     const start = Date.now();
     const queryType = query.trim().split(' ')[0].toLowerCase(); // SELECT, INSERT, etc.

     try {
       const result = await pool.query(query, params);

       const duration = (Date.now() - start) / 1000;
       metrics.recordDatabaseQuery(queryType, duration);

       return result[0];
     } catch (error) {
       const duration = (Date.now() - start) / 1000;
       metrics.recordDatabaseQuery(queryType, duration);
       metrics.recordToolError('database', error.code || 'unknown');

       throw error;
     }
   }
   ```

4. **Cache Instrumentation** (2 hours)
   ```typescript
   // src/parsers/cache/RecordCache.ts
   import { MetricsCollector } from '../../monitoring/MetricsCollector';

   const metrics = MetricsCollector.getInstance();

   export class RecordCache {
     public async get(cacheKey: string): Promise<any | null> {
       const cached = await this.redis.get(cacheKey);

       if (cached) {
         metrics.recordCacheHit('dbc');
         return JSON.parse(cached);
       } else {
         metrics.recordCacheMiss('dbc');
         return null;
       }
     }
   }
   ```

**Deliverables:**
- ✅ Middleware integrated
- ✅ All 21 tools instrumented
- ✅ Database queries tracked
- ✅ Cache operations tracked

---

### Week 3: Grafana Setup & Overview Dashboard

**Objectives:**
- Install Grafana
- Create overview dashboard
- Connect to Prometheus
- Configure data sources

**Tasks:**

1. **Grafana Docker Setup** (3 hours)
   ```yaml
   # Update docker-compose.monitoring.yml
   services:
     grafana:
       image: grafana/grafana:latest
       ports:
         - "3001:3000"
       environment:
         - GF_SECURITY_ADMIN_PASSWORD=admin
         - GF_USERS_ALLOW_SIGN_UP=false
       volumes:
         - grafana-data:/var/lib/grafana
         - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
         - ./grafana/datasources:/etc/grafana/provisioning/datasources
       networks:
         - monitoring
       depends_on:
         - prometheus

   volumes:
     grafana-data:
   ```

2. **Prometheus Data Source** (2 hours)
   ```yaml
   # grafana/datasources/prometheus.yml
   apiVersion: 1

   datasources:
     - name: Prometheus
       type: prometheus
       access: proxy
       url: http://prometheus:9090
       isDefault: true
       editable: false
   ```

3. **Overview Dashboard** (10 hours)
   Create `grafana/dashboards/overview.json` with panels:

   **Row 1: System Health**
   - Uptime (Counter)
   - Active Connections (Gauge)
   - Memory Usage (Graph)
   - CPU Usage (Graph)

   **Row 2: Request Metrics**
   - Total Requests (Counter)
   - Requests/sec (Graph)
   - Success Rate (Graph)
   - Error Rate (Graph)

   **Row 3: Performance**
   - Response Time p50 (Graph)
   - Response Time p95 (Graph)
   - Response Time p99 (Graph)
   - Slowest Tools (Table)

   **Row 4: Top Tools**
   - Most Called Tools (Bar Chart)
   - Errors by Tool (Bar Chart)
   - Average Response Time by Tool (Bar Chart)

   **Row 5: Database & Cache**
   - Database Queries/sec (Graph)
   - DB Query Duration p95 (Graph)
   - Cache Hit Rate (Graph)
   - Cache Misses/sec (Graph)

4. **Dashboard Provisioning** (3 hours)
   ```yaml
   # grafana/dashboards/dashboards.yml
   apiVersion: 1

   providers:
     - name: 'TrinityCore MCP'
       orgId: 1
       folder: ''
       type: file
       disableDeletion: false
       updateIntervalSeconds: 10
       options:
         path: /etc/grafana/provisioning/dashboards
   ```

5. **Testing** (2 hours)
   - Verify dashboard displays correctly
   - Test all panels load data
   - Validate time ranges
   - Export dashboard JSON

**Deliverables:**
- ✅ Grafana running
- ✅ Prometheus data source configured
- ✅ Overview dashboard created
- ✅ Dashboard provisioning working

---

### Week 4: Per-Tool Dashboards & Alerting Rules

**Objectives:**
- Create 21 per-tool dashboards
- Define alerting rules
- Configure notification channels
- Test alert delivery

**Tasks:**

1. **Per-Tool Dashboard Template** (8 hours)
   Create template for each of 21 tools:

   **Dashboard Structure:**
   - Tool Name Header
   - Request Count (Counter)
   - Request Rate (Graph)
   - Response Time Distribution (Heatmap)
   - Success/Error Rate (Graph)
   - Recent Errors (Table)
   - Related Metrics (tool-specific)

   **Example: get-spell-info Dashboard**
   ```json
   {
     "dashboard": {
       "title": "get-spell-info Performance",
       "panels": [
         {
           "title": "Request Rate",
           "targets": [{
             "expr": "rate(mcp_tool_requests_total{tool=\"get-spell-info\"}[5m])"
           }]
         },
         {
           "title": "Response Time p95",
           "targets": [{
             "expr": "histogram_quantile(0.95, rate(mcp_tool_request_duration_seconds_bucket{tool=\"get-spell-info\"}[5m]))"
           }]
         }
       ]
     }
   }
   ```

2. **Alerting Rules** (6 hours)
   ```yaml
   # prometheus/alerts.yml
   groups:
     - name: mcp_alerts
       interval: 30s
       rules:
         # High response time
         - alert: HighResponseTime
           expr: histogram_quantile(0.95, rate(mcp_tool_request_duration_seconds_bucket[5m])) > 1
           for: 5m
           labels:
             severity: warning
           annotations:
             summary: "High response time detected"
             description: "Tool {{ $labels.tool }} has p95 response time > 1s"

         # High error rate
         - alert: HighErrorRate
           expr: rate(mcp_errors_total[5m]) > 0.01
           for: 5m
           labels:
             severity: critical
           annotations:
             summary: "High error rate detected"
             description: "Tool {{ $labels.tool }} has error rate > 1%"

         # High memory usage
         - alert: HighMemoryUsage
           expr: mcp_memory_usage_bytes{type="heap_used"} > 500000000
           for: 5m
           labels:
             severity: warning
           annotations:
             summary: "High memory usage"
             description: "Heap usage > 500MB"

         # Low cache hit rate
         - alert: LowCacheHitRate
           expr: rate(mcp_cache_hits_total[5m]) / (rate(mcp_cache_hits_total[5m]) + rate(mcp_cache_misses_total[5m])) < 0.7
           for: 10m
           labels:
             severity: warning
           annotations:
             summary: "Low cache hit rate"
             description: "Cache hit rate < 70%"

         # Database query latency
         - alert: SlowDatabaseQueries
           expr: histogram_quantile(0.95, rate(mcp_database_query_duration_seconds_bucket[5m])) > 0.5
           for: 5m
           labels:
             severity: warning
           annotations:
             summary: "Slow database queries"
             description: "p95 DB query time > 500ms"
   ```

3. **Notification Channels** (4 hours)
   ```yaml
   # grafana/provisioning/notifiers/slack.yml
   notifiers:
     - name: Slack Alerts
       type: slack
       uid: slack01
       org_id: 1
       is_default: true
       send_reminder: true
       settings:
         url: ${SLACK_WEBHOOK_URL}
         recipient: '#mcp-alerts'
         username: 'Grafana'
   ```

4. **Testing Alerts** (2 hours)
   - Trigger high response time alert
   - Trigger error rate alert
   - Verify Slack notifications
   - Test alert resolution

**Deliverables:**
- ✅ 21 per-tool dashboards
- ✅ 5 alerting rules
- ✅ Notification channels configured
- ✅ Alerts tested and working

---

### Week 5: Performance Optimization & Baseline Metrics

**Objectives:**
- Establish baseline performance metrics
- Identify bottlenecks
- Optimize slow tools
- Document performance targets

**Tasks:**

1. **Baseline Metrics Collection** (8 hours)
   Run comprehensive performance tests for all 21 tools:

   ```typescript
   // tests/performance/baseline.test.ts
   import { MetricsCollector } from '../src/monitoring/MetricsCollector';

   describe('Performance Baseline', () => {
     const tools = [
       'get-spell-info',
       'get-item-info',
       // ... all 21 tools
     ];

     for (const tool of tools) {
       test(`${tool} performance`, async () => {
         const samples = 1000;
         const durations: number[] = [];

         for (let i = 0; i < samples; i++) {
           const start = Date.now();
           await callTool(tool);
           durations.push(Date.now() - start);
         }

         const p50 = percentile(durations, 0.5);
         const p95 = percentile(durations, 0.95);
         const p99 = percentile(durations, 0.99);

         console.log(`${tool}: p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`);

         expect(p95).toBeLessThan(500); // Target: <500ms p95
       });
     }
   });
   ```

2. **Bottleneck Identification** (6 hours)
   - Analyze slow tools (p95 > 500ms)
   - Profile database queries
   - Check cache hit rates
   - Identify expensive operations

3. **Performance Optimization** (4 hours)
   - Add database indices
   - Optimize query complexity
   - Increase cache coverage
   - Reduce unnecessary calculations

4. **Performance Report** (2 hours)
   Create `doc/PERFORMANCE_BASELINE.md`:

   | Tool                    | p50   | p95   | p99   | Target Met |
   |-------------------------|-------|-------|-------|------------|
   | get-spell-info          | 45ms  | 120ms | 180ms | ✅         |
   | get-item-info           | 50ms  | 130ms | 200ms | ✅         |
   | optimize-quest-route    | 180ms | 380ms | 520ms | ⚠️         |
   | ... (all 21 tools)      |       |       |       |            |

**Deliverables:**
- ✅ Baseline metrics for all 21 tools
- ✅ Bottleneck analysis report
- ✅ Performance optimizations applied
- ✅ Performance baseline document

---

### Week 6: Documentation, Testing, & Deployment

**Objectives:**
- Complete documentation
- End-to-end testing
- Production deployment guide
- Troubleshooting guide

**Tasks:**

1. **Setup Guide** (4 hours)
   Create `doc/MONITORING_SETUP_GUIDE.md`:
   - Prerequisites
   - Installation steps
   - Configuration
   - Docker Compose deployment

2. **Dashboard Guide** (4 hours)
   Create `doc/GRAFANA_DASHBOARD_GUIDE.md`:
   - Overview dashboard walkthrough
   - Per-tool dashboard usage
   - Custom queries
   - Dashboard customization

3. **Alerting Guide** (3 hours)
   Create `doc/ALERTING_GUIDE.md`:
   - Alert rules explained
   - Notification channels
   - Alert thresholds
   - Alert response procedures

4. **Troubleshooting Guide** (3 hours)
   Create `doc/MONITORING_TROUBLESHOOTING.md`:
   - Common issues
   - Debug procedures
   - Performance tuning
   - FAQ

5. **End-to-End Testing** (4 hours)
   - Deploy full stack (MCP + Prometheus + Grafana)
   - Generate test load
   - Verify all dashboards
   - Trigger and resolve alerts

6. **Production Deployment** (2 hours)
   ```bash
   # Deployment script
   ./scripts/deploy-monitoring.sh

   # Includes:
   # - Docker Compose up
   # - Health checks
   # - Dashboard provisioning
   # - Alert rule loading
   ```

**Deliverables:**
- ✅ Complete documentation (4 guides)
- ✅ E2E tests passing
- ✅ Deployment script
- ✅ Production-ready configuration

---

## 🎯 Success Metrics

### Quantitative Targets

| Metric                   | Target  | Measurement Method            |
|--------------------------|---------|-------------------------------|
| Uptime                   | 99.9%   | Prometheus up metric          |
| Response time (p50)      | <200ms  | Tool request duration         |
| Response time (p95)      | <500ms  | Tool request duration         |
| Response time (p99)      | <1000ms | Tool request duration         |
| Error rate               | <0.1%   | Errors / total requests       |
| Cache hit rate           | >80%    | Cache hits / (hits + misses)  |
| Database query time (p95)| <100ms  | DB query duration             |
| Dashboard load time      | <2s     | Grafana page load             |

### Dashboard Completeness

- ✅ 1 overview dashboard (system-wide metrics)
- ✅ 21 per-tool dashboards (one per MCP tool)
- ✅ 5 alerting rules (response time, errors, memory, cache, DB)
- ✅ Slack notification integration

---

## 📦 Dependencies

### New Dependencies

```json
{
  "dependencies": {
    "prom-client": "^15.1.0",
    "express-prom-bundle": "^7.0.0"
  },
  "devDependencies": {
    "@types/prom-client": "^5.0.0"
  }
}
```

### Docker Images

- **Prometheus**: `prom/prometheus:latest`
- **Grafana**: `grafana/grafana:latest`

---

## ⚠️ Risk Assessment

### Low Risk

**Risk:** Minimal performance overhead from metrics collection
**Mitigation:** prom-client is highly optimized, <1% CPU overhead

**Risk:** Dashboard customization learning curve
**Mitigation:** Provide comprehensive examples and documentation

---

## ✅ Acceptance Criteria

Phase 4.2 is considered **complete** when:

1. ✅ Prometheus scraping /metrics endpoint successfully
2. ✅ All 21 tools instrumented with metrics
3. ✅ Grafana displaying all dashboards
4. ✅ 5 alerting rules active
5. ✅ Baseline performance documented
6. ✅ 99.9% uptime monitoring operational
7. ✅ <500ms p95 response time achieved
8. ✅ Documentation complete
9. ✅ Production deployment successful
10. ✅ E2E tests passing

---

**Document Version:** 1.0
**Last Updated:** October 31, 2025
**Status:** ✅ Planning Complete - Ready for Implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)
