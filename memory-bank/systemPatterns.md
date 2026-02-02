# System Patterns: eLink

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Browser   │  │    PWA      │  │   Mobile (future)   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          └────────────────┴────────────────────┘
                             │
                    HTTP/WebSocket
                             │
┌────────────────────────────┼────────────────────────────────┐
│                      API Layer                              │
│  ┌─────────────────────────┼──────────────────────────────┐ │
│  │                    Express Server                      │ │
│  │  ┌─────────┐ ┌─────────┐ │ ┌───────────┐ ┌──────────┐ │ │
│  │  │/api/auth│ │/api/ver│ │ │/api/citrin│ │ /ocpp    │ │ │
│  │  │  routes │ │ routes  │ │ │  routes   │ │websocket │ │ │
│  │  └────┬────┘ └────┬────┘ │ └─────┬─────┘ └────┬─────┘ │ │
│  └───────┼───────────┼──────┴───────┼────────────┼────────┘ │
└──────────┼───────────┼──────────────┼────────────┼──────────┘
           │           │              │            │
           ▼           ▼              ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Database   │  │   CitrineOS  │  │  OCPP Handler    │  │
│  │   (SQLite)   │  │    Client    │  │   (WebSocket)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Patterns

### 1. Layered Architecture
- **Routes**: HTTP endpoint definitions, validation
- **Services**: Business logic (database.js, citrine-client.js)
- **Data Access**: Direct SQLite queries

### 2. Authentication Pattern
```javascript
// JWT stored in httpOnly cookie + localStorage backup
// Access token: 15min, Refresh token: 7 days
// Middleware attaches req.user with role info

// Usage in routes:
app.post('/api/protected', authenticateToken, requireRole('owner'), handler)
```

### 3. Database Pattern
```javascript
// Promises for async
// Centralized in database.js
// Auto-creates tables on init

const user = await db.createUser({...})
const stations = await db.getStations()
```

### 4. WebSocket Pattern
```javascript
// Dual WebSocket servers:
// - ocppWss: Chargers (OCPP protocol)
// - browserWss: Frontend clients

// Broadcast updates to all browsers
broadcastUpdate() // sends to all browserWss clients
```

### 5. Error Handling Pattern
```javascript
// All routes wrapped in try/catch
// Consistent error response format
// Log errors with console.error

try {
  // ... operation
} catch (error) {
  console.error('[Module] Action error:', error)
  res.status(500).json({ error: 'User-friendly message' })
}
```

## Critical Implementation Paths

### Charger Connection Flow
```
Charger → WS /ocpp/{chargerId} → ocpp-handler.js 
→ store.updateStation() → broadcastUpdate() 
→ Browser clients receive update
```

### Authentication Flow
```
POST /api/auth/login → validate → generateTokens 
→ createSession → return {accessToken, refreshToken}

Subsequent requests:
Authorization: Bearer {accessToken} → verify 
→ attach req.user → route handler
```

### Verification Flow
```
Owner submits → POST /api/verification/submit-charger 
→ db.createChargerVerification → status: pending

Admin reviews → POST /api/verification/admin/review 
→ db.updateVerificationStatus → if approved → charger live
```

## Component Relationships

### Database Relations
```
users ||--o{ charger_owners : owns
users ||--o{ transactions : makes
users ||--o{ user_sessions : has
charger_owners ||--|| charger_verifications : verifies
transactions }o--|| stations : at
```

### Service Dependencies
```
citrine-client.js → (optional) CitrineOS server
ocpp-handler.js → store.js (state management)
auth.js → database.js (session storage)
All routes → database.js
```

## Anti-Patterns to Avoid

1. **Don't** store sensitive data in JWT payload (keep it minimal: userId only)
2. **Don't** run long queries without timeouts
3. **Don't** trust charger-reported data without validation
4. **Don't** expose stack traces in production errors
5. **Don't** modify stations.json directly (use store.js methods)
