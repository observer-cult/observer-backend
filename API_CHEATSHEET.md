# 🔌 Observer Protocol API - Quick Reference

## Base URL
```
http://localhost:3000/api
```

## Authentication Endpoints

### Get Nonce
```bash
POST /auth/nonce
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b844Bc92db0b18D46F"
}

# Response
{
  "success": true,
  "data": {
    "nonce": "0x742d35Cc6634C0532925a3b844Bc92db0b18D46F:1234567890:abc123",
    "expiresAt": "2024-04-26T15:10:00.000Z"
  }
}
```

### Verify Signature & Get JWT
```bash
POST /auth/verify
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b844Bc92db0b18D46F",
  "nonce": "0x742d35Cc6634C0532925a3b844Bc92db0b18D46F:1234567890:abc123",
  "signature": "0x..."
}

# Response (sets auth_token cookie)
{
  "success": true,
  "data": {
    "user": {
      "address": "0x...",
      "username": "observer_sage",
      "tier": 3,
      "avatar": "https://..."
    },
    "token": "eyJ...",
    "expiresAt": "2024-05-03T15:00:00.000Z"
  }
}
```

### Refresh Token
```bash
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

## User Endpoints

### Get Current User Profile
```bash
GET /users/me
# Requires: auth cookie

# Response
{
  "success": true,
  "data": {
    "address": "0x...",
    "username": "observer_sage",
    "bio": "Exploring DeFi",
    "tier": 3,
    "obsBalance": "150000000000000000000",
    "createdAt": "2024-04-20T..."
  }
}
```

### Get User Tier
```bash
GET /users/me/tier
# Requires: auth cookie

# Response
{
  "success": true,
  "data": {
    "tier": 3,
    "label": "Sage",
    "tokenBalance": "150000000000000000000"
  }
}
```

### Update Profile
```bash
PUT /users/me
Content-Type: application/json
# Requires: auth cookie

{
  "username": "new_name",
  "bio": "New bio",
  "avatar": "https://..."
}
```

### Get Public Profile
```bash
GET /users/0x742d35Cc6634C0532925a3b844Bc92db0b18D46F

# Response
{
  "success": true,
  "data": {
    "address": "0x...",
    "username": "observer_sage",
    "tier": 3,
    "postCount": 42,
    "transmissionCount": 12,
    "createdAt": "2024-04-20T..."
  }
}
```

## Feed Endpoints

### Get Feed (Paginated)
```bash
GET /feed?skip=0&take=20&cursor=post_id

# Response
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "post_123",
        "content": "Bull flag detected",
        "author": {
          "address": "0x...",
          "username": "observer",
          "avatar": "https://..."
        },
        "tier": 0,
        "tokenMention": "0x...",
        "reactionCount": 42,
        "commentCount": 5,
        "createdAt": "2024-04-26T..."
      }
    ],
    "nextCursor": "post_120"
  }
}
```

### Create Post
```bash
POST /feed
Content-Type: application/json
# Requires: auth cookie, T1+

{
  "content": "Spotted a reversal pattern",
  "tier": 0,
  "tokenMention": "0x1234567890123456789012345678901234567890"
}

# Response
{
  "success": true,
  "data": {
    "id": "post_124",
    "content": "Spotted a reversal pattern",
    ...
  }
}
```

### React to Post
```bash
POST /feed/post_123/react
Content-Type: application/json
# Requires: auth cookie

{
  "reactionType": "fire"
}
# Options: "like", "fire", "eye"
```

### Comment on Post
```bash
POST /feed/post_123/comment
Content-Type: application/json
# Requires: auth cookie

{
  "content": "Great observation!"
}
```

### Delete Post
```bash
DELETE /feed/post_123
# Requires: auth cookie, owner
```

## Cult Endpoints

### List Cults
```bash
GET /cults?skip=0&take=20

# Response
{
  "success": true,
  "data": [
    {
      "id": "cult_1",
      "name": "DeFi Maximalists",
      "description": "Serious traders only",
      "minTier": 2,
      "memberCount": 45,
      "recentTransmissionCount": 8,
      "createdAt": "2024-04-20T..."
    }
  ]
}
```

### Create Cult
```bash
POST /cults
Content-Type: application/json
# Requires: auth cookie, T3+

{
  "name": "Smart Contracts Research",
  "description": "Deep dive into SC security",
  "minTier": 2
}
```

### Get Cult Details
```bash
GET /cults/cult_1

# Response
{
  "success": true,
  "data": {
    "id": "cult_1",
    "name": "DeFi Maximalists",
    "memberCount": 45,
    "members": [
      {
        "userAddress": "0x...",
        "username": "observer",
        "joinedAt": "2024-04-20T..."
      }
    ],
    "recentTransmissions": [...]
  }
}
```

### Join Cult
```bash
POST /cults/cult_1/join
# Requires: auth cookie, sufficient tier
```

### Leave Cult
```bash
POST /cults/cult_1/leave
# Requires: auth cookie, member
```

### Post Transmission in Cult
```bash
POST /cults/cult_1/transmit
Content-Type: application/json
# Requires: auth cookie, member

