// Simple script to run database migration
// Run with: node scripts/run-migration.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pigrdhzlhvvigkbjlmfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDg5NjA3MSwiZXhwIjoyMDUwNDcyMDcxfQ.f6aCYVpXTZWPr4D2J8l1vJAOQQIIaJBb5a_YYpWWUPI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running channel_role_id migration...');
  
  const sql = `
    -- Add channel_role_id foreign key to channel_members table
    -- This enables custom role assignments for channel members

    -- Add channel_role_id column (nullable - members without custom roles will be null)
    ALTER TABLE channel_members 
    ADD COLUMN IF NOT EXISTS channel_role_id UUID;

    -- Add foreign key constraint to channel_roles table
    ALTER TABLE channel_members 
    ADD CONSTRAINT IF NOT EXISTS fk_channel_members_role 
    FOREIGN KEY (channel_role_id) REFERENCES channel_roles(id) ON DELETE SET NULL;

    -- Create index for better query performance
    CREATE INDEX IF NOT EXISTS idx_channel_members_role 
    ON channel_members(channel_role_id);
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully!');
    console.log('Result:', data);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

runMigration();