const { default: fetch } = require('node-fetch');

const SUPABASE_ACCESS_TOKEN = 'sbp_6ebdfb805ce7f4c8eb0616f8f1b5b5709f7f89d3';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function executeSQL(sql) {
  console.log('Executing SQL:', sql.substring(0, 100) + '...');
  
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error('SQL Error:', result);
    throw new Error(`SQL execution failed: ${result.message}`);
  }
  
  console.log('✅ SQL executed successfully');
  return result;
}

async function fixRLSPolicy() {
  console.log('🔧 Fixing RLS policy for channel_roles...');

  try {
    // 1. Drop existing problematic policy
    await executeSQL(`
      DROP POLICY IF EXISTS "Channel owners can manage roles" ON channel_roles;
    `);

    // 2. Create a simpler insert policy for authenticated users
    await executeSQL(`
      CREATE POLICY "Enable insert for authenticated users" ON channel_roles 
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    `);

    // 3. Create update/delete policy for channel owners
    await executeSQL(`
      CREATE POLICY "Channel owners can update roles" ON channel_roles 
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM channels c
            WHERE c.id = channel_roles.channel_id 
            AND c.created_by = auth.uid()
          )
        );
    `);

    await executeSQL(`
      CREATE POLICY "Channel owners can delete roles" ON channel_roles 
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM channels c
            WHERE c.id = channel_roles.channel_id 
            AND c.created_by = auth.uid()
          )
        );
    `);

    console.log('✅ RLS policies fixed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixRLSPolicy();