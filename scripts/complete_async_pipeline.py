#!/usr/bin/env python3
"""
Complete Async Pipeline
Orchestrates the entire async build process

Usage:
    python3 scripts/complete_async_pipeline.py
"""

import asyncio
import logging
from pathlib import Path
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AsyncPipeline:
    def __init__(self):
        self.steps = [
            ("generate_master_data", "Generate Master Data JSON"),
            ("upload_to_r2", "Upload to R2"),
            ("build_static_site", "Build Static Site")
        ]
        self.stats = {
            'start_time': None,
            'end_time': None,
            'steps_completed': 0,
            'steps_failed': 0
        }
    
    async def run_step(self, step_name: str, description: str) -> bool:
        """Run a single pipeline step"""
        logger.info(f"🔄 STEP: {description}")
        
        try:
            if step_name == "generate_master_data":
                from generate_master_data_json import MasterDataGenerator
                generator = MasterDataGenerator()
                await generator.run()
                
            elif step_name == "upload_to_r2":
                from upload_to_r2_async import R2Uploader
                uploader = R2Uploader()
                await uploader.run()
                
            elif step_name == "build_static_site":
                from build_static_site_async import StaticSiteBuilder
                builder = StaticSiteBuilder()
                await builder.run()
            
            self.stats['steps_completed'] += 1
            logger.info(f"✅ STEP COMPLETED: {description}")
            return True
            
        except Exception as e:
            self.stats['steps_failed'] += 1
            logger.error(f"❌ STEP FAILED: {description} - {e}")
            return False
    
    async def run(self):
        """Run the complete pipeline"""
        logger.info("🚀 Starting Complete Async Pipeline...")
        
        try:
            for step_name, description in self.steps:
                success = await self.run_step(step_name, description)
                if not success:
                    logger.error(f"❌ Pipeline failed at step: {description}")
                    return False
            
            logger.info("🎉 Complete Async Pipeline finished successfully!")
            logger.info(f"📊 Statistics:")
            logger.info(f"   - Steps completed: {self.stats['steps_completed']}")
            logger.info(f"   - Steps failed: {self.stats['steps_failed']}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Pipeline failed: {e}")
            return False

async def main():
    pipeline = AsyncPipeline()
    success = await pipeline.run()
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
