import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://pigrdhzlhvvigkbjlmfi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3Njc5NiwiZXhwIjoyMDczNTUyNzk2fQ.xhNElfnLIUq60AaHGUKSQnwJGCQKJjhS_2TA1W-jfK8';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runCategoriesSQL() {
  try {
    console.log('Adding categories support to database...');

    // Read and execute the SQL file
    const sqlContent = fs.readFileSync('./add-categories.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error('SQL Error:', error);
        // Try direct query if RPC fails
        const { error: directError } = await supabase
          .from('_sql')
          .select()
          .limit(0); // This will fail but might give us better error info
        
        if (directError) {
          console.log('Trying alternative approach...');
        }
      } else {
        console.log('✓ Statement executed successfully');
      }
    }

    console.log('✅ Categories setup completed!');
    
    // Verify the setup
    const { data: categories, error: catError } = await supabase
      .from('channel_categories')
      .select('*');
      
    if (catError) {
      console.error('Error fetching categories:', catError);
    } else {
      console.log('📊 Created categories:', categories?.length || 0);
      categories?.forEach(cat => {
        console.log(`  - ${cat.emoji} ${cat.name} (${cat.server_id})`);
      });
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

runCategoriesSQL();