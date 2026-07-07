import { createClient } from '@supabase/supabase-js';

// Standard client to test user login
const supabaseClient = createClient(
  'https://gxfnmpqbuamzilgeogfh.supabase.co',
  'sb_publishable_mUcwdWBggqJjIFycyrQxJA_OJECxUZl'
);

// Admin client to update user password
const supabaseAdmin = createClient(
  'https://gxfnmpqbuamzilgeogfh.supabase.co',
  'sb_secret_rUX1GJ2OedQeKvFmC-P6xg_wscQnXbJ'
);

async function run() {
  const userId = '38fef4b9-0242-40a7-b98a-615feaace91d'; // kmppatil819@gmail.com
  
  console.log('--- Updating user password to Password@123 ---');
  const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: 'Password@123' }
  );

  if (updateError) {
    console.error('Update password error:', updateError);
    return;
  }
  console.log('Password updated successfully for user:', updateData.user.email);

  console.log('\n--- Attempting Client-Side signInWithPassword ---');
  const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: 'kmppatil819@gmail.com',
    password: 'Password@123'
  });

  if (signInError) {
    console.error('SignIn error details:');
    console.error('  Message:', signInError.message);
    console.error('  Status:', signInError.status);
    console.error('  Code:', signInError.code);
  } else {
    console.log('SignIn successful! Session user:', signInData.user.email);
  }
}

run();
