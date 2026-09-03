const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://oimgljnrdxfqatfqqopa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbWdsam5yZHhmcWF0ZnFxb3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NDczOTcsImV4cCI6MjEwMjUyMzM5N30.4SeEL0IRDXGteTl2qMjWG11nvCD3lysLWeTh-hpgvg8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: ft } = await supabase.from('form_templates').select('*').eq('id', '07b7735c-ef13-4666-b0ed-ce8b34bad30f');
  if (ft && ft.length > 0) {
    const t = ft[0];
    const fieldsJson = JSON.stringify(t.fields).replace(/'/g, "''"); // escape quotes for SQL
    
    const sql = `
INSERT INTO public.file_form_templates (name, description, fields, is_active, version, is_deleted)
VALUES (
    'CFPL (Finance-Pipeline) File Copy',
    '${t.description}',
    '${fieldsJson}'::jsonb,
    true,
    1,
    false
);
`;
    fs.writeFileSync('C:/Users/Hp/.gemini/antigravity/brain/02836536-7d60-4b1c-b22b-086780409432/scratch/hardcoded_insert.sql', sql);
    console.log('Created hardcoded_insert.sql');
  } else {
    console.log('Template not found');
  }
}
run();
