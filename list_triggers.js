require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.rpc('get_triggers_debug'); // Likely doesn't exist
    console.log(data, error);
}
// check();
