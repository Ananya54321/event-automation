require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  // We don't throw here to allow other parts of the script to run if possible, 
  // but in reality, sync will fail without this.
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
