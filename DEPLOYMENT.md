# 🚀 Observer Protocol Backend - Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Docker (optional)

## Local Development Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd observer-backend
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/observer_db"
REDIS_URL="redis://localhost:6379"
ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
OBS_CONTRACT_ADDRESS="0x..."
JWT_SECRET="your-super-secret-key"
```

### 3. Database Setup

```bash
# Create/update database schema
npm run db:push

# View data in Prisma Studio
npm run db:studio
```

### 4. Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

## Docker Deployment

### Build Docker Image

```bash
docker build -t observer-backend:latest .
```

### Run Container

```bash
docker run -d \
  --name observer-api \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e ETHEREUM_RPC_URL="..." \
  -e OBS_CONTRACT_ADDRESS="..." \
  -e JWT_SECRET="..." \
  observer-backend:latest
```

### Docker Compose Example

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/observer_db
      REDIS_URL: redis://cache:6379
      ETHEREUM_RPC_URL: ${ETHEREUM_RPC_URL}
      OBS_CONTRACT_ADDRESS: ${OBS_CONTRACT_ADDRESS}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db
      - cache
    restart: always

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: observer_db
      POSTGRES_PASSWORD: password
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: always

  cache:
    image: redis:7-alpine
    restart: always

volumes:
  db_data:
```

Run: `docker-compose up -d`

## Kubernetes Deployment

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: observer-config
data:
  JWT_EXPIRY: "7d"
  RATE_LIMIT_MAX_REQUESTS: "100"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: observer-secrets
type: Opaque
stringData:
  DATABASE_URL: postgresql://...
  REDIS_URL: redis://...
  JWT_SECRET: your-secret
  ETHEREUM_RPC_URL: https://...
  OBS_CONTRACT_ADDRESS: "0x..."
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: observer-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: observer-api
  template:
    metadata:
      labels:
        app: observer-api
    spec:
      containers:
      - name: api
        image: observer-backend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: observer-config
        - secretRef:
            name: observer-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

## AWS Deployment

### Using ECS

1. Push Docker image to ECR:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag observer-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/observer-backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/observer-backend:latest
```

2. Create ECS task definition
3. Create ECS service
4. Configure RDS for PostgreSQL
5. Create ElastiCache for Redis

### Using Lambda + API Gateway

Not recommended due to connection pooling issues with Prisma. ECS is preferred.

## Heroku Deployment

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create observer-protocol-api

# Set environment variables
heroku config:set DATABASE_URL=postgresql://...
heroku config:set REDIS_URL=redis://...
heroku config:set JWT_SECRET=your-secret
heroku config:set ETHEREUM_RPC_URL=https://...

# Deploy
git push heroku main
```

## Production Checklist

- ✅ Set `NODE_ENV=production`
- ✅ Use strong `JWT_SECRET` (min 32 chars)
- ✅ Enable HTTPS only
- ✅ Configure CORS for specific origins
- ✅ Set up database backups (daily)
- ✅ Monitor Redis memory usage
- ✅ Enable rate limiting
- ✅ Set up error logging (Sentry, Datadog)
- ✅ Use environment-specific configs
- ✅ Enable request logging
- ✅ Set up health checks
- ✅ Configure auto-scaling
- ✅ Use connection pooling
- ✅ Enable gzip compression

## Performance Tuning

### Database

```sql
-- Create indexes (run inside Prisma migration)
CREATE INDEX idx_user_address ON "User"(address);
CREATE INDEX idx_user_tier ON "User"(tier);
CREATE INDEX idx_feedpost_tier ON "FeedPost"(tier);
CREATE INDEX idx_transmission_created ON "Transmission"("createdAt");
```

### Redis

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Node.js

```bash
# Increase file descriptors
ulimit -n 65536

# Enable compression
export NODE_OPTIONS="--max-http-header-size=16384"
```

## Monitoring & Logging

### Log Aggregation

```typescript
// Example with Sentry
import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN });

app.onError((err, c) => {
  Sentry.captureException(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});
```

### Health Checks

```bash
curl http://localhost:3000/health
# Response: { "status": "ok", "timestamp": "2024-04-26T..." }
```

### Metrics

- Request latency
- Database query time
- Redis hit rate
- Error rate
- Tier distribution

## Scaling Strategy

### Horizontal Scaling

1. Load balance across multiple instances
2. Use shared Redis instance
3. Use shared PostgreSQL database
4. Monitor connection pool usage

### Vertical Scaling

- Increase Node.js heap size
- Increase Redis memory
- Optimize database queries

## Rollback Plan

```bash
# Keep previous version
docker tag observer-backend:v1.0 observer-backend:stable

# In case of issues
docker run -d observer-backend:stable
```

## Security Hardening

```bash
# Run as non-root
USER node

# Minimal base image
FROM node:18-alpine

# Security headers
app.use(async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  await next();
});
```

## Emergency Procedures

### Database Connection Issues

```bash
# Check connection pool
npm run db:studio

# Reset migrations
npm run db:push --force-reset  # ⚠️ Data loss!
```

### Redis Issues

```bash
# Check Redis connection
redis-cli ping

# Clear cache
redis-cli FLUSHDB
```

### Out of Memory

```bash
# Increase heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

## Backup & Recovery

### Database

```bash
# Backup
pg_dump observer_db > backup.sql

# Restore
psql observer_db < backup.sql
```

### Regular Backups (Cron)

```bash
# Daily backup at 2 AM
0 2 * * * pg_dump observer_db | gzip > /backups/observer_$(date +\%Y\%m\%d).sql.gz
```

## Post-Deployment Verification

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test API
curl -X POST http://localhost:3000/api/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc92db0b18D46F"}'

# Check logs
docker logs observer-api

# Monitor resources
docker stats
```

---

**For production deployments, always run through the checklist and test thoroughly in staging first!**
