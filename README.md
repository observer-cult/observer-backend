# Observer Protocol Backend

A production-ready Node.js + Hono + TypeScript REST API for **OBSERVER Protocol** — a self-evolving DAO on Ethereum.

## 🏗️ Architecture

- **Framework**: Hono.js (lightweight, type-safe HTTP framework)
- **Language**: TypeScript 5.0
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis (token prices, user tiers, rate limiting)
- **Authentication**: Wallet signatures + JWT (HTTP-only cookies)
- **Blockchain**: ethers.js v6 for Ethereum integration

## 📋 Project Structure

```
observer-backend/
├── src/
│   ├── index.ts                 # Main application entry point
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client singleton
│   │   ├── redis.ts            # Redis client & cache utilities
│   │   ├── ethereum.ts         # Ethers.js provider & signature verification
│   │   ├── jwt.ts              # JWT token generation & verification
│   │   └── utils.ts            # Utility functions
│   ├── middleware/
│   │   ├── auth.ts             # JWT authentication middleware
│   │   ├── tier.ts             # Tier requirement validation
│   │   └── rateLimit.ts        # Redis-based rate limiting
│   ├── services/
│   │   ├── tier.service.ts     # Tier calculation & balance fetching
│   │   ├── pnl.service.ts      # PnL calculations & leaderboard
│   │   ├── token.service.ts    # Token info & price lookups
│   │   ├── cult.service.ts     # Cult operations & membership
│   │   ├── feed.service.ts     # Feed aggregation & reactions
│   │   └── transmission.service.ts  # Trading signal management
│   ├── routes/
│   │   ├── auth.ts             # Authentication endpoints
│   │   ├── users.ts            # User profile endpoints
│   │   ├── cults.ts            # Cult management endpoints
│   │   ├── feed.ts             # Feed & social endpoints
│   │   ├── transmissions.ts    # Trading signal endpoints
│   │   ├── analytics.ts        # Analytics & sentiment endpoints
│   │   └── tokens.ts           # Token lookup & price endpoints
│   └── validators/
│       └── index.ts            # Zod validation schemas
├── prisma/
│   └── schema.prisma           # Database schema
├── .env.example                # Environment variables template
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies & scripts
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+

### Installation

```bash
# Clone repository
git clone <repo-url>
cd observer-backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Edit .env with your values
nano .env
```

### Environment Setup

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/observer_db"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRY="7d"
REFRESH_TOKEN_EXPIRY="30d"

# Ethereum
ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
OBS_CONTRACT_ADDRESS="0x..." # Your $OBS token contract

# External APIs
COINGECKO_API_KEY="your-api-key"

# Server
PORT=3000
NODE_ENV="development"
```

### Database Setup

```bash
# Push Prisma schema to database
npm run db:push

# OR run migrations (if you have migration files)
npm run db:migrate

# Open Prisma Studio to view data
npm run db:studio
```

### Development

```bash
# Start dev server with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm build
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

## 📡 API Endpoints

### Base URL
All endpoints are prefixed with `/api`

### Authentication

**POST `/auth/nonce`**\
Generate a nonce for wallet signature challenge.

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc92db0b18D46F"
}
```

