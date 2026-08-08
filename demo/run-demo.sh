#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Buildy Demo Runner                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if server is running
echo -e "${YELLOW}[1/4]${NC} Checking if server is running on port 3000..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓${NC} Server is running"
else
    echo -e "${RED}✗${NC} Server is not running on port 3000"
    echo -e "${YELLOW}Starting server in background...${NC}"
    cd ..
    npm start > server.log 2>&1 &
    SERVER_PID=$!
    echo "Server PID: $SERVER_PID"
    sleep 3
    cd demo
fi

# Check dependencies
echo -e "\n${YELLOW}[2/4]${NC} Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    npm run install-browsers
else
    echo -e "${GREEN}✓${NC} Dependencies installed"
fi

# Create output directories
echo -e "\n${YELLOW}[3/4]${NC} Preparing output directories..."
mkdir -p screenshots output
echo -e "${GREEN}✓${NC} Directories ready"

# Run demo
echo -e "\n${YELLOW}[4/4]${NC} Running sports website demo..."
echo -e "${BLUE}This will:${NC}"
echo "  • Launch the web editor"
echo "  • Create a complete sports website (HTML/CSS/JS)"
echo "  • Save and preview the site"
echo "  • Take screenshots at each step"
echo "  • Generate a metrics report"
echo ""
echo -e "${YELLOW}Press Enter to continue or Ctrl+C to cancel${NC}"
read

npm run demo

# Check results
echo ""
if [ $? -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Demo completed successfully! 🎉       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Results:${NC}"
    echo "  📸 Screenshots: $(ls -1 screenshots/*.png 2>/dev/null | wc -l | tr -d ' ') files"
    echo "  📁 Output: $(ls -1 output/* 2>/dev/null | wc -l | tr -d ' ') files"
    echo ""
    echo -e "${BLUE}View results:${NC}"
    echo "  Screenshots: open screenshots/"
    echo "  Metrics:     cat output/demo-report.json"
    echo "  Website:     open output/index.html"
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  Demo failed - check logs above ⚠️      ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
fi

# Cleanup prompt
echo ""
echo -e "${YELLOW}Clean up output? (y/N)${NC}"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    rm -f screenshots/*.png
    rm -f output/*.json output/*.html output/*.css output/*.js
    echo -e "${GREEN}✓${NC} Cleaned up output files"
fi

echo ""
echo -e "${BLUE}Done!${NC}"
