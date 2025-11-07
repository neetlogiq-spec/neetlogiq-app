#!/bin/bash
################################################################################
# Update and Deploy Script
# Quick workflow: Export JSON → Test → Deploy
# Use this when SQLite data is already updated
################################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Quick Update & Deploy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Export to JSON
echo -e "${YELLOW}Step 1: Export SQLite → JSON${NC}"
echo -e "${GREEN}→ Exporting...${NC}"
python3 scripts/export_to_json_complete.py

if [ ! -f "public/data/master/colleges.json" ]; then
    echo -e "${RED}❌ Export failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Export complete${NC}"
echo ""

# Show what was generated
echo "Generated files:"
echo -e "${BLUE}Master data:${NC}"
ls -lh public/data/master/ | tail -n +2

if [ -d "public/data/colleges/summaries" ]; then
    SUMMARY_COUNT=$(ls public/data/colleges/summaries/ | wc -l)
    echo -e "${BLUE}College summaries:${NC} $SUMMARY_COUNT files"
fi

if [ -d "public/data/trends/college-trends" ]; then
    TREND_COUNT=$(ls public/data/trends/college-trends/ | wc -l)
    echo -e "${BLUE}Trend files:${NC} $TREND_COUNT files"
fi

echo ""
TOTAL_SIZE=$(du -sh public/data/ | awk '{print $1}')
echo -e "${GREEN}Total size: $TOTAL_SIZE${NC}"
echo ""

# Step 2: Test locally (optional)
echo -e "${YELLOW}Step 2: Test Locally${NC}"
echo "Start dev server to test? (y/n)"
read -r test_local

if [ "$test_local" == "y" ]; then
    echo -e "${GREEN}→ Starting dev server...${NC}"
    echo "Visit: http://localhost:3500"
    echo "Press Ctrl+C when done testing"
    npm run dev
fi

# Step 3: Deploy
echo ""
echo -e "${YELLOW}Step 3: Deploy to Production${NC}"
echo "Ready to deploy? (y/n)"
read -r ready_deploy

if [ "$ready_deploy" != "y" ]; then
    echo -e "${BLUE}ℹ  Deployment skipped${NC}"
    echo "Run this script again when ready to deploy"
    exit 0
fi

echo "Choose deployment method:"
echo "  1) Git push (Vercel/Netlify)"
echo "  2) Cloudflare R2"
echo "  3) Cancel"
read -r deploy_choice

case $deploy_choice in
    1)
        echo -e "${GREEN}→ Git deployment${NC}"

        # Check if there are changes
        if [[ -n $(git status -s public/data/) ]]; then
            git add public/data/

            # Get current date for commit message
            DATE=$(date +"%Y-%m-%d")
            DEFAULT_MSG="Update counselling data - $DATE"

            echo "Commit message (press Enter for default):"
            echo "Default: $DEFAULT_MSG"
            read -r commit_msg

            if [ -z "$commit_msg" ]; then
                commit_msg=$DEFAULT_MSG
            fi

            git commit -m "$commit_msg"

            echo "Push to remote? (y/n)"
            read -r do_push

            if [ "$do_push" == "y" ]; then
                git push
                echo -e "${GREEN}✅ Pushed to git${NC}"
                echo "Vercel/Netlify will auto-deploy in ~2 minutes"
            fi
        else
            echo -e "${BLUE}ℹ  No changes to commit${NC}"
        fi
        ;;

    2)
        echo -e "${GREEN}→ Cloudflare R2 upload${NC}"
        if [ -f "scripts/upload_to_r2.py" ]; then
            python3 scripts/upload_to_r2.py
            echo -e "${GREEN}✅ Uploaded to R2${NC}"
        else
            echo -e "${RED}❌ scripts/upload_to_r2.py not found${NC}"
            echo "Create this script to upload to Cloudflare R2"
        fi
        ;;

    3)
        echo -e "${BLUE}ℹ  Deployment cancelled${NC}"
        ;;

    *)
        echo -e "${BLUE}ℹ  Invalid choice${NC}"
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Done! 🚀${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Files ready for deployment in: public/data/"
echo "Total size: $TOTAL_SIZE"
