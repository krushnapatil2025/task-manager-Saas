import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxfnmpqbuamzilgeogfh.supabase.co',
  'sb_publishable_mUcwdWBggqJjIFycyrQxJA_OJECxUZl'
);

async function run() {
  const { data, error } = await supabase
    .from('employee_invitations')
    .select('*')
    .eq('token', '9baafaebd1c324362e0dad1eba0ebfbf264be6889631686746d7134a37f0410c0');
  console.log('DIRECT DATA:', data);
  console.log('DIRECT ERROR:', error);
}

run();
