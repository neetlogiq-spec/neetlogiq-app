import { getRedisService } from '../src/services/RedisService';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function flushRedis() {
  console.log('--- Flushing Redis ---');
  process.env.REDIS_ENABLED = 'true';
  const redis = getRedisService();
  try {
    await redis.flush();
    console.log('✅ Redis flushed successfully.');
  } catch (error) {
    console.error('❌ Error flushing Redis:', error);
  } finally {
    process.exit(0);
  }
}

flushRedis();
