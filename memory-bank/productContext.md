# Product Context: EV Charging PWA

## Why This Project Exists

Traditional EV charging station management requires:
- Physical presence at the charger location
- RFID cards or dedicated mobile apps per network
- No visibility of charger status before arrival
- Limited remote control capabilities

This PWA demonstrates a modern approach: **universal remote control and monitoring of OCPP-compliant chargers from any mobile browser**, regardless of charger manufacturer or network.

**NEW - Phase 2 Enhancement**: Added professional admin diagnostics panel for comprehensive charger monitoring and management.

## Problems It Solves

### 1. Remote Management
**Problem**: Need to be physically present to start/stop charging  
**Solution**: Control chargers from anywhere via mobile web app

### 2. Real-time Visibility
**Problem**: No way to check if charger is available, in use, or offline  
**Solution**: Live status updates and map-based station discovery

### 3. Payment Integration Point
**Problem**: Separate payment and charging control systems  
**Solution**: Integrated payment flow → charging authorization → remote start

### 4. Standardization
**Problem**: Each charger brand/network has different control methods  
**Solution**: OCPP standard protocol works with any compliant charger

### 5. Connection Health Monitoring (NEW - Phase 1)
**Problem**: No way to distinguish between idle chargers and offline chargers  
**Solution**: Heartbeat tracking and automatic timeout detection with "last seen" timestamps

### 6. Operational Diagnostics (NEW - Phase 2)
**Problem**: Limited visibility into charger health, configuration, and history  
**Solution**: Comprehensive admin panel with real-time diagnostics, session history, and configuration viewer

## Target Users

### Primary: Demo Attendees & Stakeholders
Evaluating remote charging control solutions and OCPP integration capabilities

### Secondary: System Administrators (NEW)
Managing charger fleet, monitoring connection health, and troubleshooting issues via admin panel

**End User Flow (Mobile PWA)**:
1. Find available charging stations nearby
2. Pay for charging
3. Start charging their EV remotely
4. Monitor charging progress in real-time
5. Stop charging when done

**Admin User Flow (Desktop/Admin Panel)**:
1. Open admin dashboard (`/admin.html`)
2. View all chargers with connection health status
3. Monitor heartbeat activity ("Active now" / "15s ago")
4. Review session history and energy statistics
5. Check charger configuration and capabilities
6. Troubleshoot connection issues with uptime and message counts

## User Experience Goals

### Simplicity (User PWA)
- Open web app (no installation required)
- See stations on familiar map interface
- One-tap to start/stop charging

### Visibility (User PWA + Admin Panel)
- Clear status indicators (Available/Charging/Offline)
- Real-time power and energy readings
- Visual feedback for all actions
- **NEW: Activity indicators showing charger responsiveness**
- **NEW: Connection health metrics (last seen, uptime, message count)**

### Mobile-First (User PWA)
- Works on any modern mobile browser
- Touch-optimized interface
- Responsive design
- PWA installability (add to home screen)

### Professional Monitoring (Admin Panel - NEW)
- Desktop-optimized diagnostics interface
- Comprehensive connection health dashboard
- Session history and analytics
- Configuration viewer
- Real-time updates without page refresh

## Core User Flow

### End User Flow (Mobile PWA)
```
1. Open PWA → See Map
   └─ 2 stations displayed with color-coded status
   └─ NEW: "Active" indicator shows charger responsiveness
   
2. Tap Station → View Details
   └─ Name, power rating, current status
   └─ If charging: live kWh/power updates
   
3. Tap "Start Charging" → Payment Form
   └─ Enter card details (demo - any 16 digits work)
   └─ Mock payment processing (1 second delay)
   
4. Payment Accepted → Authorize Charging
   └─ Server sends RemoteStartTransaction to charger
   └─ Charger responds with acceptance
   
5. Charging Begins → Real-time Updates
   └─ Status changes to "Charging"
   └─ kWh counter increments
   └─ Power (watts) displays
   └─ Duration timer runs
   └─ NEW: Session tracked for history
   
6. Tap "Stop Charging" → End Session
   └─ Server sends RemoteStopTransaction
   └─ Final kWh and cost displayed
   └─ Station returns to "Available"
   └─ NEW: Session saved to history (last 50 stored)
```

