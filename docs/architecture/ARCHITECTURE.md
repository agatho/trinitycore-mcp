# TrinityCore MCP Architecture

## System Overview

TrinityCore MCP is an enterprise-grade Model Context Protocol server that provides comprehensive access to TrinityCore game server data and functionality through a modern RESTful API with advanced features including distributed tracing, metrics collection, security hardening, and high availability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Web UI  │  CLI Tools  │  External APIs  │  MCP Clients        │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                      Load Balancer (Nginx)                       │
│                    SSL/TLS Termination                          │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                      Security Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  Rate Limiter  │  Auth/API Keys  │  Input Validation  │  WAF    │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                      Application Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  API Router  │  Middleware  │  Controllers  │  Services          │
└─────┬───────┬───────┬───────┬───────┬───────┬──────────────────┘
      │       │       │       │       │       │
┌─────▼───┐ ┌─▼─────┐ ┌─▼───┐ ┌─▼───┐ ┌─▼───┐ ┌─▼──────┐
│ VMap    │ │ MMap  │ │Maps │ │Items│ │Quest│ │Creature│
│ Manager │ │Manager│ │ Svc │ │ Svc │ │ Svc │ │  Svc   │
└─────┬───┘ └───┬───┘ └──┬──┘ └──┬──┘ └──┬──┘ └────┬───┘
      │         │        │       │       │         │
┌─────▼─────────▼────────▼───────▼───────▼─────────▼─────┐
│                    Data Access Layer                     │
├──────────────────────────────────────────────────────────┤
│  Connection Pool  │  Query Builder  │  ORM  │  Cache     │
└───────┬──────────────────┬──────────────────────┬────────┘
        │                  │                      │
┌───────▼────┐   ┌─────────▼────────┐   ┌────────▼────────┐
│   MySQL    │   │  File System     │   │  Redis Cache    │
│  Database  │   │  (VMap/MMap)     │   │                 │
└────────────┘   └──────────────────┘   └─────────────────┘
```

## Core Components

### 1. MCP Server Layer

**Location:** `src/server.ts`

The MCP server implements the Model Context Protocol specification, handling:
- Tool registration and execution
- Resource management
- Prompt templates
- Client connections

**Key Features:**
- Automatic tool discovery
- Type-safe tool definitions
- Error handling and validation
- Event-driven architecture

### 2. VMap Manager

**Location:** `src/vmap/VMapManager.ts`

Manages visibility maps for collision detection and line-of-sight calculations.

**Architecture:**
```
VMapManager
├── TileCache (LRU Cache)
├── WorkerPool (Multi-threading)
├── CollisionDetector
│   ├── Ray-Triangle Intersection
│   ├── DDA Traversal
│   └── Spatial Indexing
└── HeightCalculator
```

**Performance Optimizations:**
- LRU caching with configurable size limits
- Multi-threaded tile loading via worker pool
- Lazy loading of tiles on demand
- Memory-mapped file access
- Spatial indexing for fast lookups

### 3. MMap Manager

**Location:** `src/mmap/MMapManager.ts`

Handles navigation meshes for pathfinding.

**Architecture:**
```
MMapManager
├── NavMeshCache
├── PathFinder (A* Algorithm)
├── PathSmoother
└── AreaCalculator
```

**Pathfinding Algorithm:**
1. Load navigation mesh tiles
2. Find nearest polygons to start/end
3. Execute A* search across polygons
4. Convert polygon path to waypoints
5. Smooth path with string pulling
6. Return optimized waypoints

### 4. Security Manager

**Location:** `src/security/SecurityManager.ts`

Enterprise-grade security implementation.

**Components:**
- **Rate Limiting:** Token bucket, sliding window, fixed window, leaky bucket
- **Authentication:** API key management with permissions
- **Input Validation:** SQL injection and XSS detection
- **Encryption:** AES-256-GCM for sensitive data
- **Audit Logging:** Comprehensive security event tracking
- **Threat Detection:** Automated threat scoring and blocking

### 5. Monitoring Stack

**Location:** `src/monitoring/`

Comprehensive observability solution.

**Components:**

#### Logger (`Logger.ts`)
- Structured logging with multiple transports
- Log levels: TRACE, DEBUG, INFO, WARN, ERROR, FATAL
- Console, file, and rotating file transports
- Child loggers with context

#### Tracer (`Tracer.ts`)
- Distributed tracing with OpenTelemetry-compatible format
- Span creation and management
- Context propagation
- Multiple exporters

#### Alert Manager (`AlertManager.ts`)
- Rule-based alerting
- Multiple severity levels
- Alert channels (console, email, Slack, PagerDuty)
- Alert lifecycle management

### 6. Metrics Collector

**Location:** `src/production/MetricsCollector.ts`

Prometheus-compatible metrics collection.

**Metric Types:**
- Counters: Monotonically increasing values
- Gauges: Current value snapshots
- Histograms: Distribution of values with buckets
- Summaries: Quantile calculations

**Features:**
- Time series data storage
- Multiple export formats (JSON, Prometheus, CSV)
- Automatic data retention
- Label-based dimensions

### 7. Health Check System

**Location:** `src/production/HealthCheck.ts`

Multi-layered health monitoring.

**Check Types:**
- **System Checks:** CPU, memory, disk usage
- **Service Checks:** Database connectivity, cache availability
- **Custom Checks:** Application-specific health indicators

**Health Status Levels:**
- Healthy: All systems operational
- Degraded: Some non-critical issues
- Unhealthy: Critical issues requiring attention
- Unknown: Unable to determine status

### 8. Configuration Manager

**Location:** `src/production/ConfigManager.ts`

Dynamic configuration management.

**Features:**
- Multi-source configuration (files, environment, remote)
- Hot-reloading with file watching
- Schema validation
- Environment-specific configs
- Configuration versioning

## Data Flow

### Request Processing Flow

```
1. Client Request
   ↓
