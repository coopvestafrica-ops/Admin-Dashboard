const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ad6dc72ad69c06b1453b052934979785f679c9f6.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkNmRjNzJhZDY5YzA2YjE0NTNiMDUyOTM0OTc3ODVmNjkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0ODQ2MjIwMCwiZXhwIjoxOTYzMDM4MjAwfQ.placeholder';
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function setSuperAdmin() {
  console.log('Setting up super admin: ayanlowo89@gmail.com');
  console.log('URL:', supabaseUrl);
  try {
    const { data: profiles, error: searchError } = await supabase.from('profiles').select('*').eq('email', 'ayanlowo89@gmail.com');
    if (searchError) { console.error('Error searching profiles:', searchError); }
    console.log('Found profiles:', JSON.stringify(profiles, null, 2));
    if (profiles && profiles.length > 0) {
      const profile = profiles[0];
      console.log('Found profile ID:', profile.id);
      const { data: updated, error: updateError } = await supabase.from('profiles').update({ role: 'super_admin', is_active: true, kyc_verified: true }).eq('id', profile.id).select().single();
      if (updateError) { console.error('Error updating profile:', updateError); } 
      else { console.log('SUCCESS! Super admin set'); console.log('Role:', updated.role); }
    } else {
      console.log('No profile found. Listing all profiles...');
      const { data: allProfiles } = await supabase.from('profiles').select('id, email, name, role');
      console.log('All profiles:', JSON.stringify(allProfiles, null, 2));
    }
  } catch (err) { console.error('Error:', err); }
}
setSuperAdmin();