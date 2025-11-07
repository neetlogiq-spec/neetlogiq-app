#!/usr/bin/env python3
"""
Async R2 Upload Script
Uploads JSON files to Cloudflare R2 using niquests for concurrent uploads

Usage:
    python3 scripts/upload_to_r2_async.py
"""

import niquests as requests
import asyncio
import aiofiles
from pathlib import Path
import json
import logging
from typing import List, Dict
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class R2Uploader:
    def __init__(self):
        self.r2_bucket = os.getenv('R2_BUCKET', 'neetlogiq-data-public')
        self.r2_endpoint = os.getenv('R2_ENDPOINT', 'https://your-account-id.r2.cloudflarestorage.com')
        self.r2_access_key = os.getenv('R2_ACCESS_KEY')
        self.r2_secret_key = os.getenv('R2_SECRET_KEY')
        
        self.stats = {
            'files_uploaded': 0,
            'files_failed': 0,
            'total_size': 0
        }
    
    async def upload_file(self, session: requests.AsyncSession, local_path: Path, r2_key: str) -> bool:
        """Upload a single file to R2"""
        try:
            async with aiofiles.open(local_path, 'rb') as f:
                content = await f.read()
            
            response = await session.put(
                f"{self.r2_endpoint}/{self.r2_bucket}/{r2_key}",
                data=content,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.r2_access_key}'
                }
            )
            
            if response.status_code == 200:
                self.stats['files_uploaded'] += 1
                self.stats['total_size'] += len(content)
                logger.info(f"✅ Uploaded: {r2_key}")
                return True
            else:
                logger.error(f"❌ Failed to upload {r2_key}: {response.status_code}")
                self.stats['files_failed'] += 1
                return False
                
        except Exception as e:
            logger.error(f"❌ Error uploading {r2_key}: {e}")
            self.stats['files_failed'] += 1
            return False
    
    async def upload_directory(self, local_dir: Path, r2_prefix: str = ""):
        """Upload all files in a directory to R2"""
        logger.info(f"🔄 Uploading directory: {local_dir}")
        
        # Get all JSON files
        json_files = list(local_dir.rglob('*.json'))
        logger.info(f"📁 Found {len(json_files)} JSON files")
        
        # Create async session
        async with requests.AsyncSession() as session:
            # Create upload tasks
            tasks = []
            for file_path in json_files:
                # Calculate R2 key
                relative_path = file_path.relative_to(local_dir)
                r2_key = f"{r2_prefix}/{relative_path}".replace('\\', '/')
                
                # Create upload task
                task = self.upload_file(session, file_path, r2_key)
                tasks.append(task)
            
            # Upload files concurrently (batch of 20)
            batch_size = 20
            for i in range(0, len(tasks), batch_size):
                batch = tasks[i:i + batch_size]
                await asyncio.gather(*batch)
                logger.info(f"✅ Completed batch {i//batch_size + 1}")
    
    async def run(self):
        """Run the upload process"""
        logger.info("🚀 Starting R2 upload...")
        
        output_dir = Path('output/r2-data')
        if not output_dir.exists():
            logger.error(f"❌ Output directory not found: {output_dir}")
            return
        
        try:
            # Upload master data
            await self.upload_directory(output_dir / 'master', 'master')
            
            # Upload data files
            await self.upload_directory(output_dir / 'data', 'data')
            
            # Upload search indices
            await self.upload_directory(output_dir / 'search', 'search')
            
            # Print statistics
            logger.info("🎉 Upload completed!")
            logger.info(f"📊 Statistics:")
            logger.info(f"   - Files uploaded: {self.stats['files_uploaded']}")
            logger.info(f"   - Files failed: {self.stats['files_failed']}")
            logger.info(f"   - Total size: {self.stats['total_size'] / 1024 / 1024:.2f} MB")
            
        except Exception as e:
            logger.error(f"❌ Upload failed: {e}")
            raise

async def main():
    uploader = R2Uploader()
    await uploader.run()

if __name__ == "__main__":
    asyncio.run(main())
