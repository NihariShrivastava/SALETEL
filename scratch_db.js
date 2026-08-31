import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('surveyors')
    .select('id, full_name, user_roles!inner(name)')
    .ilike('user_roles.name', '%Telecaller%');
  
  if (error) console.error(error);
  else console.log("Telecallers:", data);
}
test();
