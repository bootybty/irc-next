const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs').promises;
const path = require('path');

const MANAGEMENT_TOKEN = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function runMigration() {
  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'admin-migration.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    console.log('Running admin system migration...\n');
    
    // Execute the migration
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Migration failed: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Migration completed successfully!');
    
    // Verify the migration
    console.log('\n📋 Verifying migration results...\n');
    
    // Check if admin tables were created
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('admin_logs', 'site_bans', 'admin_reports')
      ORDER BY table_name;
    `;
    
    const verifyResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: verifyQuery })
    });
    
    if (verifyResponse.ok) {
      const tables = await verifyResponse.json();
      console.log('Created tables:');
      tables.forEach(t => console.log(`  ✓ ${t.table_name}`));
    }
    
    // Check if admin channel exists
    const channelQuery = `
      SELECT name, topic FROM channels WHERE name = 'admin';
    `;
    
    const channelResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: channelQuery })
    });
    
    if (channelResponse.ok) {
      const channels = await channelResponse.json();
      if (channels.length > 0) {
        console.log('\nAdmin channel:');
        console.log(`  ✓ #admin - ${channels[0].topic}`);
      }
    }
    
    console.log('\n🎉 Admin system is ready to use!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();