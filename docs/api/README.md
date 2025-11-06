# TrinityCore MCP API Documentation

## Overview

The TrinityCore MCP (Model Context Protocol) server provides comprehensive APIs for interacting with TrinityCore server data, including maps, creatures, items, quests, and more.

## Base URL

```
http://localhost:3000/api
```

## Authentication

API requests can be authenticated using API keys (when security is enabled):

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:3000/api/maps
```

## Core APIs

### Map Management

#### GET /api/maps
List all available maps.

**Response:**
```json
{
  "maps": [
    {
      "id": 0,
      "name": "Eastern Kingdoms",
      "instanceType": "normal"
    }
  ]
}
```

#### GET /api/maps/:mapId
Get details for a specific map.

**Parameters:**
- `mapId` (number): The map ID

**Response:**
```json
{
  "id": 0,
  "name": "Eastern Kingdoms",
  "instanceType": "normal",
  "tiles": []
}
```

### Creature Management

#### GET /api/creatures
List creatures with pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50)
- `search` (string): Search by name

**Response:**
```json
{
  "creatures": [],
  "total": 1000,
  "page": 1,
  "pages": 20
}
```

#### GET /api/creatures/:id
Get creature details.

**Response:**
```json
{
  "entry": 1,
  "name": "Creature Name",
  "subname": "Title",
  "minlevel": 60,
  "maxlevel": 60
}
```

### Item Management

#### GET /api/items
List items with filtering.

**Query Parameters:**
- `class` (number): Item class filter
- `quality` (number): Item quality filter
- `search` (string): Search by name

#### GET /api/items/:id
Get item details.

### Quest Management

#### GET /api/quests
List quests.

#### GET /api/quests/:id
Get quest details including objectives and rewards.

### VMap Operations

#### POST /api/vmap/load-tile
Load a VMap tile.

**Request Body:**
```json
{
  "mapId": 0,
  "tileX": 32,
  "tileY": 32
}
```

#### POST /api/vmap/check-los
Check line of sight between two points.

**Request Body:**
```json
{
  "mapId": 0,
  "start": { "x": 0, "y": 0, "z": 0 },
  "end": { "x": 10, "y": 10, "z": 10 }
}
```

**Response:**
```json
{
  "hasLOS": true,
  "hitPoint": null
}
```

### Navigation (MMap)

#### POST /api/mmap/find-path
Find a path between two points.

**Request Body:**
```json
{
  "mapId": 0,
  "start": { "x": 0, "y": 0, "z": 0 },
  "end": { "x": 100, "y": 100, "z": 0 }
}
```

**Response:**
```json
{
  "success": true,
  "path": [
    { "x": 0, "y": 0, "z": 0 },
    { "x": 50, "y": 50, "z": 0 },
    { "x": 100, "y": 100, "z": 0 }
  ],
  "cost": 141.42
}
```

## Monitoring APIs

### Health Check

#### GET /api/health
Get system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 3600,
  "system": {
    "cpu": { "usage": 25.5 },
    "memory": { "usagePercent": 45.2 }
  }
}
```

### Metrics

#### GET /api/metrics
Get performance metrics in Prometheus format.

**Response:**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/maps"} 1523
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Common Error Codes

- `RATE_LIMIT_EXCEEDED`: Too many requests
- `UNAUTHORIZED`: Invalid or missing API key
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API endpoints are rate limited:
- Default: 100 requests per minute
- Authenticated: 1000 requests per minute

Rate limit headers:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets

## Webhooks

Subscribe to events via webhooks:

### Event Types
- `creature.spawned`
- `creature.despawned`
- `map.loaded`
- `quest.completed`

### Webhook Payload
```json
{
  "event": "creature.spawned",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "data": {}
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { TrinityCoreMCP } from '@trinitycore/mcp-client';

const client = new TrinityCoreMCP({
  baseURL: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Get all maps
const maps = await client.maps.list();

// Load a VMap tile
const tile = await client.vmap.loadTile(0, 32, 32);

// Find a path
const path = await client.mmap.findPath(0, start, end);
```

### Python

```python
from trinitycore_mcp import Client

client = Client(
    base_url='http://localhost:3000',
    api_key='your-api-key'
)

maps = client.maps.list()
tile = client.vmap.load_tile(0, 32, 32)
path = client.mmap.find_path(0, start, end)
```

## Best Practices

1. **Use pagination** for large datasets
2. **Cache responses** when appropriate
3. **Handle rate limits** with exponential backoff
4. **Validate input** before API calls
5. **Monitor API usage** via metrics endpoint

## Support

For issues and questions:
- GitHub: https://github.com/agatho-dev/trinitycore-mcp
- Discord: TrinityCore MCP Community
