import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cols } = await supabase.from('memories').select('id, title, category, embedding').limit(10);
  
  if (cols) {
    console.log('Sample Memories:');
    cols.forEach(m => {
      console.log(`- [${m.category}] ${m.title}: ${m.embedding ? 'HAS EMBEDDING' : 'NULL'}`);
    });
  }

  // Check dimension if possible
  const { data: dims, error: dimsErr } = await supabase.rpc('get_vector_dimension', { table_name: 'memories', column_name: 'embedding' });
  if (dimsErr) {
    console.log('Error getting dimension via RPC:', dimsErr.message);
  } else {
    console.log('Vector Dimension:', dims);
  }
}

check();
