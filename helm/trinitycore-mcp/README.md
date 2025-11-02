# TrinityCore MCP Server Helm Chart

This Helm chart deploys the TrinityCore MCP Server on a Kubernetes cluster.

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure
- Ingress controller (nginx recommended)
- cert-manager (for TLS certificates)

## Installing the Chart

```bash
# Add the chart repository (if using a Helm repo)
helm repo add trinitycore https://charts.trinitycore.local
helm repo update

# Install the chart
helm install trinitycore-mcp trinitycore/trinitycore-mcp \
  --namespace trinitycore \
  --create-namespace \
  --values values.yaml

# Or install from local chart
helm install trinitycore-mcp ./helm/trinitycore-mcp \
  --namespace trinitycore \
  --create-namespace
```

## Uninstalling the Chart

```bash
helm uninstall trinitycore-mcp --namespace trinitycore
```

## Configuration

The following table lists the configurable parameters and their default values.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `3` |
| `image.repository` | Image repository | `ghcr.io/agatho/trinitycore-mcp` |
| `image.tag` | Image tag | `1.4.0` |
| `service.type` | Service type | `ClusterIP` |
| `ingress.enabled` | Enable ingress | `true` |
| `resources.limits.cpu` | CPU limit | `2000m` |
| `resources.limits.memory` | Memory limit | `4Gi` |
| `database.host` | Database host | `mysql-primary` |
| `redis.enabled` | Enable Redis | `true` |

See `values.yaml` for all available parameters.

## Upgrading

```bash
helm upgrade trinitycore-mcp ./helm/trinitycore-mcp \
  --namespace trinitycore \
  --values values.yaml
```

## Examples

### Minimal Production Deployment

```bash
helm install trinitycore-mcp ./helm/trinitycore-mcp \
  --namespace trinitycore \
  --create-namespace \
  --set ingress.hosts[0].host=mcp.example.com \
  --set database.host=mysql-prod \
  --set replicaCount=5
```

### Development Deployment

```bash
helm install trinitycore-mcp ./helm/trinitycore-mcp \
  --namespace trinitycore-dev \
  --create-namespace \
  --set replicaCount=1 \
  --set resources.limits.cpu=1000m \
  --set resources.limits.memory=2Gi \
  --set ingress.enabled=false
```
