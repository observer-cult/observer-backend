# 🏗️ Observer Protocol Backend - Architecture & Troubleshooting

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (Web/Mobile)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTP/HTTPS (Port 3000)
                             │
┌─────────────────────────────▼────────────────────────────────────┐
│                      Hono HTTP Server                            │
├─────────────────────────────────────────────────────────────────┤
│ CORS │ Logger │ Rate Limiter │ Auth Middleware │ Tier Checker   │
└─────────────────────────────────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
      ┌─────▼──────┐   ┌─────▼──────┐   ┌────▼───────┐
      │   Routes   │   │  Services  │   │ Validators │
      ├────────────┤   ├────────────┤   └────────────┘
      │ /auth      │   │ tier       │
      │ /users     │   │ pnl        │
      │ /cults     │   │ token      │
      │ /feed      │   │ cult       │
      │ /transmit  │   │ feed       │
      │ /analytics │   │ transmit   │
      │ /tokens    │   │ (services) │
      └─────┬──────┘   └─────┬──────┘
            │                │
            └────────┬───────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼─────┐ ┌────▼─────┐ ┌───▼──────┐
   │ Database │ │  Redis   │ │ Ethereum │
   │PostgreSQL│ │  Cache   │ │ Blockchain
   │          │ │          │ │ (RPC)    │
   │ Tables:  │ │Prices    │ │          │
   │ User     │ │Tiers     │ │ /lookup  │
   │ Cult     │ │RateLimit │ │ /balance │
   │ Feed     │ │Cursors   │ │ /verify  │
   │ Transmit │ │          │ │          │
   └──────────┘ └──────────┘ └──────────┘
```

## System Components

### 1. **HTTP Server (Hono)**
- Request handling
- CORS & logging
- Error handling
- Health checks

### 2. **Middleware**
- `auth.ts`: JWT validation
- `tier.ts`: Tier-based access control
- `rateLimit.ts`: Redis-backed rate limiting

### 3. **Routes / API Layer**
- Request validation (Zod)
- Response formatting
- HTTP status codes
- Error responses

### 4. **Services**
- Business logic isolation
- Database queries
- External API calls
- Caching coordination

### 5. **Database (PostgreSQL)**
- User profiles
- Cult membership
- Feed & reactions
- Trading signals

### 6. **Cache (Redis)**
- Token prices (60s TTL)
- User tiers (300s TTL)
- Rate limit counters
- Pagination cursors

### 7. **Blockchain (Ethereum)**
- Wallet signature verification
- $OBS balance queries
- Tier calculation

## Data Flow Examples

### 1. User Login Flow
```
Client: GET /nonce → Backend: Generate nonce → DB: Store nonce
Client: Sign nonce with wallet
Client: POST /verify with signature → Backend: Verify signature
Backend: Query blockchain for $OBS balance
Backend: Calculate tier from balance
Backend: Generate JWT (HTTP-only cookie)
Client: Subsequent requests auto-include JWT
```

### 2. Create Feed Post Flow
```
Client: POST /feed (with JWT in cookie)
Backend: Validate JWT from cookie
Backend: Extract user from JWT
Backend: Validate post content (Zod)
Backend: Create post in database
Backend: Return post with author info
Client: Display post in feed
```

### 3. Get Feed Flow
```
Client: GET /feed
Backend: Extract user tier from JWT (or default to 0)
Backend: Query posts with tier <= userTier
Backend: Apply pagination (cursor-based)
Backend: Fetch author details for each post
Backend: Calculate reaction/comment counts
Backend: Return feed items with nextCursor
```

### 4. Create Transmission Flow
```
Client: POST /transmissions (with entry/target prices)
Backend: Validate auth, tier >= 2
Backend: Store transmission in database
Backend: Return transmission details
User: Later closes transmission
Client: PUT /transmissions/:id/close with exit price
Backend: Fetch current price from CoinGecko (cached)
Backend: Calculate PnL percentage
Backend: Update transmission status to closed
Backend: Record close event for leaderboard
Backend: Return final PnL
```

## Database Schema Highlights

### Indexing Strategy
```sql
-- Hot queries
CREATE INDEX idx_user_address ON User(address);
CREATE INDEX idx_user_tier ON User(tier);
CREATE INDEX idx_feedpost_tier ON FeedPost(tier);
CREATE INDEX idx_feedpost_created ON FeedPost(createdAt);
CREATE INDEX idx_transmission_created ON Transmission(createdAt);
CREATE INDEX idx_transmission_closed ON Transmission(closedAt);
```

### Relationships
- User ← (1:Many) → FeedPost
- User ← (1:Many) → Transmission
- Cult ← (1:Many) → CultMember
- Cult ← (1:Many) → Transmission
- FeedPost ← (1:Many) → FeedReaction

## Caching Strategy

### Redis Keys Pattern
```
token:price:{tokenAddress}          → number (TTL: 60s)
user:tier:{address}                 → number (TTL: 300s)
feed:cursor:{userId}                → string (TTL: 30s)
rate-limit:{address}                → number (TTL: 60s)
```

### Cache Invalidation
- **Token prices**: Auto-expire after 60s
- **User tiers**: Auto-expire after 300s
- **Rate limits**: Window-based (auto-reset)

## Authentication Flow Details

### JWT Token Creation
```
Payload: { address: "0x...", iat: timestamp, exp: timestamp + 7days }
Signed with: HS256 + JWT_SECRET
Stored as: HTTP-only cookie (secure, sameSite)
```

### Token Validation
```
1. Extract JWT from request cookie
2. Verify signature using JWT_SECRET
3. Check expiration (exp < now)
4. Fetch user from database
5. Attach user to request context
```

---

# 🔧 Troubleshooting Guide

## Database Issues

### Issue: "Role 'postgres' does not exist"
```bash
# Solution: Create PostgreSQL user
createuser postgres
createdb observer_db -O postgres

