# EV Charging PWA with OCPP 1.6-J

A demo progressive web app for controlling OCPP-compliant electric vehicle charging stations.

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start server
npm start

# Or with auto-reload
npm run dev
```

Open http://localhost:3000 in your browser.

## Configuration

### 1. Update Your Station IDs

Edit `server/store.js` and update the station IDs to match your actual charger IDs:

```javascript
const stations = {
  'YOUR-CHARGER-ID-1': {  // Change this to your actual charger ID
    id: 'YOUR-CHARGER-ID-1',
    name: 'Station 1 - 7kW',
    power: 7,
    lat: 42.0000,  // Your coordinates
    lng: 21.4254,
    // ...
  },
  'YOUR-CHARGER-ID-2': {  // Change this to your actual charger ID
    // ...
  }
};
```

### 2. Update Map Center

Edit `public/app.js` line ~20 to center the map on your location:

```javascript
map = L.map('map').setView([YOUR_LAT, YOUR_LNG], 14);
```

## Deployment to Railway (Recommended)

Railway offers free hosting with WebSocket support and automatic SSL.

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ev-charging-app.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Node.js and deploy
5. Go to Settings → Networking → Generate Domain
6. Note your URL: `https://your-app.up.railway.app`

### Step 3: Configure Your Chargers

In your charger's configuration panel, set the OCPP Central System URL to:

```
wss://your-app.up.railway.app/ocpp/YOUR-CHARGER-ID
```

For example:
- Charger 1: `wss://your-app.up.railway.app/ocpp/CHARGER-001`
- Charger 2: `wss://your-app.up.railway.app/ocpp/CHARGER-002`

**Important:** The charger ID in the URL must match the ID in `server/store.js`!

## Alternative: Deploy to Render

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect your GitHub repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy and get your URL

## OCPP Protocol Details

This app implements OCPP 1.6-J (JSON over WebSocket). Supported operations:

### Charger → Server (Handled)
- `BootNotification` - Charger startup
- `Heartbeat` - Keep-alive
- `StatusNotification` - Status changes
- `StartTransaction` - Charging started
- `StopTransaction` - Charging stopped
- `MeterValues` - Real-time energy data
- `Authorize` - RFID validation

### Server → Charger (Implemented)
- `RemoteStartTransaction` - Start charging remotely
- `RemoteStopTransaction` - Stop charging remotely

## Testing Without Real Chargers

If you need to test without hardware, you can use an OCPP simulator:

```bash
# Install a simple OCPP client simulator
npx ocpp-charger-simulator ws://localhost:3000/ocpp/CHARGER-001
```

Or use tools like:
- [OCPP-J Charge Point Simulator](https://github.com/pSnehanshu/ocpp-simulator)
- [Steve OCPP Simulator](https://github.com/steve-community/steve)

## Troubleshooting

### Charger shows "Offline"
1. Check charger's OCPP URL is correct (including wss:// and charger ID)
2. Verify charger can reach your server (firewall/network)
3. Check server logs for connection attempts

### "Failed to start charging"
1. Ensure charger status is "Available" (not "Preparing" or "Faulted")
2. Check if a car is plugged in (some chargers require this)
3. Verify RFID/idTag is accepted by charger

### WebSocket connection fails
1. Ensure you're using `wss://` (not `ws://`) in production
2. Check Railway/Render logs for errors
3. Verify the `/live` endpoint is accessible

## Project Structure

```
ev-charging-app/
├── server/
│   ├── index.js          # Express + WebSocket servers
│   ├── ocpp-handler.js   # OCPP 1.6 message processing
│   └── store.js          # In-memory station state
├── public/
│   ├── index.html        # PWA shell
│   ├── app.js            # Frontend logic
│   ├── style.css         # Mobile-first styles
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service worker
└── package.json
```

## Demo Flow

1. Open app on phone → See map with stations
2. Tap a station → See status (Available/Charging/Offline)
3. Tap "Start Charging" → Mock payment form
4. Enter any 16-digit number → "Payment accepted"
5. Server sends `RemoteStartTransaction` to charger
6. Watch real-time kWh/power updates
7. Tap "Stop Charging" → Session ends

## License

MIT - Use freely for demos and prototypes.
