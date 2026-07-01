// Script to make ayanlowo89@gmail.com a super_admin
// Run with: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node make-super-admin.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('Usage: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node make-super-admin.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function makeSuperAdmin() {
  const email = 'ayanlowo89@gmail.com';
  
  console.log(`Making ${email} a super_admin...`);
  
  // Update the profile
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('email', email)
    .select();
  
  if (error) {
    console.error('Error updating role:', error);
    process.exit(1);
  }
  
  console.log('Success! Updated profiles:', data);
  
  // Also update in users table if it exists
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .update({ role: 'super_admin' })
    .eq('email', email)
    .select();
    
  if (!usersError && usersData) {
    console.log('Also updated users table:', usersData);
  }
}

makeSuperAdmin().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