2. Load Balancer (Nginx)
   ↓
3. Security Layer
   ├── Rate Limit Check
   ├── Authentication
   └── Input Validation
   ↓
4. API Router
   ↓
5. Middleware Stack
   ├── Logging
   ├── Tracing
   ├── Metrics
   └── Error Handling
   ↓
6. Controller
   ↓
7. Service Layer
   ├── Business Logic
   ├── Data Validation
   └── Cache Check
   ↓
8. Data Access Layer
   ├── Database Query
   ├── File System Access
   └── Cache Update
   ↓
9. Response Formation
   ↓
10. Client Response
```

### VMap Processing Flow

```
1. LOS Check Request
   ↓
2. Calculate Affected Tiles (DDA)
   ↓
3. Load Tiles (with caching)
   ├── Check Cache
   ├── Load from Disk (if needed)
   └── Parse Binary Data
   ↓
4. Ray-Triangle Intersection
   ├── For each tile
   ├── For each model
   └── For each triangle
   ↓
5. Return Result
   ├── Has LOS: true/false
   ├── Hit Point (if collision)
   └── Distance
```

### Pathfinding Flow

```
1. Path Request
   ↓
2. Load Nav Mesh Tiles
   ↓
3. Find Start/End Polygons
   ↓
4. A* Search
   ├── Open Set (priority queue)
   ├── Closed Set (visited)
   ├── Cost Calculation
   └── Heuristic Function
   ↓
5. Polygon Path to Waypoints
   ↓
6. Path Smoothing
   ├── String Pulling
   └── Remove Redundant Points
   ↓
7. Return Optimized Path
```

## Scalability

### Horizontal Scaling

The application is designed for horizontal scaling:

1. **Stateless Design:** No server-side session state
2. **Shared Cache:** Redis for distributed caching
3. **Load Balancing:** Round-robin or least-connections
4. **Database Pooling:** Connection pool per instance

### Vertical Scaling

Optimizations for single-instance performance:

1. **Worker Threads:** CPU-intensive tasks in worker pool
2. **Memory Management:** LRU caches with size limits
3. **Query Optimization:** Indexed queries, prepared statements
4. **Async I/O:** Non-blocking file and network operations

### Caching Strategy

Multi-layer caching architecture:

```
Client Cache (Browser)
   ↓
