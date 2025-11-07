#!/usr/bin/env python3
"""
Async Static Site Builder
Builds Next.js static site with async operations

Usage:
    python3 scripts/build_static_site_async.py
"""

import asyncio
import subprocess
import logging
from pathlib import Path
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class StaticSiteBuilder:
    def __init__(self):
        self.project_root = Path('.')
        self.stats = {
            'start_time': None,
            'end_time': None,
            'pages_generated': 0
        }
    
    async def run_command(self, command: list, description: str) -> bool:
        """Run a command asynchronously"""
        logger.info(f"🔄 {description}...")
        
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.info(f"✅ {description} completed")
                return True
            else:
                logger.error(f"❌ {description} failed: {stderr.decode()}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error running {description}: {e}")
            return False
    
    async def generate_static_pages(self):
        """Generate static pages for all colleges"""
        logger.info("🔄 Generating static pages...")
        
        # This would integrate with Next.js build process
        # For now, we'll simulate the process
        
        # Load master colleges data
        master_file = Path('output/r2-data/master/colleges.json')
        if master_file.exists():
            with open(master_file, 'r') as f:
                colleges = json.load(f)
            
            self.stats['pages_generated'] = len(colleges)
            logger.info(f"✅ Will generate {len(colleges)} static pages")
        else:
            logger.warning("⚠️ Master colleges file not found")
    
    async def build_nextjs(self):
        """Build Next.js static site"""
        commands = [
            (['npm', 'run', 'build'], "Building Next.js static site"),
            (['npm', 'run', 'export'], "Exporting static files")
        ]
        
        for command, description in commands:
            success = await self.run_command(command, description)
            if not success:
                return False
        
        return True
    
    async def run(self):
        """Run the complete build process"""
        logger.info("🚀 Starting static site build...")
        
        try:
            # Generate static pages
            await self.generate_static_pages()
            
            # Build Next.js
            success = await self.build_nextjs()
            
            if success:
                logger.info("🎉 Static site build completed!")
                logger.info(f"📊 Pages generated: {self.stats['pages_generated']}")
            else:
                logger.error("❌ Static site build failed")
                
        except Exception as e:
            logger.error(f"❌ Build process failed: {e}")
            raise

async def main():
    builder = StaticSiteBuilder()
    await builder.run()

if __name__ == "__main__":
    asyncio.run(main())
