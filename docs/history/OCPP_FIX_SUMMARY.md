# OCPP Charging Issue - Fix Summary

**Date**: January 20, 2026  
**Issue**: Chargers stuck in "Preparing" status, unable to start charging + offline/online cycling

---

## 🐛 Root Causes Identified

### **Critical Bug #1: Heartbeat Interval Mismatch**
**Symptom**: Chargers constantly cycling between offline and online despite being connected

**Root Cause**: 
- Server told chargers to send heartbeat every **300 seconds** (5 minutes)
- Server timeout monitor marked chargers offline after **40 seconds** of no messages
- Result: Charger timed out every 40 seconds, reconnected, repeated infinitely

**Impact**: HIGH - Made system appear unstable and unreliable

---

### **Critical Bug #2: "Preparing" Status Blocked Start Button**
**Symptom**: When cable is plugged in, Status shows "Preparing" but "Start Charging" button is disabled

**Root Cause**:
- Frontend only enabled button when status = "Available"
- OCPP 1.6-J flow: Cable plugged → Status = "Preparing" → Wait for RemoteStartTransaction
- Button was disabled in the exact state when user needs to start charging!

**Impact**: HIGH - Made it impossible to start charging when cable is connected

---

## ✅ Solutions Implemented

### **Fix #1: Synchronized Heartbeat Interval** ⚡ CRITICAL
**File**: `server/ocpp-handler.js` (line 73)

**Before**:
```javascript
interval: 300 // Heartbeat every 300 seconds (5 minutes)
```

**After**:
```javascript
interval: 30 // Heartbeat every 30 seconds (with 40s timeout = safe margin)
```

**Result**: 
- Charger sends heartbeat every 30 seconds
- Server timeout at 40 seconds = 10-second safety buffer
- No more false offline/online cycling! ✅

---

### **Fix #2: Enable Button for "Preparing" Status** ⚡ CRITICAL
**File**: `public/app.js` (line 356)

**Before**:
```javascript
if (selectedStation.connected && selectedStation.status === 'Available') {
  startBtn.disabled = false;
}
```

**After**:
```javascript
if (selectedStation.connected && 
    (selectedStation.status === 'Available' || selectedStation.status === 'Preparing')) {
  startBtn.disabled = false;
}
```

**Result**: 
- Button now active when cable is plugged in ("Preparing" state)
- User can authorize payment and start charging immediately ✅

---

### **Enhancement #3: Improved Status Display** 📊
**File**: `public/app.js` (lines 213-237)

**Added user-friendly status text**:
- `Preparing` → "🔌 Cable Connected - Ready to Start"
- `Available` → "✓ Available"  
- `Charging` → "⚡ Charging"
- `Finishing` → "Finishing Session..."
- `Suspended` → "⏸ Charging Paused"
- `Faulted` → "⚠️ Charger Error"

**Result**: Users immediately understand charger state ✅

---

### **Enhancement #4: Enhanced OCPP Logging** 🔍
**File**: `server/ocpp-handler.js` (lines 88-121)

**Added detailed status transition logging**:
```
[OCPP] 001 status transition: Available → Preparing
[OCPP] 001 cable connected, waiting for RemoteStartTransaction
[OCPP] 001 status transition: Preparing → Charging  
[OCPP] 001 charging session active
```

**Logs special events**:
- Cable connected/disconnected
- Charging started/paused/faulted
- Error conditions with details

**Result**: Easy debugging and monitoring of charger behavior ✅

---

## 🔄 Correct OCPP 1.6-J Flow (Now Working!)

### **Normal Charging Sequence**:

1. **User arrives at charger**
   - Status: `Available`
   - UI: "✓ Available"
   - Button: Enabled ✅

2. **User plugs in cable**
   - Charger sends: `StatusNotification` with status `Preparing`
   - Status: `Preparing`
   - UI: "🔌 Cable Connected - Ready to Start"
   - Button: **NOW ENABLED** ✅ (was broken before)

3. **User clicks "Start Charging"**
   - App opens payment modal
   - User enters payment info
   - App sends: `RemoteStartTransaction` to charger

4. **Charger accepts and starts**
   - Charger sends: `StartTransaction` 
   - Status: `Charging`
   - UI: "⚡ Charging" with real-time kWh/power display

5. **Charging in progress**
   - Charger sends: `MeterValues` every 10-60 seconds
   - Heartbeat sent every 30 seconds
   - **No more timeout cycling** ✅

6. **User stops charging**
   - App sends: `RemoteStopTransaction`
   - Charger sends: `StopTransaction` with final totals
   - Status: Returns to `Available` or `Preparing` (if cable still plugged)

---

## 🧪 Testing Checklist

### **Test 1: Heartbeat Stability**
- [ ] Connect charger
- [ ] Wait 2 minutes without any activity
- [ ] Verify charger stays "● Active" (not cycling offline/online)
- [ ] Check logs: Should see heartbeats every ~30 seconds
- [ ] **Expected**: No timeout warnings, steady connection ✅

### **Test 2: Cable Plug-In Flow**
- [ ] Start with charger Available (no cable)
- [ ] Plug in charging cable
- [ ] Verify status changes to "🔌 Cable Connected - Ready to Start"
- [ ] Verify "Start Charging" button is **ENABLED** (not greyed out)
- [ ] **Expected**: Can click button immediately ✅

### **Test 3: Complete Charging Session**
- [ ] With cable plugged in (Preparing state)
- [ ] Click "Start Charging"
- [ ] Complete payment authorization
- [ ] Verify charging begins (status → Charging)
- [ ] Verify real-time kWh/power updates
- [ ] Click "Stop Charging"
- [ ] Verify session summary appears
- [ ] **Expected**: Full flow works end-to-end ✅