CDN Cache (Static Assets)
   ↓
API Gateway Cache
   ↓
Application Cache (Redis)
   ↓
Database Query Cache
   ↓
Database
```

## High Availability

### Redundancy

- Multiple application instances
- Database replication (master-slave)
- Redis Sentinel for cache HA
- Load balancer failover

### Failure Handling

- Circuit breaker pattern for external services
- Graceful degradation
- Automatic retry with exponential backoff
- Health check-based routing

### Disaster Recovery

- Automated database backups
- Point-in-time recovery
- Configuration version control
- Deployment rollback procedures

## Security Architecture

### Defense in Depth

```
Layer 1: Network Security (Firewall, DDoS Protection)
Layer 2: TLS/SSL Encryption
Layer 3: WAF (Web Application Firewall)
Layer 4: Rate Limiting
Layer 5: Authentication & Authorization
Layer 6: Input Validation
Layer 7: Output Encoding
Layer 8: Audit Logging
```

### Security Best Practices

1. **Principle of Least Privilege:** Minimal database permissions
2. **Defense in Depth:** Multiple security layers
3. **Fail Secure:** Deny by default
4. **Keep it Simple:** Reduce attack surface
5. **Assume Breach:** Monitor and detect

## Performance Characteristics

### Latency Targets

- API Response: < 50ms (p95)
- VMap LOS Check: < 10ms
- Pathfinding: < 100ms for 100m path
- Database Query: < 5ms (indexed)

### Throughput Targets

- Requests per Second: 10,000+ (per instance)
- Concurrent Connections: 100,000+
- Database Queries: 50,000+ QPS

### Resource Usage

- Memory: ~500MB baseline + cache
- CPU: < 50% at target load
- Disk I/O: Minimal (memory-mapped files)

## Technology Stack

### Runtime
- Node.js 20+ (LTS)
- TypeScript 5+

### Database
- MySQL 8.0+ / MariaDB 10.6+
- Redis 7+ (caching)

### Monitoring
- Prometheus (metrics)
- Grafana (dashboards)
- Jaeger/Zipkin (tracing)
- ELK Stack (logging)

### Infrastructure
- Docker / Kubernetes
- Nginx (reverse proxy)
- PM2 (process management)

## Future Enhancements

### Planned Features

1. **GraphQL API:** Alternative to REST
2. **WebSocket Support:** Real-time updates
3. **Event Streaming:** Kafka/RabbitMQ integration
4. **ML Integration:** Intelligent pathfinding
5. **Multi-tenancy:** Isolated customer environments

### Performance Improvements

1. **Query Optimization:** Advanced indexing strategies
2. **Cache Warming:** Preload hot data
3. **Compression:** Response payload compression
4. **HTTP/3:** QUIC protocol support

## Development Guidelines

### Code Organization

```
src/
├── server.ts           # MCP server entry point
├── vmap/              # VMap functionality
├── mmap/              # MMap functionality
├── security/          # Security components
├── monitoring/        # Observability
├── production/        # Production features
├── tools/             # MCP tools
└── utils/             # Shared utilities
```

### Design Patterns

- **Singleton:** Global managers (ConfigManager, Logger)
- **Factory:** Object creation (Spans, Metrics)
- **Observer:** Event-driven architecture (EventEmitter)
- **Strategy:** Interchangeable algorithms (Rate limiting)
- **Decorator:** Middleware pattern

### Testing Strategy

- **Unit Tests:** Individual components
- **Integration Tests:** Component interactions
- **E2E Tests:** Full request flows
- **Load Tests:** Performance validation
- **Security Tests:** Penetration testing

## References

- MCP Specification: https://spec.modelcontextprotocol.io
- TrinityCore: https://www.trinitycore.org
- OpenTelemetry: https://opentelemetry.io
- Prometheus: https://prometheus.io
