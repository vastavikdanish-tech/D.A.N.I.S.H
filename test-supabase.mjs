import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing env vars');
    return;
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('memories').select('*').limit(1);

  if (error) {
    console.error('Error fetching memories:', error);
  } else {
    console.log('Successfully fetched memories:', data);
  }
}

test();
