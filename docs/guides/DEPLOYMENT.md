# TrinityCore MCP Deployment Guide

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Disk: 50 GB SSD
- OS: Ubuntu 20.04+ / Debian 11+ / RHEL 8+

**Recommended:**
- CPU: 8+ cores
- RAM: 16 GB+
- Disk: 100 GB+ NVMe SSD
- OS: Ubuntu 22.04 LTS

### Software Dependencies

- Node.js 18+ or 20+
- npm 9+ or yarn 1.22+
- MySQL 8.0+ or MariaDB 10.6+
- Redis 6.0+ (optional, for caching)
- Nginx or Apache (for reverse proxy)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/agatho-dev/trinitycore-mcp.git
cd trinitycore-mcp
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=trinity
DB_PASSWORD=your_secure_password
DB_NAME=world

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Security
API_KEYS_ENABLED=true
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=100

# VMap/MMap Paths
VMAP_PATH=/opt/trinitycore/vmaps
MMAP_PATH=/opt/trinitycore/mmaps

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

### 4. Build Project

```bash
npm run build
# or
yarn build
```

### 5. Run Database Migrations

```bash
npm run migrate
# or
yarn migrate
```

## Deployment Methods

### Method 1: PM2 (Recommended)

PM2 is a production process manager for Node.js applications.

#### Install PM2

```bash
npm install -g pm2
```

#### Create PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'trinitycore-mcp',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

#### Start Application

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### PM2 Commands

```bash
# View logs
pm2 logs trinitycore-mcp

# Monitor
pm2 monit

# Restart
pm2 restart trinitycore-mcp

# Stop
pm2 stop trinitycore-mcp

# Reload (zero-downtime)
pm2 reload trinitycore-mcp
```

### Method 2: Docker

#### Build Docker Image

```bash
docker build -t trinitycore-mcp:latest .
```

#### Run Container

```bash
docker run -d \
  --name trinitycore-mcp \
  -p 3000:3000 \
  -v /opt/trinitycore/vmaps:/app/vmaps:ro \
  -v /opt/trinitycore/mmaps:/app/mmaps:ro \
  --env-file .env \
  --restart unless-stopped \
  trinitycore-mcp:latest
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - REDIS_HOST=redis
    volumes:
      - /opt/trinitycore/vmaps:/app/vmaps:ro
      - /opt/trinitycore/mmaps:/app/mmaps:ro
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: world
      MYSQL_USER: trinity
      MYSQL_PASSWORD: trinity_password
    volumes:
      - db_data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  db_data:
```

Start services:

```bash
docker-compose up -d
```

### Method 3: Kubernetes

See `k8s/` directory for Kubernetes manifests.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

## Reverse Proxy Setup

### Nginx

Create `/etc/nginx/sites-available/trinitycore-mcp`:

```nginx
upstream trinitycore_mcp {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name api.trinitycore.example.com;

    # Redirect to HTTPS
    return 301 https://api.trinitycore.example.com;
}

server {
    listen 443 ssl http2;
    server_name api.trinitycore.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.trinitycore.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.trinitycore.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # Proxy Settings
    location / {
        proxy_pass http://trinitycore_mcp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health Check Endpoint
    location /health {
        access_log off;
        proxy_pass http://trinitycore_mcp/api/health;
    }
}
```

Enable and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/trinitycore-mcp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL/TLS Setup

### Using Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.trinitycore.example.com
```

### Auto-renewal

```bash
sudo certbot renew --dry-run
```

Certbot will automatically set up a cron job for renewal.

## Monitoring Setup

### Prometheus

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'trinitycore-mcp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

### Grafana

Import dashboard from `monitoring/grafana/dashboard.json`.

### Application Logs

Logs are written to:
- stdout/stderr (captured by PM2/Docker)
- `/var/log/trinitycore-mcp/` (if file logging enabled)

View logs:

```bash
# PM2
pm2 logs trinitycore-mcp

# Docker
docker logs -f trinitycore-mcp

# System logs
journalctl -u trinitycore-mcp -f
```

## Performance Tuning

### Node.js Optimization

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Enable worker threads
WORKER_THREADS=4 npm start
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_creature_entry ON creature_template(entry);
CREATE INDEX idx_item_name ON item_template(name);
CREATE INDEX idx_quest_level ON quest_template(MinLevel);

-- Optimize tables
OPTIMIZE TABLE creature_template;
OPTIMIZE TABLE item_template;
OPTIMIZE TABLE quest_template;
```

### Caching

Enable Redis caching in `.env`:

```env
CACHE_ENABLED=true
CACHE_TTL=3600
```

## Security Hardening

### Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (if not behind reverse proxy)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

### Fail2Ban

Create `/etc/fail2ban/filter.d/trinitycore-mcp.conf`:

```ini
[Definition]
failregex = ^.*RATE_LIMIT_EXCEEDED.*<HOST>.*$
ignoreregex =
```

Create `/etc/fail2ban/jail.local`:

```ini
[trinitycore-mcp]
enabled = true
port = http,https
filter = trinitycore-mcp
logpath = /var/log/trinitycore-mcp/access.log
maxretry = 5
bantime = 3600
```

Restart fail2ban:

```bash
sudo systemctl restart fail2ban
```

## Backup Strategy

### Database Backup

```bash
#!/bin/bash
# /opt/scripts/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/trinitycore"
DB_NAME="world"

mkdir -p $BACKUP_DIR

mysqldump -u trinity -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_DIR/world_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "world_*.sql.gz" -mtime +7 -delete
```

Add to crontab:

```bash
0 2 * * * /opt/scripts/backup-db.sh
```

### Application Backup

```bash
# Backup configuration
tar -czf /var/backups/trinitycore/config_$(date +%Y%m%d).tar.gz \
  .env ecosystem.config.js

# Backup logs
tar -czf /var/backups/trinitycore/logs_$(date +%Y%m%d).tar.gz \
  /var/log/trinitycore-mcp/
```

## Troubleshooting

### High CPU Usage

```bash
# Check process
top -p $(pgrep -f trinitycore-mcp)

# Enable profiling
NODE_ENV=production node --prof dist/server.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

### Memory Leaks

```bash
# Heap snapshot
kill -USR2 $(pgrep -f trinitycore-mcp)

# Analyze with Chrome DevTools
```

### Database Connection Issues

```bash
# Test connection
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME

# Check connection pool
curl http://localhost:3000/api/health
```

## Scaling

### Horizontal Scaling

Add more application instances behind load balancer:

```bash
pm2 scale trinitycore-mcp +4
```

### Database Replication

Set up MySQL master-slave replication for read scaling.

### Caching Layer

Implement Redis cluster for distributed caching.

## Support

For deployment issues:
- Documentation: https://docs.trinitycore-mcp.dev
- Community: https://discord.gg/trinitycore-mcp
- Issues: https://github.com/agatho-dev/trinitycore-mcp/issues
