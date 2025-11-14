/**
 * Debug Supabase Connection
 */

import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

async function debug() {
  console.log('Environment Variables:');
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing');
  console.log('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  console.log('Creating Supabase client...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: (url, options) => {
        console.log('Fetch called:', url);
        return fetch(url, options).catch(err => {
          console.log('Fetch error:', err.message);
          throw err;
        });
      }
    }
  });

  console.log('Client created successfully');
  console.log('');

  try {
    console.log('Attempting query...');
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(0);

    console.log('Query completed');
    console.log('Data:', data);
    console.log('Error:', error);
  } catch (err: any) {
    console.error('Caught error:', err.message);
    console.error('Stack:', err.stack);
  }
}

debug();
