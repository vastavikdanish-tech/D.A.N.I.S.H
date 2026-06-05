#!/usr/bin/env node

const { createRequire } = await import('module');
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function seed() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const testUserId = '00000000-0000-0000-0000-000000000001';

    const healthCheck = await client.query(
      'SELECT id FROM public.health_tracking WHERE user_id = $1 LIMIT 1',
      [testUserId]
    );

    if (healthCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO public.health_tracking (user_id, date, sleep_hours, water_ml, mood, notes)
         VALUES ($1, CURRENT_DATE, 7.5, 2000, 'good', 'Test health record from seed script')`,
        [testUserId]
      );
      console.log('Created health tracking record for test user');
    } else {
      console.log('Health tracking record already exists for test user');
    }

    const memoryCheck = await client.query(
      'SELECT id FROM public.memories WHERE user_id = $1 LIMIT 1',
      [testUserId]
    );

    if (memoryCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO public.memories (user_id, category, title, body, importance)
         VALUES ($1, 'note', 'Seed Memory', 'This is a test memory created by the seed script.', 5)`,
        [testUserId]
      );
      console.log('Created memory record for test user');
    } else {
      console.log('Memory record already exists for test user');
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
