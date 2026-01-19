#!/bin/bash

# Quick PM2 Fix Script
# Run this on your VPS if the app is in "errored" state

echo "🔧 Fixing PM2 app..."

cd /var/www/ev-charging-app

echo "📋 Current PM2 status:"
pm2 list

echo ""
echo "🗑️  Deleting errored app..."
pm2 delete elink

echo ""
echo "🚀 Starting fresh..."
pm2 start server/index.js --name elink

echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "✅ Done! Current status:"
pm2 status elink

echo ""
echo "📝 Viewing logs (Ctrl+C to exit):"
pm2 logs elink --lines 20
