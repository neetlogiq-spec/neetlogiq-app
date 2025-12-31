import { getRedisService } from '../src/services/RedisService';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Redis Verification Script
 * To run: npx tsx scripts/test-redis.ts
 */
async function testRedis() {
  console.log('--- Redis Verification Started ---');
  
  const enabled = process.env.REDIS_ENABLED;
  const url = process.env.REDIS_URL;
  
  console.log(`[Config] REDIS_ENABLED: ${enabled}`);
  console.log(`[Config] REDIS_URL: ${url ? (url.substring(0, 15) + '...') : 'undefined'}`);

  if (enabled !== 'true') {
    console.log('⚠️ Warning: REDIS_ENABLED is not set to "true" in environment.');
    process.env.REDIS_ENABLED = 'true'; // Force for test
  }

  const redis = getRedisService();
  
  // Wait a moment for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  const testKey = 'test:verification';
  const testData = { success: true, timestamp: Date.now(), message: 'Redis is working!' };

  try {
    console.log(`[Test] Setting key: ${testKey}`);
    await redis.set(testKey, testData, 60);
    
    console.log(`[Test] Getting key: ${testKey}`);
    const result = await redis.get<typeof testData>(testKey);
    
    console.log('[Test] Received result:', result);

    if (result && result.message === testData.message) {
      console.log('✅ Success: Redis GET/SET verified.');
    } else {
      console.log('❌ Failure: Redis GET did not match SET data or returned null.');
    }

    // Clean up
    await redis.del(testKey);
    console.log('[Test] Cleaned up test key.');

  } catch (error) {
    console.error('❌ Error testing Redis:', error);
  } finally {
    console.log('--- Redis Verification Finished ---');
    // Give it a second to clean up/close
    setTimeout(() => process.exit(0), 1000);
  }
}

testRedis();

