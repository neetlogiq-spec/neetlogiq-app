#!/bin/bash
################################################################################
# Unified Workflow - Single Script for All Data Processing
# Handles: Counselling Data, Seat Data, Export, Deploy
################################################################################

set -e

# Colors
RED='\033[0:31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  NeetLogIQ Unified Workflow${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if unified processor exists
if [ ! -f "unified_data_processor.py" ]; then
    echo -e "${RED}❌ unified_data_processor.py not found!${NC}"
    exit 1
fi

# Main menu
echo "Select workflow mode:"
echo "  1) Interactive Mode (step-by-step prompts)"
echo "  2) Auto Mode - Process Counselling Data"
echo "  3) Auto Mode - Process Seat Data"
echo "  4) Auto Mode - Process Both Types"
echo "  5) Export to JSON Only"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo -e "${GREEN}→ Starting Interactive Mode...${NC}"
        python3 unified_data_processor.py --interactive
        ;;
    2)
        echo -e "${GREEN}→ Auto Processing: Counselling Data${NC}"
        python3 unified_data_processor.py --auto --data-type counselling
        ;;
    3)
        echo -e "${GREEN}→ Auto Processing: Seat Data${NC}"
        python3 unified_data_processor.py --auto --data-type seat
        ;;
    4)
        echo -e "${GREEN}→ Auto Processing: Both Types${NC}"
        python3 unified_data_processor.py --auto --all
        ;;
    5)
        echo -e "${GREEN}→ Exporting to JSON...${NC}"
        python3 scripts/export_to_json_complete.py
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Check if JSON files were created
if [ -f "public/data/master/colleges.json" ]; then
    echo ""
    echo -e "${GREEN}✅ JSON files ready for deployment${NC}"
    echo ""
    echo "Files generated:"
    du -sh public/data/master/ 2>/dev/null || true
    du -sh public/data/colleges/summaries/ 2>/dev/null || true
    du -sh public/data/trends/ 2>/dev/null || true
    echo ""

    # Ask about deployment
    read -p "Deploy to production? (y/n): " deploy_choice

    if [ "$deploy_choice" == "y" ]; then
        echo ""
        echo "Deployment options:"
        echo "  1) Git push (Vercel/Netlify)"
        echo "  2) Cloudflare R2"
        echo "  3) Skip"
        read -p "Choose [1-3]: " deploy_method

        case $deploy_method in
            1)
                echo -e "${GREEN}→ Git deployment${NC}"
                git add public/data/
                read -p "Commit message: " msg
                git commit -m "${msg:-Update data $(date +%Y-%m-%d)}"
                git push
                echo -e "${GREEN}✅ Deployed via git${NC}"
                ;;
            2)
                echo -e "${GREEN}→ Cloudflare R2${NC}"
                if [ -f "scripts/upload_to_r2.py" ]; then
                    python3 scripts/upload_to_r2.py
                else
                    echo -e "${YELLOW}upload_to_r2.py not found${NC}"
                fi
                ;;
            3)
                echo -e "${BLUE}Deployment skipped${NC}"
                ;;
        esac
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Workflow Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  • Test locally: npm run dev"
echo "  • Visit: http://localhost:3500"
echo "  • Check data: ls -la public/data/master/"
