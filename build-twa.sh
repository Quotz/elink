#!/bin/bash
# Build TWA (Trusted Web Activity) APK for eLink

set -e

echo "🚀 Building eLink Android App (TWA)"
echo "===================================="

# Check if bubblewrap is installed
if ! command -v bubblewrap &> /dev/null; then
    echo "📦 Installing Bubblewrap CLI..."
    npm install -g @bubblewrap/cli
fi

# Build the TWA
echo "🔨 Building Android project..."
bubblewrap build --manifest twa-manifest.json

echo ""
echo "✅ Build complete!"
echo ""
echo "APK location: ./app-release-signed.apk"
echo ""
echo "To install on Android:"
echo "  adb install app-release-signed.apk"
echo ""
echo "To publish to Play Store:"
echo "  1. Go to https://play.google.com/console"
echo "  2. Create app with package name: mk.elink.app"
echo "  3. Upload app-release-signed.apk"
echo ""