### Admin Flow (Admin Dashboard - NEW)
```
1. Open Admin Panel (`/admin.html`)
   └─ View all stations in diagnostic cards
   
2. Monitor Connection Health
   └─ See "● Active now" for responsive chargers
   └─ See "15s ago" for chargers with delayed activity
   └─ View uptime since last connection
   └─ Monitor message count (total OCPP messages)
   
3. Review Charger Information
   └─ Firmware version and model
   └─ Serial number
   └─ Vendor information
   
4. Analyze Session History
   └─ Last 50 charging sessions per charger
   └─ Energy delivered, duration, cost
   └─ Average power per session
   └─ Stop reason
   
5. Check Configuration
   └─ View all configuration keys
   └─ See current values
   └─ Identify supported capabilities
   
6. Troubleshoot Issues
   └─ Check last heartbeat timestamp
   └─ Verify message count is incrementing
   └─ Look for timeout patterns
   └─ Review recent session failures
```

## Key Features

### Map View (User PWA)
- Interactive Leaflet.js map
- Station markers with status colors
- Tap marker to select station
- Center on user location (if permitted)

### Station Cards (User PWA)
- Station name and power rating
- Connection status (online/offline)
- Current state (Available/Charging/Preparing)
- Action buttons (Start/Stop)
- **NEW: Activity indicator ("Active" status)**

### Live Charging Display (User PWA)
- Real-time kWh delivered
- Current power draw (watts)
- Session duration
- Estimated cost
- Animated charging indicator

### Payment Interface (User PWA)
- Card number input (masked for demo)
- Expiry and CVV fields
- "Processing" animation
- Success/failure feedback
- Token generation for charging authorization

### Admin Dashboard (NEW - Separate Interface)
- **Access**: `/admin.html` - Professional diagnostics panel
- **Connection Health Monitoring**:
  - Live status indicator (● Active now / Offline)
  - Last seen timestamp ("15s ago" or "Active now")
  - Connection uptime (hours/minutes)
  - Total message count
- **Charger Information**:
  - Firmware version and model
  - Serial number
  - Vendor information
  - Connector details
- **Session History**:
  - Last 50 charging sessions per charger
  - Energy delivered, duration, cost
  - Average power per session
  - Stop reason (RemoteStop, Local, etc.)
- **Configuration Viewer**:
  - All charger configuration keys
  - Current values
  - Detected capabilities
- **Real-Time Updates**:
  - WebSocket connection to same `/live` endpoint
  - Automatic refresh as data changes
  - No page reload needed

### Connection Health (NEW - Phase 1)
- **Heartbeat Tracking**: Updates on every OCPP message
- **Timeout Detection**: Automatic offline marking after 40 seconds
- **Last Seen Display**: Shows "Active now" or time since last activity
- **Uptime Tracking**: Displays how long charger has been connected
- **Message Count**: Total OCPP messages received for activity verification

## Design Principles

### Demo-Focused
- Prioritize working functionality over edge case handling
- Mock payment always succeeds (with valid-looking card number)
- Clear visual feedback over subtle UI polish

### Real-Time First
- WebSocket connection for instant updates
- No page refreshes needed
- Live status changes reflected immediately
- **NEW: Activity tracking updates in real-time**

### Fail-Safe
- Show offline chargers clearly
- Disable actions when not applicable
- Display error messages when operations fail
- **NEW: Automatic timeout detection prevents false online status**

### Observable (NEW - Phase 2)
- Comprehensive diagnostics available via admin panel
- Connection health visible at a glance
- Session history preserved for analysis
- Configuration transparency for troubleshooting

## Technical Requirements for UX

### Performance
- Map loads quickly
- Station updates are instant
- No lag in charging data display
- **NEW: Admin panel responsive with real-time updates**

### Reliability
- Maintain WebSocket connection
- Reconnect automatically if dropped
- Show connection status to user
- **NEW: Timeout detection catches dead connections**
- **NEW: Heartbeat tracking ensures accurate status**