{
  "tokenAddress": "0x1234567890123456789012345678901234567890",
  "chain": "ethereum",
  "entryPrice": "1500000000000000000",
  "targetPrice": "1800000000000000000"
}
```

## Transmission Endpoints

### List Transmissions
```bash
GET /transmissions?skip=0&take=20

# Response includes current PnL for open positions
{
  "success": true,
  "data": [
    {
      "id": "tx_1",
      "tokenAddress": "0x...",
      "entryPrice": "1500000000000000000",
      "targetPrice": "1800000000000000000",
      "currentPrice": "1650000000000000000",
      "pnlPercent": 10
      "isWin": true,
      "status": "open",
      "creator": {
        "address": "0x...",
        "username": "observer"
      },
      "createdAt": "2024-04-26T..."
    }
  ]
}
```

### Create Transmission
```bash
POST /transmissions
Content-Type: application/json
# Requires: auth cookie, T2+

{
  "tokenAddress": "0x1234567890123456789012345678901234567890",
  "chain": "ethereum",
  "entryPrice": "1500000000000000000",
  "targetPrice": "1800000000000000000"
}
```

### Get Transmission Details
```bash
GET /transmissions/tx_1

# Response includes real-time PnL
{
  "success": true,
  "data": {
    "id": "tx_1",
    "pnlPercent": 10.5,
    "isWin": true,
    "status": "open"
  }
}
```

### Close Transmission
```bash
PUT /transmissions/tx_1/close
Content-Type: application/json
# Requires: auth cookie, creator

{
  "exitPrice": "1750000000000000000"
}

# Response
{
  "success": true,
  "data": {
    "id": "tx_1",
    "exitPrice": "1750000000000000000",
    "pnlPercent": 16.67,
    "isWin": true,
    "closedAt": "2024-04-26T...",
    "status": "closed"
  }
}
```

### Get Leaderboard
```bash
GET /transmissions/leaderboard?limit=50

# Response
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userAddress": "0x...",
      "username": "trade_master",
      "winRate": 78.5,
      "totalCalls": 47,
      "totalPNL": 342.5
    }
  ]
}
```

## Analytics Endpoints

### Get User PnL History
```bash
GET /analytics/pnl?days=30
# Requires: auth cookie

# Response
{
  "success": true,
  "data": {
    "totalCalls": 42,
    "wins": 28,
    "losses": 14,
    "winRate": 66.67,
    "totalPNL": 245.8,
    "avgPNL": 5.85,
    "weeklyGraph": {
      "0": { "totalPnL": 50, "wins": 4, "losses": 1 },
      ...
    },
    "history": [...]
  }
}
```

### Get Trending Tokens
```bash
GET /analytics/trends?limit=20

# Response
{
  "success": true,
  "data": [
    {
      "token": "0x...",
      "mentions": 145,
      "price": 1.52
    }
  ]
}
```

### Get Sentiment Analysis
```bash
GET /analytics/sentiment

# Response
{
  "success": true,
  "data": [
    {
      "token": "0x...",
      "mentions": 89,
      "reactions": 342,
      "sentimentScore": 3.84
    }
  ]
}
```

## Token Endpoints

### Lookup Token
```bash
GET /tokens/lookup/0x1234567890123456789012345678901234567890

# Response
{
  "success": true,
  "data": {
    "address": "0x...",
    "name": "Ethereum",
    "symbol": "ETH",
    "decimals": 18
  }
}
```

### Get Token Price
```bash
GET /tokens/price/0x1234567890123456789012345678901234567890

# Response
{
  "success": true,
  "data": {
    "address": "0x...",
    "price": 2450.50,
    "currency": "USD",
    "timestamp": 1714147200000
  }
}
```

## Common Query Parameters

| Parameter | Type | Default | Max | Example |
|-----------|------|---------|-----|---------|
| skip | number | 0 | - | `?skip=20` |
| take | number | 20 | 100 | `?take=50` |
| cursor | string | - | - | `?cursor=id_123` |
| limit | number | 50 | 500 | `?limit=100` |
| days | number | 30 | 365 | `?days=90` |

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Auth required |
| 403 | Forbidden - Insufficient tier |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limited |
| 500 | Server Error |

## Rate Limiting

- **Limit**: 100 requests per minute per wallet
- **Headers**: 
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 87`

---

**Quick Tips:**
- Always include `Content-Type: application/json` for POST/PUT requests
- JWT is automatically handled via HTTP-only cookies (no manual header needed)
- Wallet addresses must be checksummed (use ethers.js `getAddress()`)
- Prices are in wei (smallest unit), use BigInt for calculations
- Times are ISO 8601 format
