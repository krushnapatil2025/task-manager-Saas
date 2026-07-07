import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxfnmpqbuamzilgeogfh.supabase.co',
  'sb_secret_rUX1GJ2OedQeKvFmC-P6xg_wscQnXbJ'
);

async function run() {
  console.log('--- Checking Auth Users ---');
  // Since we are using service role key, we can use the admin API to list users!
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
  } else {
    users.forEach(u => {
      console.log(`- Email: ${u.email}`);
      console.log(`  ID: ${u.id}`);
      console.log(`  Confirmed At: ${u.email_confirmed_at}`);
      console.log(`  Created At: ${u.created_at}`);
      console.log(`  Last Sign In: ${u.last_sign_in_at}`);
      console.log(`  Metadata:`, u.user_metadata);
      console.log('---------------------------');
    });
  }
}

run();
