const { default: fetch } = require('node-fetch');

const SUPABASE_ACCESS_TOKEN = 'sbp_6ebdfb805ce7f4c8eb0616f8f1b5b5709f7f89d3';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function executeSQL(sql) {
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
    return null;
  }
  
  return result;
}

async function checkRoles() {
  console.log('🔍 Checking channel roles...');

  try {
    // Check if roles exist
    const rolesResult = await executeSQL(`
      SELECT 
        cr.name,
        cr.color,
        cr.permissions,
        c.name as channel_name,
        COUNT(cm.id) as member_count
      FROM channel_roles cr
      JOIN channels c ON cr.channel_id = c.id
      LEFT JOIN channel_members cm ON cm.role_id = cr.id
      GROUP BY cr.id, cr.name, cr.color, cr.permissions, c.name
      ORDER BY c.name, cr.sort_order DESC
      LIMIT 20;
    `);

    if (rolesResult?.result) {
      console.log('📋 Channel Roles:');
      rolesResult.result.forEach(role => {
        console.log(`  ${role.name} (${role.channel_name}) - ${role.member_count} members - ${role.color}`);
        console.log(`    Permissions: ${JSON.stringify(role.permissions)}`);
      });
    }

    // Check channel members with roles
    const membersResult = await executeSQL(`
      SELECT 
        cm.username,
        cm.role as legacy_role,
        cr.name as role_name,
        cr.permissions,
        c.name as channel_name
      FROM channel_members cm
      JOIN channels c ON cm.channel_id = c.id
      LEFT JOIN channel_roles cr ON cm.role_id = cr.id
      ORDER BY c.name, cr.sort_order DESC
      LIMIT 10;
    `);

    if (membersResult?.result) {
      console.log('\n👥 Channel Members:');
      membersResult.result.forEach(member => {
        console.log(`  ${member.username} in ${member.channel_name}: ${member.role_name || member.legacy_role}`);
        if (member.permissions) {
          console.log(`    Permissions: ${JSON.stringify(member.permissions)}`);
        }
      });
    }

    // Check triggers
    const triggersResult = await executeSQL(`
      SELECT trigger_name, event_manipulation, action_statement 
      FROM information_schema.triggers 
      WHERE event_object_table = 'channels'
      ORDER BY trigger_name;
    `);

    if (triggersResult?.result) {
      console.log('\n⚡ Channel Triggers:');
      triggersResult.result.forEach(trigger => {
        console.log(`  ${trigger.trigger_name} - ${trigger.event_manipulation}`);
      });
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkRoles();