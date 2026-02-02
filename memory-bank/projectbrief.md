# Project Brief: eLink

## Overview
eLink is an EV Charging Progressive Web App (PWA) that connects EV drivers with charging station owners via OCPP protocol.

## Core Requirements

### Must Have (MVP)
- [x] OCPP 1.6-J WebSocket communication with chargers
- [x] Real-time charger status (Available/Charging/Offline)
- [x] Remote start/stop charging
- [x] Map-based station discovery
- [x] Payment processing (mock/demo)
- [x] PWA support (offline capable)

### Version 2.0 (In Progress)
- [x] User authentication (JWT)
- [x] Role-based access (driver/owner/admin)
- [x] Charger ownership verification
- [x] Email verification system
- [x] CitrineOS OCPP hub integration
- [ ] Email SMTP integration
- [ ] Frontend auth UI
- [ ] Document upload (ownership proof)

### Future
- [ ] Mobile apps (iOS/Android)
- [ ] Dynamic pricing
- [ ] Reservation system
- [ ] Fleet management
- [ ] OCPP 2.0.1 support

## Success Metrics
- Uptime: 99.5%+
- Charger connection reliability
- Payment success rate
- User registration conversion

## Constraints
- Must support OCPP 1.6-J (current charger fleet)
- SQLite for simplicity (can migrate to PostgreSQL later)
- Single VPS deployment (for now)
- HTTPS/WSS required for production
