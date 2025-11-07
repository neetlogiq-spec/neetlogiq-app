#!/bin/bash
# This script launches the interactive college mapper tool.
# Please run this from your own terminal.

# Navigate to the project directory
cd "$(dirname "$0")/.."

# Run the interactive mapper
npx tsx scripts/interactive-college-mapper.ts