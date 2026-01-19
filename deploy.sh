#!/bin/bash

# EV Charging App Deployment Script
# Usage: ./deploy.sh "commit message" or npm run deploy "commit message"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VPS_USER="root"
VPS_HOST="46.224.209.188"
VPS_PATH="/var/www/ev-charging-app"
PM2_APP_NAME="elink"
GITHUB_BRANCH="main"

echo -e "${BLUE}🚀 Starting deployment process...${NC}\n"

# Check if commit message is provided
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: Commit message required${NC}"
  echo "Usage: npm run deploy \"your commit message\""
  exit 1
fi

COMMIT_MSG="$1"

# Step 1: Check for uncommitted changes
echo -e "${BLUE}📋 Step 1: Checking for changes...${NC}"
if [[ -z $(git status -s) ]]; then
  echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
  echo -e "${GREEN}✓ Changes detected${NC}"
fi

# Step 2: Git add all changes
echo -e "\n${BLUE}📦 Step 2: Staging changes...${NC}"
git add .
echo -e "${GREEN}✓ Changes staged${NC}"

# Step 3: Commit changes
echo -e "\n${BLUE}💾 Step 3: Committing changes...${NC}"
git commit -m "$COMMIT_MSG" || echo -e "${YELLOW}⚠️  Nothing to commit or commit failed${NC}"

# Step 4: Push to GitHub
echo -e "\n${BLUE}⬆️  Step 4: Pushing to GitHub...${NC}"
git push origin $GITHUB_BRANCH
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully pushed to GitHub${NC}"
else
  echo -e "${RED}❌ Failed to push to GitHub${NC}"
  exit 1
fi

# Step 5: Deploy to VPS
echo -e "\n${BLUE}🌐 Step 5: Deploying to VPS (${VPS_HOST})...${NC}"

ssh ${VPS_USER}@${VPS_HOST} << ENDSSH
  set -e
  
  echo -e "${BLUE}📂 Navigating to app directory...${NC}"
  cd ${VPS_PATH}
  
  echo -e "${BLUE}⬇️  Pulling latest code from GitHub...${NC}"
  git pull origin ${GITHUB_BRANCH}
  
  echo -e "${BLUE}📦 Installing dependencies...${NC}"
  npm install --production
  
  echo -e "${BLUE}🔄 Restarting PM2 application...${NC}"
  pm2 restart ${PM2_APP_NAME}
  
  echo -e "${BLUE}✓ Deployment complete!${NC}"
  
  echo -e "\n${BLUE}📊 Application Status:${NC}"
  pm2 status ${PM2_APP_NAME}
  
  echo -e "\n${BLUE}📝 Recent Logs:${NC}"
  pm2 logs ${PM2_APP_NAME} --lines 10 --nostream
ENDSSH

if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}✅ Deployment successful!${NC}"
  echo -e "${GREEN}🌐 Your app is live at: https://ocpp.fankeeps.com${NC}"
  echo -e "${GREEN}⚙️  Admin panel: https://ocpp.fankeeps.com/admin.html${NC}"
else
  echo -e "\n${RED}❌ Deployment failed${NC}"
  exit 1
fi