**POST `/auth/verify`**\
Verify signature and issue JWT token (sets HTTP-only cookie).

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc92db0b18D46F",
  "nonce": "0x742d35Cc6634C0532925a3b844Bc92db0b18D46F:1234567890:random123",
  "signature": "0x...signature..."
}
```

**POST `/auth/refresh`**\
Refresh JWT token using refresh token.

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Users

**GET `/users/me`** *(requires auth)*\
Get current user profile.

**GET `/users/me/tier`** *(requires auth)*\
Get current user tier and token balance.

**PUT `/users/me`** *(requires auth)*\
Update user profile (username, bio, avatar).

```json
{
  "username": "observer_sage",
  "bio": "Exploring the cosmos of DeFi",
  "avatar": "https://..."
}
```

**GET `/users/:address`**\
Get public profile by wallet address.

### Cults

**GET `/cults`**\
List all cults with optional tier filter.

**POST `/cults`** *(requires auth, tier 3+)*\
Create a new cult.

```json
{
  "name": "DeFi Maximalists",
  "description": "For serious traders",
  "minTier": 2
}
```

**GET `/cults/:id`**\
Get cult details with members and recent transmissions.

**POST `/cults/:id/join`** *(requires auth)*\
Join cult if user meets tier requirement.

**POST `/cults/:id/leave`** *(requires auth)*\
Leave cult.

**POST `/cults/:id/transmit`** *(requires auth)*\
Post transmission inside cult.

```json
{
  "tokenAddress": "0x...",
  "chain": "ethereum",
  "entryPrice": "1500000000000000000",
  "targetPrice": "1800000000000000000"
}
```

### Feed

**GET `/feed`**\
Get paginated feed filtered by user tier.

**POST `/feed`** *(requires auth)*\
Create a feed post.

```json
{
  "content": "Just spotted a bull flag on $TOKEN",
  "tier": 0,
  "tokenMention": "0x..."
}
```

**POST `/feed/:id/react`** *(requires auth)*\
React to a post (like, fire, eye).

```json
{
  "reactionType": "fire"
}
```

**POST `/feed/:id/comment`** *(requires auth)*\
Comment on a post.

```json
{
  "content": "Great observation!"
}
```

**DELETE `/feed/:id`** *(requires auth)*\
Delete your own post.

### Transmissions

**GET `/transmissions`**\
Get all public transmissions sorted by recency.

**POST `/transmissions`** *(requires auth)*\
Create a transmission (trading signal).

```json
{
  "tokenAddress": "0x...",
  "chain": "ethereum",
  "entryPrice": "1500000000000000000",
  "targetPrice": "1800000000000000000"
}
```

**GET `/transmissions/:id`**\
Get transmission detail with current PnL.

**PUT `/transmissions/:id/close`** *(requires auth)*\
Close transmission and record exit price/PnL.

```json
{
  "exitPrice": "1750000000000000000"
}
```

**GET `/transmissions/leaderboard`**\
Get ranked transmissions by win rate (min 10 closes to qualify).

### Analytics

**GET `/analytics/pnl`** *(requires auth)*\
Get user PnL history with chart data by week/month.

**GET `/analytics/trends`**\
Get trending token mentions from feed (last 24h).

**GET `/analytics/sentiment`**\
Get feed sentiment score per token.

### Tokens

**GET `/tokens/lookup/:address`**\
Get token name, symbol, decimals via CoinGecko.

**GET `/tokens/price/:address`**\
Get current token price (cached for 60s).

## 🔐 Authentication Flow

### Wallet Signature Authentication

1. **Request Nonce**: Frontend requests a nonce for wallet address
2. **Sign Message**: User signs the nonce with their wallet
3. **Verify & Issue JWT**: Backend verifies signature, issues JWT (stored in HTTP-only cookie)
4. **Subsequent Requests**: Browser automatically includes JWT in cookies

### Token Expiry & Refresh

- JWT expires after 7 days (configurable)
- Consumers can use refresh tokens for token rotation
- Tokens are tied to wallet address, not username

## 📊 Database Schema

### Key Tables

**User**
- `address` (PK): Ethereum wallet address
- `username`: Optional display name
- `bio`: User bio
- `avatar`: Avatar URL
- `tier`: Calculated from $OBS balance (T0-T4)
- `obsBalance`: Current $OBS token balance

**Cult**
- `id` (PK): Unique identifier
- `name`: Cult name
- `description`: Cult purpose
- `minTier`: Minimum tier to join
- `creatorAddress`: Cult creator

**FeedPost**
- `id` (PK): Post ID
- `userAddress`: Creator address
- `content`: Post text
- `tier`: Minimum tier to view
- `tokenMention`: Optional token address

**Transmission**
- `id` (PK): Transmission ID
- `userAddress`: Trading signal creator
- `tokenAddress`: Token being traded
- `entryPrice`: Entry price (wei)
- `targetPrice`: Target price (wei)
- `exitPrice`: Exit price (set on close)
- `pnlPercent`: Calculated PnL percentage
- `isWin`: Win/loss flag

For full schema, see [prisma/schema.prisma](prisma/schema.prisma)

## 🔄 Caching Strategy

### Redis TTL

| Key Type | TTL | Purpose |
|----------|-----|---------|
| Token prices | 60s | Recent token prices |
| User tier | 300s | User tier (re-fetched every 5 min) |
| Feed cursors | 30s | Pagination state |
| Rate limits | 60s | Request counting |

## ⏱️ Rate Limiting

- **Default**: 100 requests per minute per wallet
- **Redis-based**: Tracks per-wallet rate limit counters
- **Headers**: Returns `X-RateLimit-Limit` and `X-RateLimit-Remaining`

## 🎯 Tier System

| Tier | Label | Min Balance | Features |
|------|-------|-------------|----------|
| T0 | Observer | 0 $OBS | View public feed |
| T1 | Sentinel | 1 $OBS | Post content, react |
| T2 | Oracle | 10 $OBS | Create transmissions, join cults |
| T3 | Sage | 100 $OBS | Create cults, advanced analytics |
| T4 | Archon | 1,000 $OBS | All features, priority access |

Thresholds are configurable via environment variables.

## 🔌 Error Handling

All errors follow standard JSON format:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

Common status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request (validation error)
- `401`: Unauthorized (auth required)
- `403`: Forbidden (insufficient tier)
- `404`: Not found
- `429`: Rate limit exceeded
- `500`: Server error

## 🧪 Testing

### API Testing with cURL

```bash
# Generate nonce
curl -X POST http://localhost:3000/api/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc92db0b18D46F"}'