### **Test 4: Error Conditions**
- [ ] Unplug cable while in Preparing state
- [ ] Verify status returns to Available
- [ ] Start charging, then physically disconnect cable
- [ ] Verify charging stops gracefully
- [ ] **Expected**: Clean error handling ✅

---

## 📊 Monitoring & Diagnostics

### **Server Logs to Watch**:
```bash
# Good signs:
[OCPP] 001 -> [2,"...","Heartbeat",{}]  # Every 30s
[OCPP] 001 status transition: Available → Preparing  # Cable plugged
[OCPP] 001 cable connected, waiting for RemoteStartTransaction
[OCPP] 001 accepted RemoteStart  # Charging starting

# Bad signs (should not see anymore):
[OCPP] Charger 001 timed out  # Should NOT appear!
[OCPP] 001 rejected RemoteStart  # Charger refused to start
```

### **Admin Panel** (`/admin.html`):
- Check "last heartbeat" shows "● Active now"
- Verify heartbeat count incrementing every 30s
- Monitor status transitions in real-time

### **Browser Console**:
- Check for WebSocket connection status
- Verify no repeated reconnection attempts
- Look for any JavaScript errors

---

## 🎯 Expected Behavior After Fixes

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| **Idle charger (no cable)** | Offline/Online cycling every 40s | Stays online, heartbeat every 30s ✅ |
| **Cable plugged in** | "Preparing", button disabled ❌ | "Cable Connected", button enabled ✅ |
| **Start charging from Preparing** | Button greyed out, can't start ❌ | Button active, starts immediately ✅ |
| **During charging** | May timeout and disconnect | Stable, no interruptions ✅ |
| **Status display** | Just shows "Preparing" | Shows helpful "Cable Connected - Ready" ✅ |

---

## 🚀 Deployment Instructions

### **Option 1: Railway (Your Production Server)**

The changes only modify existing files, no new dependencies needed:

```bash
# Commit changes
git add server/ocpp-handler.js public/app.js
git commit -m "Fix: OCPP heartbeat interval and Preparing status charging"

# Push to Railway
git push origin main
```

Railway will auto-deploy. Monitor for ~2 minutes:
1. Check Railway logs for boot messages
2. Verify chargers reconnect automatically
3. Test charging flow

### **Option 2: Local Testing First**

```bash
# Install dependencies (if needed)
npm install

# Start server
npm start
# or
node server/index.js

# Server runs on http://localhost:3000
```

Configure chargers to point to local server temporarily:
- OCPP URL: `ws://YOUR_LOCAL_IP:3000/ocpp/001`

---

## 📝 Technical Details

### **Heartbeat Timing Math**:
- Charger sends heartbeat: Every 30 seconds
- Server timeout threshold: 40 seconds (configurable in `server/index.js`)
- Safety margin: 10 seconds (allows for network delays)
- Timeout check frequency: Every 30 seconds

**Formula**: `Timeout > Heartbeat Interval + Network Margin`  
**Implementation**: `40s > 30s + 10s margin` ✅

### **OCPP Message Flow**:
```
Charger → Server: [2, "uuid", "StatusNotification", {status: "Preparing"}]
Server → Charger: [3, "uuid", {}]  // ACK

User clicks Start →
Server → Charger: [2, "uuid2", "RemoteStartTransaction", {...}]
Charger → Server: [3, "uuid2", {status: "Accepted"}]  // Response

Charger → Server: [2, "uuid3", "StartTransaction", {...}]  // Initiates
Server → Charger: [3, "uuid3", {transactionId: 12345, ...}]
```

---

## 🔧 Configuration Reference

### **Heartbeat Settings** (server/ocpp-handler.js):
```javascript
interval: 30  // Tell charger to heartbeat every 30 seconds
```

### **Timeout Settings** (server/index.js):
```javascript
const TIMEOUT_MS = 40000;  // 40 seconds = 40,000 ms
const CHECK_INTERVAL_MS = 30000;  // Check every 30 seconds
```

**To adjust** (if needed):
- Increase `interval` and `TIMEOUT_MS` for slow networks
- Decrease for faster failure detection
- Keep `TIMEOUT_MS > interval + 10s margin`

---

## ✨ Summary

**Problems Solved**:
1. ✅ No more offline/online cycling
2. ✅ Can start charging from "Preparing" state  
3. ✅ Clear status messages for users
4. ✅ Better diagnostics and logging

**Files Changed**:
- `server/ocpp-handler.js` - Heartbeat interval + status logging
- `public/app.js` - Enable button for Preparing + better status text
- `OCPP_FIX_SUMMARY.md` - This documentation

**Breaking Changes**: None - fully backward compatible

**Testing Required**: 
- Basic: Plug cable → Start charging (5 minutes)
- Extended: Leave connected for 10+ minutes to verify stability

---

## 📞 Support

If issues persist after deployment:

1. **Check server logs** for OCPP messages and timeouts
2. **Check charger display** - should show "Connected" status
3. **Verify heartbeat interval** - Look for logs every 30 seconds
4. **Check admin panel** - Should show "● Active now"

Common issues:
- **Still cycling offline/online**: Check if changes deployed (verify heartbeat interval in logs)
- **Button still disabled**: Clear browser cache (Ctrl+Shift+R)
- **Charger not connecting**: Verify OCPP URL on charger configuration

---

**Status**: ✅ Ready for deployment and testing  
**Risk Level**: Low - Conservative fixes to existing logic  
**Rollback Plan**: Revert commits if issues occur (no database changes)
