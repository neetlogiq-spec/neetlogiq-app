#!/bin/bash
################################################################################
# Complete NeetLogIQ Workflow
# Automates: Import → Match → Review → Export → Deploy
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  NeetLogIQ Complete Workflow${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Import New Data
echo -e "${YELLOW}Step 1: Import New Data${NC}"
echo "Do you have new Excel files to import? (y/n)"
read -r import_new

if [ "$import_new" == "y" ]; then
    echo "Enter Excel file path (or press Enter to skip):"
    read -r excel_file

    if [ -n "$excel_file" ]; then
        echo -e "${GREEN}→ Importing: $excel_file${NC}"
        python3 partitioned_counselling_matcher.py "$excel_file"
    fi
fi

# Step 2: Match & Link Data
echo ""
echo -e "${YELLOW}Step 2: Match & Link Data${NC}"
echo "Run matching algorithm? (y/n)"
read -r run_match

if [ "$run_match" == "y" ]; then
    echo -e "${GREEN}→ Running 4-pass matching algorithm...${NC}"
    python3 match_and_link_counselling_data.py
fi

# Step 3: Interactive Review
echo ""
echo -e "${YELLOW}Step 3: Interactive Review (QA)${NC}"
echo "Review unmatched records and create aliases? (y/n)"
read -r run_review

if [ "$run_review" == "y" ]; then
    echo -e "${GREEN}→ Starting interactive mapping session...${NC}"
    python3 interactive_mapping_session.py
fi

# Step 4: Export to JSON
echo ""
echo -e "${YELLOW}Step 4: Export to JSON${NC}"
echo "Export SQLite data to JSON for production? (y/n)"
read -r run_export

if [ "$run_export" == "y" ]; then
    echo -e "${GREEN}→ Exporting to JSON...${NC}"
    python3 scripts/export_to_json_complete.py

    # Check if export was successful
    if [ -f "public/data/master/colleges.json" ]; then
        echo -e "${GREEN}✅ JSON export successful${NC}"

        # Show file sizes
        echo ""
        echo "Generated files:"
        du -sh public/data/master/
        du -sh public/data/colleges/summaries/ 2>/dev/null || true
        du -sh public/data/trends/ 2>/dev/null || true
    else
        echo -e "${RED}❌ JSON export failed${NC}"
        exit 1
    fi
fi

# Step 5: Deploy
echo ""
echo -e "${YELLOW}Step 5: Deploy to Production${NC}"
echo "Deploy JSON files? (y/n)"
read -r run_deploy

if [ "$run_deploy" == "y" ]; then
    echo "Choose deployment method:"
    echo "  1) Git push (Vercel/Netlify auto-deploy)"
    echo "  2) Cloudflare R2 upload"
    echo "  3) Manual (I'll do it myself)"
    read -r deploy_method

    case $deploy_method in
        1)
            echo -e "${GREEN}→ Git deployment...${NC}"
            git add public/data/
            echo "Enter commit message:"
            read -r commit_msg
            git commit -m "$commit_msg"
            git push
            echo -e "${GREEN}✅ Pushed to git. Vercel/Netlify will auto-deploy.${NC}"
            ;;
        2)
            echo -e "${GREEN}→ Cloudflare R2 upload...${NC}"
            if [ -f "scripts/upload_to_r2.py" ]; then
                python3 scripts/upload_to_r2.py
                echo -e "${GREEN}✅ Uploaded to Cloudflare R2${NC}"
            else
                echo -e "${RED}❌ upload_to_r2.py not found${NC}"
            fi
            ;;
        3)
            echo -e "${BLUE}ℹ  Manual deployment selected${NC}"
            echo "Upload public/data/ to your CDN/hosting provider"
            ;;
        *)
            echo -e "${BLUE}ℹ  Skipping deployment${NC}"
            ;;
    esac
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Workflow Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary:"
echo "  • SQLite databases: data/sqlite/ (development)"
echo "  • JSON files: public/data/ (production)"
echo ""
echo "Next steps:"
echo "  1. Test locally: npm run dev"
echo "  2. Visit: http://localhost:3500"
echo "  3. Check master data: ls -la public/data/master/"
echo ""
echo -e "${BLUE}Done! 🎉${NC}"
