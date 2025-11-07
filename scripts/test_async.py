#!/usr/bin/env python3
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_async():
    logger.info("🚀 Testing async functionality...")
    await asyncio.sleep(1)
    logger.info("✅ Async test completed!")

if __name__ == "__main__":
    asyncio.run(test_async())