### Responsive
- Works on phone screens (320px+)
- Touch targets sized appropriately
- Readable text without zooming
- **NEW: Admin panel optimized for desktop viewing**

## Success Metrics (Demo Context)

### User PWA Success Criteria
1. **Clarity**: Demo attendee understands flow without explanation
2. **Reliability**: No crashes or errors during demo
3. **Responsiveness**: Updates appear instantly
4. **Visual Impact**: Charging data updates are compelling to watch
5. **Simplicity**: Can start charging in under 30 seconds from app open

### Admin Panel Success Criteria (NEW)
1. **Visibility**: Connection status clear at a glance
2. **Actionable Data**: Diagnostics help identify and resolve issues
3. **Professional**: Looks like a production monitoring tool
4. **Real-Time**: Updates without manual refresh
5. **Comprehensive**: All relevant charger data accessible

### Overall System Success (ACHIEVED)
- ✅ Chargers show accurate online/offline status
- ✅ Remote start/stop commands work reliably
- ✅ Real-time charging data flows
- ✅ Session history tracked and accessible
- ✅ Connection health monitored continuously
- ✅ Professional admin interface for diagnostics
- ✅ Zero crashes during extended testing

## Out of Scope (by Design)

### User Features (Intentionally Excluded)
- User accounts/authentication
- Saved payment methods
- Charging history (user-facing)
- Notifications
- Trip planning
- Multi-language support
- Accessibility features (beyond browser defaults)
- Complex error recovery flows

### Admin Features (Intentionally Excluded)
- Admin authentication (demo on trusted network)
- User management
- Charger provisioning UI
- Firmware update UI
- Alert configuration
- Report generation
- Data export tools
- Real-time charting (Chart.js)

These are intentionally excluded to focus on the core demo value proposition: **remote control actually works with real hardware, and connection health is robustly monitored**.

## Value Delivered

### For End Users
- **Convenience**: Start/stop charging from anywhere
- **Visibility**: Know before you go (charger availability)
- **Speed**: Sub-30-second charging initiation
- **Flexibility**: Works on any modern browser

### For Administrators (NEW)
- **Monitoring**: Real-time connection health visibility
- **Troubleshooting**: Comprehensive diagnostics at fingertips
- **Analytics**: Session history for usage patterns
- **Configuration**: View charger settings without physical access
- **Confidence**: Know chargers are online and responsive

### For Demo/Stakeholders
- **Proof of Concept**: OCPP integration actually works
- **Professional**: Admin panel shows production-ready thinking
- **Comprehensive**: Both user and admin interfaces demonstrated
- **Reliable**: Robust connection monitoring prevents embarrassing demo failures
- **Extensible**: Clear foundation for production features

## Evolution from Initial Vision

### Phase 0 (Initial)
- Basic PWA with map
- Mock payment
- Remote start/stop (theory)

### Phase 1 (Connection Health - COMPLETE)
- Added heartbeat tracking
- Implemented timeout detection
- Activity status display
- Connection health metrics
- Session history storage
- Meter history storage

### Phase 2 (Admin & Enhanced OCPP - COMPLETE)
- Built admin diagnostics panel
- Created OCPP commands module (11 commands)
- Enhanced meter value tracking
- Configuration storage and display
- Capabilities detection
- Professional monitoring interface

### Current State (v2.1)
**Production-ready demo** with comprehensive monitoring, robust connection health tracking, and professional diagnostics capabilities. Exceeds initial demo requirements and provides foundation for production system.

## Key Differentiators

1. **Works with Real Hardware**: Not a simulator - actual OCPP chargers
2. **Universal**: Any OCPP 1.6-J compliant charger supported
3. **No App Store**: PWA runs in browser, no installation
4. **Real-Time**: WebSocket-based instant updates
5. **Comprehensive Monitoring**: Admin panel for operational visibility (NEW)
6. **Robust Connection Tracking**: Heartbeat monitoring prevents false status (NEW)
7. **Minimal Dependencies**: Simple tech stack, easy to understand
8. **Demo-Ready**: Stable, tested, documented, professional

This product successfully demonstrates the power of OCPP-based universal EV charger control and monitoring, providing both user-facing convenience and admin-facing operational transparency.