# Get feed
curl http://localhost:3000/api/feed

# Get public profile
curl http://localhost:3000/api/users/0x742d35Cc6634C0532925a3b844Bc92db0b18D46F
```

### With Postman

- Import endpoints into Postman
- Use environment variables for `base_url`, `auth_token`
- Cookie jar for JWT management

## 🚨 Security Considerations

- ✅ HTTP-only cookies for JWT (prevents XSS)
- ✅ CORS configured for specific origins
- ✅ Input validation with Zod on all endpoints
- ✅ Rate limiting to prevent abuse
- ✅ Signature verification for wallet auth
- ✅ Tier gating for privileged operations
- ⚠️ Environment variables for secrets (never commit .env)
- ⚠️ HTTPS only in production (secure cookies)

## 📈 Performance Optimizations

- **Redis caching** for frequently accessed data
- **Database indexing** on hot columns (address, tier, createdAt)
- **Pagination** for large result sets
- **Cursor-based pagination** for feed
- **Connection pooling** via Prisma
- **Async/await** for non-blocking operations

## 🛠️ Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment

```bash
# Production checklist
- Set NODE_ENV=production
- Use strong JWT_SECRET
- Enable HTTPS
- Configure CORS_ORIGIN
- Set up database backups
- Monitor Redis memory usage
- Enable rate limiting
- Set up error logging (Sentry, etc.)
```

## 📚 Documentation

- [Prisma Docs](https://www.prisma.io/docs/)
- [Hono Docs](https://hono.dev/)
- [ethers.js Docs](https://docs.ethers.org/)
- [Zod Docs](https://zod.dev/)

## 🤝 Contributing

1. Create feature branch
2. Follow TypeScript strict mode
3. Add tests for new features
4. Ensure type safety
5. Submit pull request

## 📄 License

MIT

## 🎉 That's it!

Your Observer Protocol backend is ready. Start with `npm run dev` and happy building!

For questions or issues, check the GitHub issues or start a discussion.

---

**Built with ❤️ for OBSERVER Protocol**