# Or use Docker
docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
```

### Issue: "SSL connection refused"
```env
# Add to connection string
DATABASE_URL="postgresql://user:password@localhost:5432/db?sslmode=disable"
```

### Issue: "Migrations conflicted"
```bash
# Reset database (⚠️ data loss)
npm run db:push --force-reset

# Or repair
npx prisma migrate resolve --rolled-back <migration_name>
```

## Redis Issues

### Issue: "Connection refused" on Redis
```bash
# Check Redis is running
redis-cli ping
# Should respond: PONG

# Start Redis if not running
docker run -p 6379:6379 redis:7-alpine

# Or on macOS
brew install redis
brew services start redis
```

### Issue: "Out of memory" errors
```bash
# Check memory usage
redis-cli INFO memory

# Clear cache
redis-cli FLUSHDB

# Increase max memory
redis-cli CONFIG SET maxmemory 512mb
```

### Issue: "MISCONF Redis is loading the dataset in memory"
```bash
# Wait for Redis to finish loading, or restart
redis-cli SHUTDOWN
redis-server
```

## Authentication Issues

### Issue: "Invalid signature"
```bash
# Verify signature format
# Should be: 0x + 130 hex characters
# Got 65 byte signature? Use ethers.js to format
signature = await signer.signMessage(nonce);
```

### Issue: "JWT cookie not being set"
```bash
# Check in browser DevTools:
# - Application → Cookies
# - Should have "auth_token" cookie
# - Check: httpOnly=true, secure=true (prod), sameSite=Strict

# In development, might need:
NODE_OPTIONS=--no-warnings npm run dev

# Check CORS configuration
# Cookie requires: credentials: 'include' in fetch
```

### Issue: "Token expired"
```bash
# Use refresh token
POST /auth/refresh with refreshToken in body

# Check JWT_EXPIRY in .env
# Default is 7 days
```

## API Issues

### Issue: "404 on endpoint"
```bash
# Check endpoint spelling and HTTP method
# Verify base URL: http://localhost:3000/api

# Test with curl
curl -v http://localhost:3000/api/health
```

### Issue: "403 Forbidden"
```bash
# Likely tier requirement not met
# Check your $OBS balance on blockchain
# Tier thresholds in .env:
TIER_0_THRESHOLD="0"
TIER_1_THRESHOLD="1000000000000000000"  # 1 $OBS
TIER_2_THRESHOLD="10000000000000000000"  # 10 $OBS
```

### Issue: "429 Rate Limited"
```bash
# Clear rate limit in Redis
redis-cli DEL rate-limit:<your_address>

