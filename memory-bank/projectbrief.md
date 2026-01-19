# Project Brief: EV Charging PWA with OCPP 1.6-J

## Project Overview

A progressive web application (PWA) that enables remote control and monitoring of real OCPP-compliant electric vehicle charging stations via mobile phone. This is a demo/prototype system designed to showcase the capability of controlling physical chargers through a web-based interface.

## Core Objectives

1. **Remote Charger Control** - Start and stop EV charging sessions remotely from any mobile device
2. **Real-time Monitoring** - Display live charging status, power consumption, and energy delivered
3. **Station Discovery** - Show available charging stations on an interactive map
4. **Payment Integration** - Demonstrate payment flow (mock implementation for demo)
5. **OCPP Compatibility** - Full OCPP 1.6-J protocol implementation for industry-standard chargers

## Project Scope

### In Scope
- Progressive web app for mobile-first experience
- OCPP 1.6-J WebSocket server for charger communication
- Real-time bidirectional communication (server ↔ chargers ↔ browser clients)
- Map-based station selection interface
- Start/stop transaction commands
- Live status updates (Available, Charging, Offline)
- Energy consumption tracking (kWh, power in watts)
- Mock payment processing interface

### Out of Scope
- User authentication system
- Database persistence (using in-memory state)
- Production payment gateway integration
- Advanced charger diagnostics
- Multi-tenant support
- Mobile native app (PWA only)
- OCPP 2.0+ support (only 1.6-J)

## Target Hardware

- **Type**: AC EV charging stations (Level 2)
- **Protocol**: OCPP 1.6-J (JSON over WebSocket)
- **Units**: 2 chargers
  - Station 1: 7kW AC charger (UID: 001)
  - Station 2: 22kW AC charger (UID: 002)
- **Location**: Skopje, Macedonia

## Timeline & Context

- **Nature**: Demo/prototype project
- **Deadline**: Demo scheduled for next day after initial development
- **Priority**: Functionality over polish - working demo is the goal
- **Deployment**: Live on Railway platform (https://elink-production.up.railway.app/)

## Success Criteria

1. Chargers successfully connect to server via OCPP WebSocket
2. User can open PWA on phone and see stations on map
3. User can start charging remotely after "payment"
4. Real-time charging data displays in the app
5. User can stop charging remotely
6. System runs stably during demo

## Technical Constraints

- Must use WebSocket for both OCPP and browser communication
- Must support OCPP 1.6-J subprotocol negotiation
- Must be deployable to free-tier hosting (Railway)
- Must work on mobile browsers (iOS Safari, Chrome)
- Must handle WebSocket over TLS (wss://)

## Key Stakeholders

- **End User**: Person demonstrating the system (tomorrow)
- **Target Audience**: Demo attendees seeing remote EV charging control
- **Hardware**: Real OCPP-compliant charging stations

## Project Type

Demo/Prototype - Prioritizing core functionality and stability for demonstration purposes over production-grade features like authentication, data persistence, error recovery, and security.
