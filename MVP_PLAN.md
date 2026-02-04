# eLink MVP - Simplified Plan

## Philosophy
Build fast, demo-ready, no unnecessary complexity. You control everything.

---

## Mobile App: TWA (Trusted Web Activity)
**Solution:** Wrap the existing PWA as an Android app

Why TWA:
- Zero code changes to your web app
- Play Store publishable
- Push notifications supported
- Looks like a native app (no browser chrome)
- Takes 1 day to set up

**What we'll do:**
1. Use Google's `bubblewrap` CLI to generate Android package from PWA
2. Minimal Android Studio project for Play Store submission
3. Add Push Notification support via Firebase

**Alternative:** If Play Store is not needed immediately, users can just "Add to Home Screen" from Chrome (true PWA install).

---

## Features for MVP

### 1. Web App (PWA) Enhancements
Current → New

| Feature | Current | MVP Target |
|---------|---------|------------|
| Auth | API only | Simple login/register pages |
| Wallet | Not exists | Mock wallet (show balance, mock top-up) |
| Payment | None | Mock payment flow (looks real) |
| Reservations | None | Simple time slot booking |
| Map | ✅ Basic | Add navigation links |
| Notifications | None | Push via Firebase + email fallback |

### 2. Admin Panel (Web)
Single panel for you/internal team:

**Dashboard:**
- Total stations / online / charging
- Revenue (mock calculation)
- Active reservations
- Recent transactions

**Station Management:**
- View all chargers
- Edit station details (name, price, location)
- Remote start/stop any charger
- View real-time status

**User Management:**
- View registered users
- Toggle user status

**Reservation Management:**
- View all reservations
- Cancel reservations

**Mock Revenue:**
- Show calculated earnings
- Transaction history
- Export to CSV (for accounting)

### 3. Reservations - Simple Implementation

**Flow:**
1. User selects station → "Reserve" button
2. Pick time slot (30 min increments, next 24h only)
3. Confirm (mock payment hold)
4. Show reservation in user profile
5. Station shows "Reserved" status during slot

**Backend:**
- Simple table: `reservations` (user_id, charger_id, start_time, end_time, status)
- Check conflicts before creating
- Auto-expire if user doesn't start charging within 15 min of slot

### 4. Notifications - Easiest Setup

**Option A: Firebase Cloud Messaging (FCM)**
- Free, reliable push notifications
- Works with TWA
- Fallback to email if push fails

**Email:**
- Use SendGrid free tier (100 emails/day)
- Or AWS SES
- Needed for: welcome, reservation confirmation, charging complete

**Setup:**
1. Firebase project
2. Add FCM to web app
3. TWA handles push permission
4. Email service for fallbacks

### 5. Mock Payment System (Polished)

**Wallet Display:**
- Show balance: €XX.XX
- "Add Funds" button
- Mock Stripe-looking form (card number, expiry, CVC)
- Success animation → balance updates

**Charging Payment:**
- Start charging → shows "Payment pre-authorized"
- Stop charging → shows "Payment processed: €X.XX"
- Receipt page (mock invoice)

**No real money flow** - just calculate and display.

### 6. Analytics - Minimal

For MVP, skip complex analytics. Admin panel shows:
- Total kWh delivered (from OCPP data)
- Total charging sessions
- Revenue = kWh × price_per_kWh (mock calculation)

Real analytics can come post-MVP.

---

## Tech Stack Summary

| Component | Tech |
|-----------|------|
| Backend | Node.js + SQLite (existing) |
| Web App | Vanilla JS + Leaflet (enhance existing) |
| Mobile | TWA (Trusted Web Activity) via bubblewrap |
| Push Notifications | Firebase Cloud Messaging |
| Email | SendGrid or AWS SES |
| Admin Panel | React or enhanced vanilla JS |

---

## Implementation Order (2-3 weeks)

**Week 1:**
- [ ] Auth UI (login/register pages)
- [ ] Simple admin panel (dashboard + station control)
- [ ] Mock wallet + payment UI

**Week 2:**
- [ ] Reservation system (backend + UI)
- [ ] Push notifications (FCM setup)
- [ ] Email integration
- [ ] TWA Android app wrapper

**Week 3:**
- [ ] Polish UI/UX
- [ ] Admin panel enhancements
- [ ] Testing + bug fixes

---

## Questions

1. **TWA vs True PWA:** Do you need Play Store presence immediately, or is "Add to Home Screen" sufficient for first demos?

2. **Email service:** Preference between SendGrid (easier) vs AWS SES (cheaper long-term)?

3. **Reservation payment:** Should reservations hold a mock amount from wallet, or just be free bookings?

4. **Admin panel:** Should it be separate from the main site (admin.elink.mk) or integrated (elink.mk/admin)?