# Or wait 60 seconds for window to expire
```

### Issue: "Invalid input validation"
```bash
# Check Zod schema in validators/
# Common issues:
# - Address not checksummed (use ethers.isAddress())
# - Prices must be integers (wei format)
# - String content too long
# - Invalid enum values

# Example fix:
import { isAddress } from 'ethers';
address = isAddress(address) ? address : null;
```

## Performance Issues

### Issue: "Database queries are slow"
```bash
# Check slow queries
PRAGMA analyze;

# Analyze query plan
EXPLAIN ANALYZE SELECT * FROM User WHERE tier > 2;

# Add missing indexes
npx prisma migrate dev --name add_indexes
```

### Issue: "Memory leak in Node process"
```bash
# Check with
node --inspect src/index.ts
# Open chrome://inspect

# Or profiling
node --prof src/index.ts
node --prof-process isolate-*.log > profile.txt
```

### Issue: "Redis connection pool exhausted"
```bash
# Check connections
redis-cli CLIENT LIST | wc -l

# Increase in redis.conf
maxclients 10000

# Or in code
redis.getClient().config('SET', 'maxclients', 10000)
```

## Deployment Issues

### Issue: "Cannot find module @/lib/prisma"
```bash
# Check tsconfig.json paths and build
npm run build

# Verify dist/ files exist
ls -la dist/
```

### Issue: "Prisma client not found in container"
```bash
# Add to Dockerfile
RUN npm run db:generate

# Or pre-generate before building
npx prisma generate
```

### Issue: "Environment variables not loading"
```bash
# Check .env file exists (not .env.example)
# In Docker, use --env-file or -e flags

docker run -e DATABASE_URL="..." app
# Or
docker run --env-file .env app
```

## Blockchain Integration Issues

### Issue: "ethers.js provider connection failed"
```bash
# Check RPC URL is valid and accessible
curl -X POST $ETHEREUM_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Try Alchemy instead of Infura
ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
```

### Issue: "Cannot read token balance (0x0000...)"
```bash
# Check OBS_CONTRACT_ADDRESS is correct
# Should be actual $OBS contract, not 0x0000...

# Verify contract on Etherscan
# Check contract has balanceOf() function

# Test manually
ethers.JsonRpcProvider(rpcUrl);
contract.balanceOf(address);
```

### Issue: "Signature verification fails"
```bash
# Ensure message format is exact
const nonce = "0xAddress:Timestamp:Random";
const signature = await signer.signMessage(nonce);

# ethers.verifyMessage() should match
ethers.verifyMessage(nonce, signature) === address
```

## Network Issues

### Issue: "Connection timeout on external API"
```bash
# Check internet connectivity
curl https://api.coingecko.com/api/v3/ping

# Add retry logic (already in token.service.ts)
# Check TIMEOUT in services
```

### Issue: "CORS errors in browser"
```bash
# Check CORS_ORIGIN in .env matches frontend
CORS_ORIGIN="http://localhost:3001"

# Or allow all (development only)
CORS_ORIGIN="*"

# Set credentials in frontend fetch
fetch(url, { credentials: 'include' })
```

## Debugging Commands

```bash
# View logs
docker logs <container_id>
tail -f logs/app.log

# Check process
ps aux | grep node
lsof -i :3000

# Test database connection
npx prisma db execute --stdin

# Check Redis
redis-cli INFO
redis-cli MONITOR

# Profile CPU usage
npm analyze
node --prof src/index.ts

# Memory dump
node --heap-prof src/index.ts
```

## Getting Help

1. **Check logs first**: `npm run dev` shows all errors
2. **Read Prisma docs**: https://prisma.io/docs
3. **Test endpoints**: Use curl or Postman
4. **Check environment**: `echo $DATABASE_URL`
5. **Enable verbose logging**: `DEBUG=* npm run dev`

---

**Still stuck?** Check the GitHub issues or create a detailed bug report with:
- Error message
- Steps to reproduce
- Environment (OS, Node version)
- Logs output
