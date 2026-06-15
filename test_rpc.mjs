import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxfnmpqbuamzilgeogfh.supabase.co',
  'sb_publishable_mUcwdWBggqJjIFycyrQxJA_OJECxUZl'
);

async function run() {
  const { data, error } = await supabase.rpc("get_employee_invite_by_token", {
    p_token: '0e3705ec0769376316132c3df9e964e9e4ed655fc7b28a67c8b08a44ee4cb1c3',
  });
  console.log('DATA:', data);
  console.log('ERROR:', error);
}

run();
