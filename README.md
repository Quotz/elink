# eLink - EV Charging PWA with OCPP 1.6-J

## Project Overview

eLink is a progressive web app for controlling OCPP-compliant electric vehicle charging stations. Built for real-world deployment at app.elink.mk.

### Core Purpose
Enable EV charger owners to monetize their stations and drivers to find/charge at available stations.

### Target Users
- **Drivers**: Find chargers, pay, charge, track sessions
- **Owners**: Register chargers, verify ownership, set pricing, monitor usage
- **Admins**: Verify chargers/owners, manage platform

## Quick Start

```bash
npm install
npm start          # Production
npm run dev        # Development with auto-reload
```

## Environment Variables

```bash
# Required
JWT_SECRET=your-secret-key
PORT=3000

# Optional (for CitrineOS integration)
CITRINEOS_URL=http://localhost:8080
CITRINEOS_API_KEY=your-api-key

# Optional (for email)
SMTP_HOST=smtp.example.com
SMTP_USER=user@example.com
SMTP_PASS=password
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   eLink     │────▶│  CitrineOS   │◀────│  EV Chargers    │
│   (PWA)     │     │  (OCPP Hub)  │     │  (OCPP 1.6/2.0) │
└──────┬──────┘     └──────────────┘     └─────────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│  SQLite     │     │   Redis      │
│  (Users,    │     │  (Sessions,  │
│   bookings) │     │   real-time) │
└─────────────┘     └──────────────┘
```

## API Documentation

See memory-bank/techContext.md for full API specs.

## Deployment

```bash
./deploy.sh stable   # Deploy v1.0
./deploy.sh dev      # Deploy v2.0
./deploy.sh rollback # Emergency rollback
```

## Tags

- `v1.0-stable` - Original production version
- `v2.0-dev` - Current with auth/CitrineOS

## Documentation

- `QUICKREF.md` - Command cheatsheet
- `memory-bank/` - Project context (see below)
- `docs/history/` - Legacy documentation
