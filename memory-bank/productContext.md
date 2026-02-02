# Product Context: eLink

## Problem Statement

### For EV Drivers
- Finding available chargers is difficult
- No unified payment system
- Unclear pricing before charging
- No booking/reservation capability

### For Charger Owners
- No easy way to monetize existing chargers
- Complex OCPP management
- No user verification system
- Difficult to manage multiple stations

## Solution

### Driver Experience
1. Open app → see map of nearby chargers
2. Tap station → see real-time status, pricing, connector types
3. Navigate → integrated maps
4. Start charging → tap button or scan QR
5. Pay → card payment, track session in real-time
6. Finish → automatic billing, receipt

### Owner Experience
1. Register → create account, verify email
2. Add charger → enter ID, location, specs
3. Submit verification → upload ownership docs, electrical certs
4. Admin approval → charger goes live
5. Monitor → see usage, revenue, analytics
6. Manage → remote commands, pricing, availability

## Key User Flows

### Driver Charging Flow
```
Open App → Map View → Select Station → View Details 
→ Start Charging → Payment → Charging Screen 
→ Stop Charging → Receipt
```

### Owner Onboarding Flow
```
Register → Email Verify → Add Charger → Submit Documents 
→ Admin Review → Approved → Charger Live
```

## Differentiation
- Simple, fast PWA (no app store needed)
- CitrineOS integration for scalability
- Built-in verification (trust/safety)
- Owner-friendly (easy charger management)

## Business Model
- Commission on transactions (X%)
- SaaS subscription for owners (future)
- White-label option (future)
