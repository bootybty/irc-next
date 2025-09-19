const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MANAGEMENT_TOKEN = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function queryDatabase(sql) {
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
    throw new Error(`Database query failed: ${error}`);
  }

  return response.json();
}

async function checkDatabaseSchema() {
  console.log('=== CHECKING DATABASE SCHEMA ===\n');
  
  // Get all tables
  console.log('1. EXISTING TABLES:');
  const tablesQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  
  try {
    const tablesResult = await queryDatabase(tablesQuery);
    console.log('Tables found:');
    tablesResult.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check for admin-related tables
    console.log('\n2. CHECKING FOR ADMIN TABLES:');
    const adminTables = ['site_admins', 'site_moderators', 'admin_logs', 'site_bans', 'admin_actions'];
    for (const table of adminTables) {
      const exists = tablesResult.some(row => row.table_name === table);
      console.log(`  - ${table}: ${exists ? '✓ EXISTS' : '✗ NOT FOUND'}`);
    }
    
    // Get users table structure (not profiles)
    console.log('\n3. USERS TABLE STRUCTURE:');
    const usersQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;
    const usersResult = await queryDatabase(usersQuery);
    console.log('Columns in users:');
    usersResult.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check if there's any admin role column in users
    const hasAdminRole = usersResult.some(col => 
      col.column_name.includes('admin') || 
      col.column_name.includes('role') || 
      col.column_name.includes('moderator')
    );
    console.log(`\n  Admin role fields: ${hasAdminRole ? '✓ Found' : '✗ Not found'}`);
    
    // Get channel_members structure for role comparison
    console.log('\n4. CHANNEL_MEMBERS ROLE STRUCTURE:');
    const membersQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'channel_members' AND column_name LIKE '%role%'
      ORDER BY ordinal_position;
    `;
    const membersResult = await queryDatabase(membersQuery);
    console.log('Role columns in channel_members:');
    membersResult.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // First, check channels table structure
    console.log('\n5. CHANNELS TABLE STRUCTURE:');
    const channelsStructQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'channels'
      ORDER BY ordinal_position;
    `;
    const channelsStructResult = await queryDatabase(channelsStructQuery);
    console.log('Columns in channels:');
    channelsStructResult.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Check channels table for admin channel
    console.log('\n6. CHECKING FOR ADMIN CHANNEL:');
    const adminChannelQuery = `
      SELECT name, created_at, description
      FROM channels
      WHERE name = 'admin'
      LIMIT 1;
    `;
    const adminChannelResult = await queryDatabase(adminChannelQuery);
    if (adminChannelResult.length > 0) {
      console.log('  ✓ Admin channel exists:');
      console.log(`    - Created: ${adminChannelResult[0].created_at}`);
      console.log(`    - Description: ${adminChannelResult[0].description || 'None'}`);
    } else {
      console.log('  ✗ Admin channel not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDatabaseSchema();